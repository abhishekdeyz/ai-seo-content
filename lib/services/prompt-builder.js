// Build smart, SERP-aware prompts for OpenAI article generation
// Supports structure variants to avoid AI footprint in bulk runs.

export const STRUCTURE_VARIANTS = [
  {
    key: 'classic',
    label: 'Classic Article',
    instruction: 'Use a classic structure: hook intro → 5-7 H2 sections each with a clear sub-topic → FAQs → CTA. Vary H2 lengths.'
  },
  {
    key: 'listicle',
    label: 'Numbered Listicle',
    instruction: 'Use a numbered listicle structure: intro → N H2 sections each starting with a number and a benefit-driven phrase (e.g., "1. Lightweight foam improves fatigue resistance") → Summary section → FAQs.'
  },
  {
    key: 'problem_solution',
    label: 'Problem/Solution',
    instruction: 'Use a problem-solution structure: identify the pain in the intro → alternate between "The Problem" and "The Fix" H2 sections (3-4 pairs) → Summary → FAQs → CTA.'
  },
  {
    key: 'deep_dive',
    label: 'Deep Dive',
    instruction: 'Use a deep-dive structure: intro → 4-5 H2 sections, each with 2-3 H3 subheadings exploring nuance, data, examples → FAQs → CTA.'
  },
  {
    key: 'q_and_a',
    label: 'Q&A Driven',
    instruction: 'Use a Q&A structure: write H2 headings as direct questions taken from the SERP People Also Ask data when relevant → each section answers the question with concrete advice → close with FAQs and a CTA.'
  },
  {
    key: 'guide',
    label: 'Step-by-step Guide',
    instruction: 'Use a step-by-step guide structure: intro framing the outcome → H2 sections worded as steps ("Step 1: …") with action verbs → a "Common mistakes" section → FAQs → CTA.'
  },
  {
    key: 'comparison',
    label: 'Comparison',
    instruction: 'Use a comparison structure: intro framing the choice → H2 sections like "Option A overview", "Option B overview", "Side-by-side: feature X", "Side-by-side: pricing", "Verdict" → FAQs → CTA.'
  },
  {
    key: 'story_driven',
    label: 'Story-driven',
    instruction: 'Use a narrative structure: open with a short anecdote or scenario → break into 4-5 H2 lessons drawn from the story → a takeaway box section → FAQs → CTA.'
  },
]

export function pickStructureVariant(seed) {
  if (!seed) return STRUCTURE_VARIANTS[0]
  let hash = 0
  const s = String(seed)
  for (let i = 0; i < s.length; i++) { hash = ((hash << 5) - hash + s.charCodeAt(i)) | 0 }
  return STRUCTURE_VARIANTS[Math.abs(hash) % STRUCTURE_VARIANTS.length]
}

export function buildArticleSystemPrompt() {
  return `You are SEOForge, an elite SEO content writer used by top SEO agencies and affiliate marketers.
You write human-sounding, semantically optimized, search-intent aligned long-form articles.

STRICT WRITING RULES:
- Write like a senior expert with first-hand experience.
- Avoid robotic AI phrasing (no "In today's fast-paced world", "In conclusion", "It is important to note", "delve", "navigate the landscape", "unlock the power", "realm", "tapestry", "embark on a journey", "game-changer", "in the world of", "when it comes to", "the digital age").
- DO NOT use em dashes (—) or en dashes (–). Use commas, periods, or parentheses instead.
- Vary sentence structure and length. Mix short punchy sentences with long flowing ones. Avoid uniform paragraph rhythm.
- Use natural keyword placement; never stuff keywords.
- Bold the primary keyword and secondary keywords inside the first two paragraphs using **markdown** bold.
- Use semantic SEO: include related entities, NLP terms, and topical depth.
- Match search intent precisely.
- Use real concrete examples, numbers, and practical advice.
- Headings should be benefit-driven and search-friendly.
- Write in clear, professional, readable English.
- Always include FAQ section that answers People Also Ask questions when provided.
- Always return valid JSON exactly as specified, no markdown wrappers, no commentary.`
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
  variant = null,
}) {
  const paaList = serp?.peopleAlsoAsk?.slice(0, 8).map(p => `- ${p.question}`).join('\n') || ''
  const relatedList = serp?.relatedSearches?.slice(0, 10).map(r => `- ${r}`).join('\n') || ''
  const competitorTitles = serp?.organic?.slice(0, 8).map((o, i) => `${i + 1}. ${o.title} (${o.link})`).join('\n') || ''
  const competitorSnippets = serp?.organic?.slice(0, 5).map((o, i) => `${i + 1}. ${o.snippet}`).join('\n') || ''
  const competitorHeadings = serp?.competitorOutlines?.length
    ? serp.competitorOutlines.slice(0, 4).map((c, i) => `Competitor ${i + 1} (${c.hostname}):\n${c.headings.slice(0, 12).map(h => `  ${h.tag === 'h2' ? '•' : '  •'} ${h.text}`).join('\n')}`).join('\n\n')
    : ''
  const semanticTerms = serp?.semanticTerms?.length ? serp.semanticTerms.slice(0, 15).join(', ') : ''
  const intent = serp?.intent || 'informational'
  const structure = variant?.instruction || STRUCTURE_VARIANTS[0].instruction

  const avoidStr = avoidBrands.length ? `\nDO NOT mention these brands/companies: ${avoidBrands.join(', ')}.` : ''
  const humanizeStr = humanize ? '\nMaximize human-like writing: include personal voice, contractions where natural, varied sentence rhythm, and avoid formal AI tics.' : ''
  const websiteStr = websiteUrl ? `\nThis content is for the website: ${websiteUrl}.` : ''

  return `Write a complete SEO-optimized ${articleType} of approximately ${wordCount} words.

PRIMARY KEYWORD: ${primaryKeyword}
SECONDARY KEYWORDS: ${secondaryKeywords.join(', ') || '(none)'}
TARGET COUNTRY: ${country.toUpperCase()}
LANGUAGE: ${language}
TONE: ${tone}
SEARCH INTENT: ${intent}${websiteStr}${avoidStr}${humanizeStr}

ARTICLE STRUCTURE VARIANT (${variant?.label || 'Classic'}):
${structure}

SERP INTELLIGENCE (use this to align with what is ranking):

Top ranking competitor titles:
${competitorTitles || '(no data)'}

Competitor snippets:
${competitorSnippets || '(no data)'}

Competitor outlines (real H2/H3 headings scraped from ranking pages):
${competitorHeadings || '(no data)'}

People Also Ask:
${paaList || '(no data)'}

Related searches:
${relatedList || '(no data)'}

Semantic terms to naturally include:
${semanticTerms || '(none)'}

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

IMPORTANT: Follow the article STRUCTURE VARIANT instructions precisely. Make sure the article reads as human-written. Use the SERP intelligence above to outdo competitors. Cover topics they cover plus add unique depth. Aim for the requested word count across introduction + all sections.`
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

export function stripAiTics(s) {
  if (typeof s !== 'string') return s
  return s.replace(/—/g, ', ').replace(/–/g, '-')
}
