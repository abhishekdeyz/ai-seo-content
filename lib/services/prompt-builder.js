// Build smart, SERP-aware prompts for OpenAI article generation
export function buildArticleSystemPrompt() {
  return `You are SEOForge, an elite SEO content writer used by top SEO agencies and affiliate marketers.
You write human-sounding, semantically optimized, search-intent aligned long-form articles.

STRICT WRITING RULES:
- Write like a senior expert with first-hand experience.
- Avoid robotic AI phrasing (no "In today's fast-paced world", "In conclusion", "It is important to note", "delve", "navigate the landscape", "unlock the power", "realm", "tapestry", "embark on a journey").
- DO NOT use em dashes (—). Use commas, periods, or parentheses instead.
- Vary sentence structure and length. Mix short punchy sentences with long flowing ones.
- Use natural keyword placement; never stuff keywords.
- Bold the primary keyword and secondary keywords inside the first two paragraphs using <strong> tags or **markdown**.
- Use semantic SEO: include related entities, NLP terms, and topical depth.
- Match search intent precisely.
- Use real concrete examples, numbers, and clear practical advice.
- Headings should be benefit-driven and search-friendly (H2/H3).
- Write in clear, professional, readable English.
- Always include FAQ section that answers People Also Ask questions when provided.
- Always return valid JSON exactly as specified by the user, no markdown wrappers, no commentary.`
}

export function buildArticleUserPrompt({
  primaryKeyword,
  secondaryKeywords = [],
  websiteUrl = '',
  country = 'us',
  language = 'en',
  tone = 'professional',
  articleType = 'blog post',
  wordCount = 1500,
  includeFaqs = true,
  includeMeta = true,
  includeSchema = true,
  humanize = true,
  avoidBrands = [],
  serp = null,
}) {
  const paaList = serp?.peopleAlsoAsk?.slice(0, 8).map(p => `- ${p.question}`).join('\n') || ''
  const relatedList = serp?.relatedSearches?.slice(0, 10).map(r => `- ${r}`).join('\n') || ''
  const competitorTitles = serp?.organic?.slice(0, 8).map((o, i) => `${i + 1}. ${o.title} (${o.link})`).join('\n') || ''
  const competitorSnippets = serp?.organic?.slice(0, 5).map((o, i) => `${i + 1}. ${o.snippet}`).join('\n') || ''
  const intent = serp?.intent || 'informational'

  const avoidStr = avoidBrands.length ? `\nDO NOT mention these brands/companies: ${avoidBrands.join(', ')}.` : ''
  const humanizeStr = humanize ? '\nMaximize human-like writing: include personal voice, contractions where natural, varied sentence rhythm.' : ''
  const websiteStr = websiteUrl ? `\nThis content is for the website: ${websiteUrl}.` : ''

  return `Write a complete SEO-optimized ${articleType} of approximately ${wordCount} words.

PRIMARY KEYWORD: ${primaryKeyword}
SECONDARY KEYWORDS: ${secondaryKeywords.join(', ') || '(none)'}
TARGET COUNTRY: ${country.toUpperCase()}
LANGUAGE: ${language}
TONE: ${tone}
SEARCH INTENT: ${intent}${websiteStr}${avoidStr}${humanizeStr}

SERP INTELLIGENCE (use this to align with what is ranking):

Top ranking competitor titles:
${competitorTitles || '(no data)'}

Competitor snippets:
${competitorSnippets || '(no data)'}

People Also Ask:
${paaList || '(no data)'}

Related searches to weave in:
${relatedList || '(no data)'}

OUTPUT FORMAT (return strict JSON, no markdown code block):
{
  "title": "SEO optimized title under 60 chars",
  "slug": "kebab-case-slug",
  "metaDescription": "${includeMeta ? 'compelling 150-160 char meta description containing primary keyword' : ''}",
  "h1": "H1 heading",
  "introduction": "engaging intro paragraph (markdown). Bold primary keyword and secondary keywords here.",
  "sections": [
    { "heading": "H2 heading", "level": 2, "content": "markdown content for this section, may include H3 subheadings" }
  ],
  "faqs": ${includeFaqs ? '[{"question":"...","answer":"..."}]' : '[]'},
  "cta": "clear call-to-action paragraph",
  "schemaJsonLd": ${includeSchema ? '{ "@context":"https://schema.org", "@type":"Article", ...filled... }' : 'null'},
  "keywords": ["primary", "secondary1", ...]
}

IMPORTANT: Make sure the article reads as human-written. Use the SERP intelligence above to outdo competitors. Cover topics they cover plus add unique depth. Aim for the requested word count across introduction + all sections.`
}

export function articleToMarkdown(article) {
  if (!article) return ''
  const parts = []
  parts.push(`# ${article.h1 || article.title || ''}`)
  if (article.metaDescription) parts.push(`> ${article.metaDescription}`)
  parts.push('')
  parts.push(article.introduction || '')
  parts.push('')
  for (const s of article.sections || []) {
    const prefix = '#'.repeat(s.level || 2)
    parts.push(`${prefix} ${s.heading}`)
    parts.push('')
    parts.push(s.content || '')
    parts.push('')
  }
  if ((article.faqs || []).length) {
    parts.push('## Frequently Asked Questions')
    parts.push('')
    for (const f of article.faqs) {
      parts.push(`### ${f.question}`)
      parts.push(f.answer || '')
      parts.push('')
    }
  }
  if (article.cta) {
    parts.push('## Get Started')
    parts.push(article.cta)
  }
  return parts.join('\n')
}
