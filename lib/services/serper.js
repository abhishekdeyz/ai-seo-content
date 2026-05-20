// Serper API integration for SERP analysis
const SERPER_URL = 'https://google.serper.dev/search'

export async function searchSerper({ query, country = 'us', language = 'en', num = 10 }) {
  const apiKey = process.env.SERPER_API_KEY
  if (!apiKey || apiKey.includes('your-serper')) {
    throw new Error('SERPER_API_KEY not configured. Add it to /app/.env')
  }
  const res = await fetch(SERPER_URL, {
    method: 'POST',
    headers: {
      'X-API-KEY': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      q: query,
      gl: country,
      hl: language,
      num,
    }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Serper API error ${res.status}: ${text}`)
  }
  return await res.json()
}

/**
 * Analyze a keyword via Serper API and return structured SERP intelligence.
 */
export async function analyzeKeyword({ keyword, country = 'us', language = 'en' }) {
  const data = await searchSerper({ query: keyword, country, language, num: 10 })

  const organic = (data.organic || []).slice(0, 10).map((r, i) => ({
    position: r.position || i + 1,
    title: r.title || '',
    link: r.link || '',
    snippet: r.snippet || '',
    sitelinks: (r.sitelinks || []).map(s => s.title),
  }))

  const peopleAlsoAsk = (data.peopleAlsoAsk || []).map(p => ({
    question: p.question,
    snippet: p.snippet,
    title: p.title,
    link: p.link,
  }))

  const relatedSearches = (data.relatedSearches || []).map(r => r.query)

  const knowledgeGraph = data.knowledgeGraph || null
  const answerBox = data.answerBox || null

  // Heuristic intent detection
  const intent = detectIntent(keyword, organic, peopleAlsoAsk)

  // Heuristic keyword difficulty: based on presence of big domains
  const bigDomains = ['wikipedia.org', 'amazon.com', 'youtube.com', 'reddit.com', 'forbes.com', 'nytimes.com', 'shopify.com', 'hubspot.com']
  const bigCount = organic.filter(o => bigDomains.some(d => o.link.includes(d))).length
  const difficulty = Math.min(100, 25 + bigCount * 10 + (organic.length > 0 ? 5 : 0))

  // Extract competitor heading-like structure from titles (proxy)
  const competitorHeadings = organic.slice(0, 5).map(o => ({
    title: o.title,
    url: o.link,
  }))

  return {
    keyword,
    country,
    language,
    organic,
    peopleAlsoAsk,
    relatedSearches,
    knowledgeGraph,
    answerBox,
    intent,
    difficulty,
    competitorHeadings,
    fetchedAt: new Date().toISOString(),
  }
}

function detectIntent(keyword, organic, paa) {
  const k = keyword.toLowerCase()
  if (/\b(buy|best|price|cheap|deal|discount|review|vs|coupon|near me)\b/.test(k)) return 'commercial'
  if (/\b(how|what|why|when|where|guide|tutorial|tips|examples)\b/.test(k)) return 'informational'
  if (/\b(login|sign in|download|app|tool)\b/.test(k)) return 'navigational'
  if (/\b(buy now|order|checkout|purchase|subscribe)\b/.test(k)) return 'transactional'
  // Fallback heuristic from PAA and titles
  const allTitles = organic.map(o => o.title.toLowerCase()).join(' ')
  if (/best|review|top|comparison/.test(allTitles)) return 'commercial'
  if (/how|guide|tutorial|tips/.test(allTitles)) return 'informational'
  return 'informational'
}
