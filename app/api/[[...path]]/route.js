import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { v4 as uuidv4 } from 'uuid'
import { getDb, stripId } from '@/lib/mongo'
import { getCurrentUserId } from '@/lib/auth-helper'
import { analyzeKeyword } from '@/lib/services/serper'
import { enqueueArticle, createBulkJob, startWorkerOnce, pauseJob, resumeJob, retryFailedInJob, retryArticle } from '@/lib/services/queue'
import { rewriteText } from '@/lib/services/openai'
import { articleToMarkdown } from '@/lib/services/prompt-builder'
import { toHtml, toMarkdown, toText, toDocx } from '@/lib/services/article-export'
import { zipArticles } from '@/lib/services/bulk-export'

function cors(res) {
  res.headers.set('Access-Control-Allow-Origin', process.env.CORS_ORIGINS || '*')
  res.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH')
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  return res
}
function ok(data, init = {}) { return cors(NextResponse.json(data, init)) }
function err(message, status = 400) { return cors(NextResponse.json({ error: message }, { status })) }
export async function OPTIONS() { return cors(new NextResponse(null, { status: 200 })) }

async function requireAuth() {
  const uid = await getCurrentUserId()
  return uid || null
}

async function handle(request, { params }) {
  const { path = [] } = params
  const route = '/' + path.join('/')
  const method = request.method
  startWorkerOnce()

  try {
    if (route === '/' || route === '/root') {
      return ok({ service: 'SEOForge AI', status: 'ok' })
    }

    // ============= AUTH =============
    if ((route === '/signup' || route === '/auth/signup') && method === 'POST') {
      const { email, password, name } = await request.json()
      if (!email || !password || password.length < 6) return err('Email and password (min 6 chars) required', 400)
      const db = await getDb()
      const emailLc = String(email).toLowerCase().trim()
      const existing = await db.collection('users').findOne({ email: emailLc })
      if (existing) return err('Email already registered', 409)
      const passwordHash = await bcrypt.hash(password, 10)
      const user = {
        id: uuidv4(), email: emailLc, name: name || emailLc.split('@')[0],
        passwordHash, role: 'user', credits: 100, plan: 'free',
        articlesGenerated: 0, createdAt: new Date(),
      }
      await db.collection('users').insertOne(user)
      return ok({ id: user.id, email: user.email, name: user.name })
    }

    // ============= ME =============
    if (route === '/me' && method === 'GET') {
      const uid = await requireAuth()
      if (!uid) return err('Unauthorized', 401)
      const db = await getDb()
      const user = await db.collection('users').findOne({ id: uid })
      if (!user) return err('User not found', 404)
      const { passwordHash, _id, ...safe } = user
      return ok(safe)
    }

    // ============= DASHBOARD STATS =============
    if (route === '/dashboard/stats' && method === 'GET') {
      const uid = await requireAuth()
      if (!uid) return err('Unauthorized', 401)
      const db = await getDb()
      const [user, articles, jobs, recent] = await Promise.all([
        db.collection('users').findOne({ id: uid }),
        db.collection('articles').aggregate([
          { $match: { userId: uid } },
          { $group: { _id: '$status', count: { $sum: 1 } } },
        ]).toArray(),
        db.collection('jobs').countDocuments({ userId: uid }),
        db.collection('articles').find({ userId: uid }).sort({ createdAt: -1 }).limit(5).project({ id: 1, primaryKeyword: 1, title: 1, status: 1, createdAt: 1, websiteUrl: 1 }).toArray(),
      ])
      const statusMap = { queued: 0, processing: 0, completed: 0, failed: 0 }
      for (const a of articles) statusMap[a._id] = a.count
      const totalArticles = statusMap.queued + statusMap.processing + statusMap.completed + statusMap.failed
      return ok({
        credits: user?.credits || 0, plan: user?.plan || 'free',
        totalArticles, completedArticles: statusMap.completed,
        processingArticles: statusMap.processing + statusMap.queued,
        failedArticles: statusMap.failed, totalJobs: jobs,
        serpRequests: statusMap.completed + statusMap.processing,
        recent: recent.map(stripId),
      })
    }

    // ============= SERP =============
    if (route === '/serp/analyze' && method === 'POST') {
      const uid = await requireAuth()
      if (!uid) return err('Unauthorized', 401)
      const body = await request.json()
      const { keyword, country, language, deep } = body
      if (!keyword) return err('keyword is required', 400)
      try {
        const data = await analyzeKeyword({ keyword, country: country || 'us', language: language || 'en', deep: deep !== false })
        return ok(data)
      } catch (e) {
        return err(e.message, 502)
      }
    }

    // ============= GENERATE (single) =============
    if (route === '/generate' && method === 'POST') {
      const uid = await requireAuth()
      if (!uid) return err('Unauthorized', 401)
      const db = await getDb()
      const user = await db.collection('users').findOne({ id: uid })
      if ((user?.credits || 0) < 1) return err('Insufficient credits', 402)
      const body = await request.json()
      if (!body.primaryKeyword) return err('primaryKeyword is required', 400)
      const id = await enqueueArticle({ ...body, userId: uid })
      return ok({ id, status: 'queued' })
    }

    // ============= BULK =============
    if (route === '/bulk' && method === 'POST') {
      const uid = await requireAuth()
      if (!uid) return err('Unauthorized', 401)
      const db = await getDb()
      const user = await db.collection('users').findOne({ id: uid })
      const body = await request.json()
      const rows = Array.isArray(body.rows) ? body.rows : []
      if (!rows.length) return err('No rows provided', 400)
      if ((user?.credits || 0) < rows.length) return err(`Insufficient credits. Need ${rows.length}, have ${user?.credits || 0}`, 402)
      const job = await createBulkJob({ userId: uid, name: body.name, rows, defaults: body.defaults || {}, projectId: body.projectId || null })
      return ok(stripId(job))
    }

    // ============= PROJECTS =============
    if (route === '/projects' && method === 'GET') {
      const uid = await requireAuth()
      if (!uid) return err('Unauthorized', 401)
      const db = await getDb()
      const projects = await db.collection('projects').find({ userId: uid }).sort({ createdAt: -1 }).toArray()
      // Counts
      const counts = await db.collection('articles').aggregate([
        { $match: { userId: uid, projectId: { $ne: null } } },
        { $group: { _id: '$projectId', count: { $sum: 1 } } },
      ]).toArray()
      const countMap = Object.fromEntries(counts.map(c => [c._id, c.count]))
      return ok(projects.map(p => ({ ...stripId(p), articleCount: countMap[p.id] || 0 })))
    }
    if (route === '/projects' && method === 'POST') {
      const uid = await requireAuth()
      if (!uid) return err('Unauthorized', 401)
      const { name, websiteUrl, description } = await request.json()
      if (!name) return err('Name required', 400)
      const db = await getDb()
      const project = { id: uuidv4(), userId: uid, name, websiteUrl: websiteUrl || '', description: description || '', createdAt: new Date() }
      await db.collection('projects').insertOne(project)
      return ok(stripId(project))
    }
    const projectMatch = route.match(/^\/projects\/([^/]+)$/)
    if (projectMatch) {
      const uid = await requireAuth()
      if (!uid) return err('Unauthorized', 401)
      const id = projectMatch[1]
      const db = await getDb()
      if (method === 'GET') {
        const p = await db.collection('projects').findOne({ id, userId: uid })
        if (!p) return err('Not found', 404)
        return ok(stripId(p))
      }
      if (method === 'PUT' || method === 'PATCH') {
        const body = await request.json()
        const upd = {}
        for (const k of ['name', 'websiteUrl', 'description']) if (k in body) upd[k] = body[k]
        upd.updatedAt = new Date()
        await db.collection('projects').updateOne({ id, userId: uid }, { $set: upd })
        return ok({ ok: true })
      }
      if (method === 'DELETE') {
        await db.collection('projects').deleteOne({ id, userId: uid })
        await db.collection('articles').updateMany({ userId: uid, projectId: id }, { $set: { projectId: null } })
        await db.collection('jobs').updateMany({ userId: uid, projectId: id }, { $set: { projectId: null } })
        return ok({ ok: true })
      }
    }

    // ============= JOBS =============
    if (route === '/jobs' && method === 'GET') {
      const uid = await requireAuth()
      if (!uid) return err('Unauthorized', 401)
      const db = await getDb()
      const jobs = await db.collection('jobs').find({ userId: uid }).sort({ createdAt: -1 }).limit(50).toArray()
      return ok(jobs.map(stripId))
    }

    // Job export (must be before /jobs/:id generic)
    const jobExportMatch = route.match(/^\/jobs\/([^/]+)\/export$/)
    if (jobExportMatch && method === 'GET') {
      const uid = await requireAuth()
      if (!uid) return err('Unauthorized', 401)
      const jobId = jobExportMatch[1]
      const url = new URL(request.url)
      const format = (url.searchParams.get('format') || 'html').toLowerCase()
      const db = await getDb()
      const job = await db.collection('jobs').findOne({ id: jobId, userId: uid })
      if (!job) return err('Not found', 404)
      const articles = await db.collection('articles').find({ jobId, userId: uid, status: 'completed' }).toArray()
      if (!articles.length) return err('No completed articles to export', 400)
      const buf = await zipArticles(articles, format)
      const fname = `${(job.name || 'bulk-export').replace(/[^a-z0-9-]+/gi, '-').slice(0, 60)}-${format}.zip`
      return new NextResponse(buf, { headers: { 'Content-Type': 'application/zip', 'Content-Disposition': `attachment; filename="${fname}"` } })
    }

    const jobActionMatch = route.match(/^\/jobs\/([^/]+)\/(pause|resume|retry-failed)$/)
    if (jobActionMatch && method === 'POST') {
      const uid = await requireAuth()
      if (!uid) return err('Unauthorized', 401)
      const jobId = jobActionMatch[1]
      const action = jobActionMatch[2]
      if (action === 'pause') { await pauseJob(uid, jobId); return ok({ ok: true, paused: true }) }
      if (action === 'resume') { await resumeJob(uid, jobId); return ok({ ok: true, paused: false }) }
      if (action === 'retry-failed') {
        const n = await retryFailedInJob(uid, jobId)
        return ok({ ok: true, retried: n })
      }
    }

    if (route.startsWith('/jobs/') && method === 'GET') {
      const uid = await requireAuth()
      if (!uid) return err('Unauthorized', 401)
      const jobId = route.split('/')[2]
      const db = await getDb()
      const job = await db.collection('jobs').findOne({ id: jobId, userId: uid })
      if (!job) return err('Job not found', 404)
      const articles = await db.collection('articles').find({ jobId, userId: uid }).project({ id: 1, primaryKeyword: 1, title: 1, status: 1, error: 1, createdAt: 1, completedAt: 1 }).toArray()
      return ok({ ...stripId(job), articles: articles.map(stripId) })
    }

    // ============= ARTICLES =============
    if (route === '/articles' && method === 'GET') {
      const uid = await requireAuth()
      if (!uid) return err('Unauthorized', 401)
      const url = new URL(request.url)
      const q = url.searchParams.get('q') || ''
      const status = url.searchParams.get('status') || ''
      const website = url.searchParams.get('website') || ''
      const projectId = url.searchParams.get('projectId') || ''
      const fromDate = url.searchParams.get('from') || ''
      const toDate = url.searchParams.get('to') || ''
      const groupBy = url.searchParams.get('groupBy') || ''
      const page = parseInt(url.searchParams.get('page') || '1', 10)
      const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10), 200)

      const filter = { userId: uid }
      if (q) filter.$or = [
        { primaryKeyword: { $regex: q, $options: 'i' } },
        { title: { $regex: q, $options: 'i' } },
      ]
      if (status) filter.status = status
      if (website) filter.websiteUrl = { $regex: website, $options: 'i' }
      if (projectId) filter.projectId = projectId === 'none' ? null : projectId
      if (fromDate || toDate) {
        filter.createdAt = {}
        if (fromDate) filter.createdAt.$gte = new Date(fromDate)
        if (toDate) filter.createdAt.$lte = new Date(toDate)
      }
      const db = await getDb()
      const total = await db.collection('articles').countDocuments(filter)
      const articles = await db.collection('articles').find(filter)
        .project({ markdown: 0, serpData: 0, schemaJsonLd: 0, sections: 0, faqs: 0 })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit).limit(limit).toArray()
      const items = articles.map(stripId)
      if (groupBy === 'website') {
        const groups = {}
        for (const a of items) {
          const key = (a.websiteUrl || 'No website').trim() || 'No website'
          if (!groups[key]) groups[key] = []
          groups[key].push(a)
        }
        return ok({ items, groups, total, page, limit })
      }
      return ok({ items, total, page, limit })
    }

    // Article rewrite (per-section + intro + cta + title + meta)
    const rewriteMatch = route.match(/^\/articles\/([^/]+)\/rewrite$/)
    if (rewriteMatch && method === 'POST') {
      const uid = await requireAuth()
      if (!uid) return err('Unauthorized', 401)
      const id = rewriteMatch[1]
      const body = await request.json()
      const { target, sectionIndex, operation, tone } = body
      // target: 'section' | 'intro' | 'cta' | 'title' | 'metaDescription'
      const db = await getDb()
      const article = await db.collection('articles').findOne({ id, userId: uid })
      if (!article) return err('Not found', 404)
      let originalText = ''
      let heading = ''
      if (target === 'section') {
        if (!Array.isArray(article.sections) || sectionIndex == null || !article.sections[sectionIndex]) return err('Invalid section', 400)
        originalText = article.sections[sectionIndex].content || ''
        heading = article.sections[sectionIndex].heading || ''
      } else if (target === 'intro') {
        originalText = article.introduction || ''
      } else if (target === 'cta') {
        originalText = article.cta || ''
      } else if (target === 'title') {
        originalText = article.title || ''
      } else if (target === 'metaDescription') {
        originalText = article.metaDescription || ''
      } else {
        return err('Invalid target', 400)
      }
      if (!originalText) return err('No content to rewrite', 400)
      try {
        const { text, tokenUsage, model } = await rewriteText({
          text: originalText, operation: operation || 'regenerate', tone,
          primaryKeyword: article.primaryKeyword,
          articleContext: (article.introduction || '') + '\n\n' + (article.sections || []).slice(0, 3).map(s => `${s.heading}: ${s.content?.slice(0, 200)}`).join('\n'),
          heading,
        })
        // Update article doc
        let update = {}
        const updatedArticle = { ...article }
        if (target === 'section') {
          const sections = [...article.sections]
          sections[sectionIndex] = { ...sections[sectionIndex], content: text }
          update.sections = sections
          updatedArticle.sections = sections
        } else if (target === 'intro') { update.introduction = text; updatedArticle.introduction = text }
        else if (target === 'cta') { update.cta = text; updatedArticle.cta = text }
        else if (target === 'title') { update.title = text; updatedArticle.title = text }
        else if (target === 'metaDescription') { update.metaDescription = text; updatedArticle.metaDescription = text }
        // Recompute markdown
        update.markdown = articleToMarkdown(updatedArticle)
        update.updatedAt = new Date()
        await db.collection('articles').updateOne({ id, userId: uid }, { $set: update, $push: { rewrites: { target, sectionIndex: sectionIndex ?? null, operation, tone: tone ?? null, at: new Date(), tokenUsage } } })
        return ok({ text, tokenUsage, model, target, sectionIndex: sectionIndex ?? null })
      } catch (e) {
        return err(e.message || 'Rewrite failed', 502)
      }
    }

    // Retry single article
    const retryMatch = route.match(/^\/articles\/([^/]+)\/retry$/)
    if (retryMatch && method === 'POST') {
      const uid = await requireAuth()
      if (!uid) return err('Unauthorized', 401)
      const id = retryMatch[1]
      const success = await retryArticle(uid, id)
      if (!success) return err('Cannot retry this article', 400)
      return ok({ ok: true })
    }

    // Article export
    const exportMatch = route.match(/^\/articles\/([^/]+)\/export$/)
    if (exportMatch && method === 'GET') {
      const uid = await requireAuth()
      if (!uid) return err('Unauthorized', 401)
      const id = exportMatch[1]
      const url = new URL(request.url)
      const format = (url.searchParams.get('format') || 'html').toLowerCase()
      const db = await getDb()
      const article = await db.collection('articles').findOne({ id, userId: uid })
      if (!article) return err('Not found', 404)
      const slug = article.slug || 'article'
      if (format === 'markdown' || format === 'md') {
        return new NextResponse(toMarkdown(article), { headers: { 'Content-Type': 'text/markdown; charset=utf-8', 'Content-Disposition': `attachment; filename="${slug}.md"` } })
      }
      if (format === 'txt') {
        return new NextResponse(toText(article), { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Content-Disposition': `attachment; filename="${slug}.txt"` } })
      }
      if (format === 'docx') {
        const buf = await toDocx(article)
        return new NextResponse(buf, { headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'Content-Disposition': `attachment; filename="${slug}.docx"` } })
      }
      return new NextResponse(toHtml(article), { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Content-Disposition': `attachment; filename="${slug}.html"` } })
    }

    const articleMatch = route.match(/^\/articles\/([^/]+)$/)
    if (articleMatch) {
      const uid = await requireAuth()
      if (!uid) return err('Unauthorized', 401)
      const id = articleMatch[1]
      const db = await getDb()
      if (method === 'GET') {
        const article = await db.collection('articles').findOne({ id, userId: uid })
        if (!article) return err('Not found', 404)
        return ok(stripId(article))
      }
      if (method === 'PUT' || method === 'PATCH') {
        const body = await request.json()
        const allowed = ['title', 'metaDescription', 'h1', 'slug', 'introduction', 'sections', 'faqs', 'cta', 'markdown', 'keywords', 'projectId']
        const update = {}
        for (const k of allowed) if (k in body) update[k] = body[k]
        // Recompute markdown if structure fields changed
        if ('introduction' in update || 'sections' in update || 'cta' in update || 'h1' in update || 'title' in update || 'metaDescription' in update || 'faqs' in update) {
          const existing = await db.collection('articles').findOne({ id, userId: uid })
          const merged = { ...existing, ...update }
          update.markdown = articleToMarkdown(merged)
        }
        update.updatedAt = new Date()
        await db.collection('articles').updateOne({ id, userId: uid }, { $set: update })
        const article = await db.collection('articles').findOne({ id, userId: uid })
        return ok(stripId(article))
      }
      if (method === 'DELETE') {
        await db.collection('articles').deleteOne({ id, userId: uid })
        return ok({ ok: true })
      }
    }

    return err(`Route ${method} ${route} not found`, 404)
  } catch (e) {
    console.error('[api] error', route, e)
    return err(e.message || 'Internal server error', 500)
  }
}

export const GET = handle
export const POST = handle
export const PUT = handle
export const PATCH = handle
export const DELETE = handle
