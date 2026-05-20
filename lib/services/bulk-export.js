import JSZip from 'jszip'
import { toHtml, toMarkdown, toText, toDocx } from './article-export'

export async function zipArticles(articles, format = 'html') {
  const zip = new JSZip()
  const seen = new Map()
  for (const a of articles) {
    if (!a || a.status !== 'completed') continue
    let base = (a.slug || a.title || a.primaryKeyword || 'article').toString().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'article'
    const n = (seen.get(base) || 0) + 1
    seen.set(base, n)
    const name = n > 1 ? `${base}-${n}` : base
    if (format === 'markdown' || format === 'md') zip.file(`${name}.md`, toMarkdown(a))
    else if (format === 'txt') zip.file(`${name}.txt`, toText(a))
    else if (format === 'docx') zip.file(`${name}.docx`, await toDocx(a))
    else zip.file(`${name}.html`, toHtml(a))
  }
  return await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
}
