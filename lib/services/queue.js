// MongoDB-backed in-process job queue with concurrency control, rate-limit protection,
// pause/resume, and structure variant assignment.
import { getDb } from '../mongo'
import { analyzeKeyword } from './serper'
import { generateArticleJSON } from './openai'
import { articleToMarkdown, pickStructureVariant } from './prompt-builder'
import { v4 as uuidv4 } from 'uuid'

const CONCURRENCY = parseInt(process.env.QUEUE_CONCURRENCY || '3', 10)
const POLL_INTERVAL = 1500
const MAX_RETRIES = 2
const RATE_LIMIT_COOLDOWN_MS = 20000

let workerStarted = false
let activeJobs = 0
let rateLimitedUntil = 0

export function startWorkerOnce() {
  if (workerStarted) return
  workerStarted = true
  console.log('[queue] Starting worker, concurrency=', CONCURRENCY)
  setInterval(processBatch, POLL_INTERVAL).unref?.()
}

async function processBatch() {
  try {
    if (activeJobs >= CONCURRENCY) return
    if (Date.now() < rateLimitedUntil) return
    const slots = CONCURRENCY - activeJobs
    const db = await getDb()
    // Get list of paused job IDs so we skip their articles
    const pausedJobIds = (await db.collection('jobs').find({ paused: true }).project({ id: 1 }).toArray()).map(j => j.id)
    const filter = { status: 'queued', ...(pausedJobIds.length ? { $or: [{ jobId: { $nin: pausedJobIds } }, { jobId: null }] } : {}) }

    for (let i = 0; i < slots; i++) {
      const claimed = await db.collection('articles').findOneAndUpdate(
        filter,
        { $set: { status: 'processing', startedAt: new Date() } },
        { sort: { createdAt: 1 }, returnDocument: 'after' }
      )
      const doc = claimed?.value || claimed
      if (!doc || !doc.id) break
      activeJobs++
      runArticle(doc).finally(() => { activeJobs-- })
    }
  } catch (e) {
    console.error('[queue] processBatch error', e)
  }
}

async function runArticle(articleDoc) {
  const db = await getDb()
  const id = articleDoc.id
  const jobId = articleDoc.jobId
  try {
    const serp = await analyzeKeyword({
      keyword: articleDoc.primaryKeyword,
      country: articleDoc.country || 'us',
      language: articleDoc.language || 'en',
    })

    // Structure variant for bulk diversification
    const variant = articleDoc.structureVariant
      ? pickStructureVariant(articleDoc.structureVariant)
      : pickStructureVariant(jobId ? `${jobId}-${articleDoc.bulkIndex || 0}` : id)

    const { article, tokenUsage, model } = await generateArticleJSON({
      primaryKeyword: articleDoc.primaryKeyword,
      secondaryKeywords: articleDoc.secondaryKeywords || [],
      websiteUrl: articleDoc.websiteUrl || '',
      country: articleDoc.country || 'us',
      language: articleDoc.language || 'en',
      tone: articleDoc.tone || 'professional',
      articleType: articleDoc.articleType || 'blog post',
      wordCount: articleDoc.wordCount || 1500,
      includeFaqs: articleDoc.includeFaqs !== false,
      includeMeta: articleDoc.includeMeta !== false,
      includeSchema: articleDoc.includeSchema !== false,
      humanize: articleDoc.humanize !== false,
      avoidBrands: articleDoc.avoidBrands || [],
      serp,
      variant,
    })

    const markdown = articleToMarkdown(article)

    await db.collection('articles').updateOne(
      { id },
      {
        $set: {
          status: 'completed',
          title: article.title || articleDoc.primaryKeyword,
          slug: article.slug,
          metaDescription: article.metaDescription,
          h1: article.h1,
          introduction: article.introduction,
          sections: article.sections,
          faqs: article.faqs,
          cta: article.cta,
          schemaJsonLd: article.schemaJsonLd,
          keywords: article.keywords,
          markdown,
          serpData: serp,
          tokenUsage,
          model,
          structureVariant: variant.key,
          completedAt: new Date(),
          error: null,
        },
      }
    )

    await db.collection('users').updateOne({ id: articleDoc.userId }, { $inc: { credits: -1, articlesGenerated: 1 } })

    if (jobId) await updateJobProgress(db, jobId)
  } catch (err) {
    const status = err?.status || err?.response?.status
    const isRateLimit = status === 429
    if (isRateLimit) {
      rateLimitedUntil = Date.now() + RATE_LIMIT_COOLDOWN_MS
      console.warn('[queue] OpenAI rate-limited; cooling down for', RATE_LIMIT_COOLDOWN_MS, 'ms')
    }
    console.error('[queue] article failed', id, err.message)
    const retries = (articleDoc.retries || 0) + 1
    const failTerminal = retries > MAX_RETRIES
    await db.collection('articles').updateOne(
      { id },
      {
        $set: {
          status: failTerminal ? 'failed' : 'queued',
          error: err.message,
          retries,
          ...(failTerminal ? { completedAt: new Date() } : { startedAt: null }),
        },
      }
    )
    if (failTerminal && jobId) await updateJobProgress(db, jobId)
  }
}

