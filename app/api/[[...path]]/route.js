import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { v4 as uuidv4 } from 'uuid'
import { getDb, stripId } from '@/lib/mongo'
import { getCurrentUserId, getCurrentSession } from '@/lib/auth-helper'
import { analyzeKeyword } from '@/lib/services/serper'
import { enqueueArticle, createBulkJob, startWorkerOnce } from '@/lib/services/queue'
import { toHtml, toMarkdown, toText, toDocx } from '@/lib/services/article-export'

// CORS helper
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
  if (!uid) return null
  return uid
}

async function handle(request, { params }) {
  const { path = [] } = params
  const route = '/' + path.join('/')
  const method = request.method

  // Make sure worker is started (idempotent)
  startWorkerOnce()

  try {
    // Health
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
        id: uuidv4(),
        email: emailLc,
        name: name || emailLc.split('@')[0],
        passwordHash,
        role: 'user',
        credits: 100,
        plan: 'free',
        articlesGenerated: 0,
        createdAt: new Date(),
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
        credits: user?.credits || 0,
        plan: user?.plan || 'free',
        totalArticles,
        completedArticles: statusMap.completed,
        processingArticles: statusMap.processing + statusMap.queued,
        failedArticles: statusMap.failed,
        totalJobs: jobs,
        serpRequests: statusMap.completed + statusMap.processing,
        recent: recent.map(stripId),
      })
    }

    // ============= SERP =============
    if (route === '/serp/analyze' && method === 'POST') {
      const uid = await requireAuth()
      if (!uid) return err('Unauthorized', 401)
      const body = await request.json()
      const { keyword, country, language } = body
      if (!keyword) return err('keyword is required', 400)
      try {
        const data = await analyzeKeyword({ keyword, country: country || 'us', language: language || 'en' })
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
      const job = await createBulkJob({ userId: uid, name: body.name, rows, defaults: body.defaults || {} })
      return ok(stripId(job))
    }

    // ============= JOBS =============
    if (route === '/jobs' && method === 'GET') {
      const uid = await requireAuth()
      if (!uid) return err('Unauthorized', 401)
      const db = await getDb()
      const jobs = await db.collection('jobs').find({ userId: uid }).sort({ createdAt: -1 }).limit(50).toArray()
      return ok(jobs.map(stripId))
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
      const fromDate = url.searchParams.get('from') || ''
      const toDate = url.searchParams.get('to') || ''
      const page = parseInt(url.searchParams.get('page') || '1', 10)
      const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10), 100)

      const filter = { userId: uid }
      if (q) filter.$or = [
        { primaryKeyword: { $regex: q, $options: 'i' } },
        { title: { $regex: q, $options: 'i' } },
      ]
      if (status) filter.status = status
      if (website) filter.websiteUrl = { $regex: website, $options: 'i' }
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
        .skip((page - 1) * limit)
        .limit(limit)
        .toArray()
      return ok({ items: articles.map(stripId), total, page, limit })
    }

    // Article export (must be checked before generic article route)
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
      // default html
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
        const allowed = ['title', 'metaDescription', 'h1', 'slug', 'introduction', 'sections', 'faqs', 'cta', 'markdown', 'keywords']
        const update = {}
        for (const k of allowed) if (k in body) update[k] = body[k]
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
