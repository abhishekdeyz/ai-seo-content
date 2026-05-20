import OpenAI from 'openai'
import { buildArticleSystemPrompt, buildArticleUserPrompt } from './prompt-builder'

let client
function getClient() {
  if (!client) {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey || apiKey.includes('your-openai')) {
      throw new Error('OPENAI_API_KEY not configured. Add it to /app/.env')
    }
    client = new OpenAI({ apiKey })
  }
  return client
}

export async function generateArticleJSON(params) {
  const openai = getClient()
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini'
  const systemPrompt = buildArticleSystemPrompt()
  const userPrompt = buildArticleUserPrompt(params)

  // Use response_format json_object for guaranteed JSON
  const completion = await openai.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.7,
    response_format: { type: 'json_object' },
    max_tokens: 4000,
  })

  const content = completion.choices?.[0]?.message?.content || '{}'
  let parsed
  try {
    parsed = JSON.parse(content)
  } catch (e) {
    parsed = { error: 'parse_error', raw: content }
  }

  // Post-process to remove em dashes which sneak in
  const stripEmDash = (s) => typeof s === 'string' ? s.replace(/—/g, ', ').replace(/–/g, '-') : s
  if (parsed.introduction) parsed.introduction = stripEmDash(parsed.introduction)
  if (parsed.title) parsed.title = stripEmDash(parsed.title)
  if (parsed.metaDescription) parsed.metaDescription = stripEmDash(parsed.metaDescription)
  if (parsed.cta) parsed.cta = stripEmDash(parsed.cta)
  if (Array.isArray(parsed.sections)) {
    parsed.sections = parsed.sections.map(s => ({ ...s, content: stripEmDash(s.content), heading: stripEmDash(s.heading) }))
  }
  if (Array.isArray(parsed.faqs)) {
    parsed.faqs = parsed.faqs.map(f => ({ question: stripEmDash(f.question), answer: stripEmDash(f.answer) }))
  }

  return {
    article: parsed,
    tokenUsage: completion.usage || {},
    model,
  }
}