async function updateJobProgress(db, jobId) {
  const counts = await db.collection('articles').aggregate([
    { $match: { jobId } },
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ]).toArray()
  const map = { queued: 0, processing: 0, completed: 0, failed: 0 }
  for (const c of counts) map[c._id] = c.count
  const total = map.queued + map.processing + map.completed + map.failed
  const done = map.completed + map.failed
  const status = done >= total ? 'completed' : 'processing'
  await db.collection('jobs').updateOne(
    { id: jobId },
    {
      $set: {
        completedArticles: map.completed,
        failedArticles: map.failed,
        processingArticles: map.processing,
        queuedArticles: map.queued,
        status,
        updatedAt: new Date(),
        ...(status === 'completed' ? { finishedAt: new Date() } : {}),
      },
    }
  )
}

export async function enqueueArticle(params) {
  const db = await getDb()
  const id = uuidv4()
  const doc = {
    id,
    userId: params.userId,
    jobId: params.jobId || null,
    projectId: params.projectId || null,
    websiteUrl: params.websiteUrl || '',
    primaryKeyword: params.primaryKeyword,
    secondaryKeywords: params.secondaryKeywords || [],
    country: params.country || 'us',
    language: params.language || 'en',
    tone: params.tone || 'professional',
    articleType: params.articleType || 'blog post',
    wordCount: params.wordCount || 1500,
    includeFaqs: params.includeFaqs !== false,
    includeMeta: params.includeMeta !== false,
    includeSchema: params.includeSchema !== false,
    humanize: params.humanize !== false,
    avoidBrands: params.avoidBrands || [],
    structureVariant: params.structureVariant || null,
    status: 'queued',
    retries: 0,
    createdAt: new Date(),
  }
  await db.collection('articles').insertOne(doc)
  startWorkerOnce()
  return id
}

export async function createBulkJob({ userId, name, rows, defaults, projectId }) {
  const db = await getDb()
  const jobId = uuidv4()
  const articles = rows.map((r, idx) => ({
    id: uuidv4(),
    userId,
    jobId,
    projectId: projectId || null,
    bulkIndex: idx,
    websiteUrl: r.website_url || r.websiteUrl || defaults.websiteUrl || '',
    primaryKeyword: r.primary_keyword || r.primaryKeyword,
    secondaryKeywords: parseSecondary(r.secondary_keywords || r.secondaryKeywords || defaults.secondaryKeywords),
    country: r.country || defaults.country || 'us',
    language: r.language || defaults.language || 'en',
    tone: r.tone || defaults.tone || 'professional',
    articleType: r.article_type || r.articleType || defaults.articleType || 'blog post',
    wordCount: parseInt(r.word_count || r.wordCount || defaults.wordCount || 1500, 10),
    includeFaqs: defaults.includeFaqs !== false,
    includeMeta: defaults.includeMeta !== false,
    includeSchema: defaults.includeSchema !== false,
    humanize: defaults.humanize !== false,
    avoidBrands: defaults.avoidBrands || [],
    status: 'queued',
    retries: 0,
    createdAt: new Date(),
  })).filter(a => a.primaryKeyword)

  const job = {
    id: jobId,
    userId,
    projectId: projectId || null,
    name: name || `Bulk job ${new Date().toISOString().slice(0,10)}`,
    totalArticles: articles.length,
    completedArticles: 0,
    failedArticles: 0,
    processingArticles: 0,
    queuedArticles: articles.length,
    paused: false,
    status: articles.length ? 'processing' : 'completed',
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  await db.collection('jobs').insertOne(job)
  if (articles.length) await db.collection('articles').insertMany(articles)
  startWorkerOnce()
  return job
}

export async function pauseJob(userId, jobId) {
  const db = await getDb()
  await db.collection('jobs').updateOne({ id: jobId, userId }, { $set: { paused: true, updatedAt: new Date() } })
}

export async function resumeJob(userId, jobId) {
  const db = await getDb()
  await db.collection('jobs').updateOne({ id: jobId, userId }, { $set: { paused: false, updatedAt: new Date() } })
  startWorkerOnce()
}

export async function retryFailedInJob(userId, jobId) {
  const db = await getDb()
  const result = await db.collection('articles').updateMany(
    { userId, jobId, status: 'failed' },
    { $set: { status: 'queued', error: null, retries: 0, startedAt: null } }
  )
  await updateJobProgress(db, jobId)
  startWorkerOnce()
  return result.modifiedCount
}

export async function retryArticle(userId, articleId) {
  const db = await getDb()
  const article = await db.collection('articles').findOne({ id: articleId, userId })
  if (!article) return false
  if (article.status !== 'failed' && article.status !== 'completed') return false
  await db.collection('articles').updateOne(
    { id: articleId, userId },
    { $set: { status: 'queued', error: null, retries: 0, startedAt: null } }
  )
  if (article.jobId) await updateJobProgress(db, article.jobId)
  startWorkerOnce()
  return true
}

function parseSecondary(val) {
  if (!val) return []
  if (Array.isArray(val)) return val
  return String(val).split(/[,;|]/).map(s => s.trim()).filter(Boolean)
}
