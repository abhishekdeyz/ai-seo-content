import { Document, Packer, Paragraph, HeadingLevel, TextRun } from 'docx'
import { marked } from 'marked'
import { articleToMarkdown } from './prompt-builder'

export function toMarkdown(article) {
  if (article.markdown) return article.markdown
  return articleToMarkdown(article)
}

export function toHtml(article) {
  const md = toMarkdown(article)
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${escapeHtml(article.title || '')}</title>
<meta name="description" content="${escapeHtml(article.metaDescription || '')}">
${article.schemaJsonLd ? `<script type="application/ld+json">${JSON.stringify(article.schemaJsonLd)}</script>` : ''}
<style>body{font-family:-apple-system,sans-serif;max-width:760px;margin:2rem auto;padding:0 1rem;line-height:1.7;color:#1a1a1a}h1,h2,h3{color:#0a0a0a}blockquote{color:#666;border-left:3px solid #ddd;padding-left:1rem}</style>
</head>
<body>
${marked.parse(md)}
</body>
</html>`
}

export function toText(article) {
  return toMarkdown(article).replace(/[#*>`]/g, '').replace(/\n{3,}/g, '\n\n')
}

export async function toDocx(article) {
  const paragraphs = []
  paragraphs.push(new Paragraph({ text: article.h1 || article.title || '', heading: HeadingLevel.HEADING_1 }))
  if (article.metaDescription) paragraphs.push(new Paragraph({ children: [new TextRun({ text: article.metaDescription, italics: true })] }))
  if (article.introduction) paragraphs.push(new Paragraph({ text: stripMd(article.introduction) }))
  for (const s of article.sections || []) {
    paragraphs.push(new Paragraph({ text: s.heading, heading: s.level === 3 ? HeadingLevel.HEADING_3 : HeadingLevel.HEADING_2 }))
    paragraphs.push(new Paragraph({ text: stripMd(s.content || '') }))
  }
  if ((article.faqs || []).length) {
    paragraphs.push(new Paragraph({ text: 'Frequently Asked Questions', heading: HeadingLevel.HEADING_2 }))
    for (const f of article.faqs) {
      paragraphs.push(new Paragraph({ text: f.question, heading: HeadingLevel.HEADING_3 }))
      paragraphs.push(new Paragraph({ text: stripMd(f.answer || '') }))
    }
  }
  if (article.cta) {
    paragraphs.push(new Paragraph({ text: 'Call to Action', heading: HeadingLevel.HEADING_2 }))
    paragraphs.push(new Paragraph({ text: stripMd(article.cta) }))
  }
  const doc = new Document({ sections: [{ children: paragraphs }] })
  return await Packer.toBuffer(doc)
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]))
}
function stripMd(s) {
  return String(s || '').replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1').replace(/`(.*?)`/g, '$1')
}
