import * as cheerio from 'cheerio'

const SERPER_URL = 'https://google.serper.dev/search'
const FETCH_TIMEOUT_MS = 8000
const MAX_OUTLINES = 4

export async function searchSerper({ query, country = 'us', language = 'en', num = 10 }) {
  const apiKey = process.env.SERPER_API_KEY
  if (!apiKey || apiKey.includes('your-serper')) {
    throw new Error('SERPER_API_KEY not configured. Add it to /app/.env')
  }
  const res = await fetch(SERPER_URL, {
    method: 'POST',
    headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ q: query, gl: country, hl: language, num }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Serper API error ${res.status}: ${text}`)
  }
  return await res.json()
}

export async function analyzeKeyword({ keyword, country = 'us', language = 'en', deep = true }) {
  const data = await searchSerper({ query: keyword, country, language, num: 10 })

  const organic = (data.organic || []).slice(0, 10).map((r, i) => ({
    position: r.position || i + 1,
    title: r.title || '',
    link: r.link || '',
    snippet: r.snippet || '',
    sitelinks: (r.sitelinks || []).map(s => s.title),
  }))

  const peopleAlsoAsk = (data.peopleAlsoAsk || []).map(p => ({
    question: p.question, snippet: p.snippet, title: p.title, link: p.link,
  }))

  const relatedSearches = (data.relatedSearches || []).map(r => r.query)
  const knowledgeGraph = data.knowledgeGraph || null
  const answerBox = data.answerBox || null
  const intent = detectIntent(keyword, organic, peopleAlsoAsk)

  const bigDomains = ['wikipedia.org', 'amazon.com', 'youtube.com', 'reddit.com', 'forbes.com', 'nytimes.com', 'shopify.com', 'hubspot.com']
  const bigCount = organic.filter(o => bigDomains.some(d => o.link.includes(d))).length
  const difficulty = Math.min(100, 25 + bigCount * 10 + (organic.length > 0 ? 5 : 0))

  // Deep competitor analysis: fetch top 4 pages and extract H2/H3 outlines
  let competitorOutlines = []
  if (deep) {
    competitorOutlines = await extractCompetitorOutlines(organic.slice(0, MAX_OUTLINES))
  }

  // Semantic terms: extract recurring non-stop words from titles + snippets + headings
  const semanticTerms = extractSemanticTerms({
    keyword,
    titles: organic.map(o => o.title),
    snippets: organic.map(o => o.snippet),
    headings: competitorOutlines.flatMap(c => c.headings.map(h => h.text)),
    paa: peopleAlsoAsk.map(p => p.question),
    related: relatedSearches,
  })

  return {
    keyword, country, language, organic, peopleAlsoAsk, relatedSearches,
    knowledgeGraph, answerBox, intent, difficulty,
    competitorOutlines, semanticTerms,
    fetchedAt: new Date().toISOString(),
  }
}

async function extractCompetitorOutlines(organicTop) {
  const results = await Promise.allSettled(organicTop.map(o => fetchAndExtract(o.link, o.title)))
  const out = []
  for (const r of results) {
    if (r.status === 'fulfilled' && r.value && r.value.headings.length) out.push(r.value)
  }
  return out
}

async function fetchAndExtract(url, fallbackTitle) {
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS)
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SEOForgeBot/1.0; +https://seoforge.ai/bot)',
        'Accept': 'text/html,application/xhtml+xml',
      },
    })
    clearTimeout(t)
    if (!res.ok) return null
    const ct = res.headers.get('content-type') || ''
    if (!ct.includes('text/html')) return null
    const html = await res.text()
    const $ = cheerio.load(html)
    // Remove nav/footer/aside
    $('nav,footer,aside,header,script,style,noscript').remove()
    const headings = []
    $('h1,h2,h3').each((_, el) => {
      const tag = el.tagName.toLowerCase()
      const text = $(el).text().trim().replace(/\s+/g, ' ')
      if (text && text.length > 4 && text.length < 200) {
        headings.push({ tag, text })
      }
    })
    const title = ($('title').first().text() || fallbackTitle || '').trim()
    let hostname = ''
    try { hostname = new URL(url).hostname.replace(/^www\./, '') } catch {}
    return {
      url, hostname, title,
      headings: headings.slice(0, 25),
    }
  } catch (e) {
    return null
  }
}

const STOP_WORDS = new Set(['the','a','an','and','or','but','of','in','on','for','with','to','from','as','at','by','is','are','was','were','be','been','being','have','has','had','do','does','did','will','would','should','could','can','may','might','must','that','this','these','those','it','its','their','they','them','our','your','my','i','you','he','she','we','us','what','when','where','who','which','how','why','if','than','then','so','also','more','most','some','any','all','no','not','about','into','out','up','down','best','top','vs','versus','guide','review','reviews','how-to','tips','2024','2025','2026'])

function extractSemanticTerms({ keyword, titles, snippets, headings, paa, related }) {
  const text = [titles.join(' '), snippets.join(' '), headings.join(' '), paa.join(' '), related.join(' ')].join(' ').toLowerCase()
  const words = text.match(/[a-z][a-z\-']{2,}/g) || []
  const keywordTokens = new Set(keyword.toLowerCase().split(/\s+/))
  const freq = new Map()
  for (const w of words) {
    if (STOP_WORDS.has(w)) continue
    if (keywordTokens.has(w)) continue
    if (w.length < 4) continue
    freq.set(w, (freq.get(w) || 0) + 1)
  }
  // also bigrams
  for (let i = 0; i < words.length - 1; i++) {
    const a = words[i], b = words[i + 1]
    if (STOP_WORDS.has(a) || STOP_WORDS.has(b)) continue
    if (a.length < 3 || b.length < 3) continue
    const bg = `${a} ${b}`
    freq.set(bg, (freq.get(bg) || 0) + 1)
  }
  return [...freq.entries()].filter(([k, v]) => v >= 2).sort((a, b) => b[1] - a[1]).slice(0, 25).map(([k]) => k)
}

function detectIntent(keyword, organic, paa) {
  const k = keyword.toLowerCase()
  if (/\b(buy|best|price|cheap|deal|discount|review|vs|coupon|near me)\b/.test(k)) return 'commercial'
  if (/\b(how|what|why|when|where|guide|tutorial|tips|examples)\b/.test(k)) return 'informational'
  if (/\b(login|sign in|download|app|tool)\b/.test(k)) return 'navigational'
  if (/\b(buy now|order|checkout|purchase|subscribe)\b/.test(k)) return 'transactional'
  const allTitles = organic.map(o => o.title.toLowerCase()).join(' ')
  if (/best|review|top|comparison/.test(allTitles)) return 'commercial'
  if (/how|guide|tutorial|tips/.test(allTitles)) return 'informational'
  return 'informational'
}
