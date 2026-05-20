import OpenAI from 'openai'
import { buildArticleSystemPrompt, buildArticleUserPrompt, stripAiTics } from './prompt-builder'

let client
function getClient() {
  if (!client) {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey || apiKey.includes('your-openai')) {
      throw new Error('OPENAI_API_KEY not configured. Add it to /app/.env')
    }
    client = new OpenAI({ apiKey, maxRetries: 3 })
  }
  return client
}

// Manual exponential backoff wrapper for rate limit safety (429/5xx).
async function callOpenAI(fn, { tries = 5, baseMs = 800 } = {}) {
  let lastErr
  for (let i = 0; i < tries; i++) {
    try { return await fn() } catch (e) {
      lastErr = e
      const status = e?.status || e?.response?.status
      // Only retry on rate-limit/transient errors
      if (status === 429 || (status >= 500 && status <= 599)) {
        const wait = baseMs * Math.pow(2, i) + Math.random() * 400
        await new Promise(r => setTimeout(r, wait))
        continue
      }
      throw e
    }
  }
  throw lastErr
}

function sanitize(parsed) {
  if (parsed.introduction) parsed.introduction = stripAiTics(parsed.introduction)
  if (parsed.title) parsed.title = stripAiTics(parsed.title)
  if (parsed.metaDescription) parsed.metaDescription = stripAiTics(parsed.metaDescription)
  if (parsed.cta) parsed.cta = stripAiTics(parsed.cta)
  if (Array.isArray(parsed.sections)) {
    parsed.sections = parsed.sections.map(s => ({ ...s, content: stripAiTics(s.content), heading: stripAiTics(s.heading) }))
  }
  if (Array.isArray(parsed.faqs)) {
    parsed.faqs = parsed.faqs.map(f => ({ question: stripAiTics(f.question), answer: stripAiTics(f.answer) }))
  }
  return parsed
}

export async function generateArticleJSON(params) {
  const openai = getClient()
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini'
  const systemPrompt = buildArticleSystemPrompt()
  const userPrompt = buildArticleUserPrompt(params)

  const completion = await callOpenAI(() => openai.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.8,
    response_format: { type: 'json_object' },
    max_tokens: 4000,
  }))

  const content = completion.choices?.[0]?.message?.content || '{}'
  let parsed
  try { parsed = JSON.parse(content) } catch (e) { parsed = { error: 'parse_error', raw: content } }
  parsed = sanitize(parsed)
  return { article: parsed, tokenUsage: completion.usage || {}, model }
}

// Rewrite operations for sections / intro / cta / title / meta
const REWRITE_INSTRUCTIONS = {
  regenerate: 'Completely rewrite this section keeping the same heading and core intent but with new wording, examples, and angle. Make it more engaging and unique.',
  readability: 'Rewrite this section to improve readability. Shorten sentences, use simpler words, add line breaks, and use bullet points where helpful. Keep the meaning intact.',
  expand: 'Expand this section significantly by adding more depth: real-world examples, specific numbers, expert tips, and additional sub-points. Roughly double the length while staying on-topic.',
  shorten: 'Condense this section to about half the length. Keep the most valuable points and tighten the prose. Remove fluff.',
  seo: 'Rewrite this section with stronger semantic SEO. Naturally weave in the primary keyword and related entities. Improve heading clarity for search. Do NOT keyword-stuff.',
  humanize: 'Rewrite this section to sound more human. Add varied sentence rhythm, occasional contractions, first-person nuance, and concrete examples. Remove any AI-sounding phrasing or em dashes.',
  cta: 'Rewrite this as a high-converting CTA section. Use a clear value proposition, urgency where appropriate, and an action-oriented final line.',
  tone: 'Rewrite this section in the specified tone while preserving the structure and meaning.',
}

export async function rewriteText({ text, operation, tone, primaryKeyword, articleContext = '', heading = '' }) {
  const openai = getClient()
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini'
  const baseInstruction = REWRITE_INSTRUCTIONS[operation] || REWRITE_INSTRUCTIONS.regenerate
  const toneStr = tone && operation === 'tone' ? ` Target tone: ${tone}.` : ''
  const headingStr = heading ? `\nSECTION HEADING: "${heading}"` : ''
  const kwStr = primaryKeyword ? `\nPRIMARY KEYWORD (use naturally where relevant): ${primaryKeyword}` : ''
  const ctxStr = articleContext ? `\n\nARTICLE CONTEXT (do not include this in the output, only use for relevance):\n${articleContext.slice(0, 1500)}` : ''

  const system = `You are an elite SEO editor. You rewrite content keeping it human, varied, and SEO-aligned. NEVER use em dashes or en dashes. Avoid AI clichés. Return ONLY the rewritten markdown text, no commentary, no JSON.`
  const user = `${baseInstruction}${toneStr}${headingStr}${kwStr}${ctxStr}\n\nORIGINAL TEXT:\n"""\n${text}\n"""\n\nReturn ONLY the rewritten markdown content (no heading prefix unless it was in the original).`

  const completion = await callOpenAI(() => openai.chat.completions.create({
    model,
    messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
    temperature: 0.8,
    max_tokens: 2000,
  }))
  const out = completion.choices?.[0]?.message?.content?.trim() || ''
  return { text: stripAiTics(out).replace(/^```[a-z]*\n?|```$/g, '').trim(), tokenUsage: completion.usage || {}, model }
}
