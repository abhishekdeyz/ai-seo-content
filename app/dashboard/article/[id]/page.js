'use client'
import { useEffect, useState, useMemo } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger } from '@/components/ui/dropdown-menu'
import { ArrowLeft, Loader2, Download, Copy, Save, FileText, Code, Search, Wand2, RefreshCw, ChevronDown, Maximize2, Minimize2, Type, Sparkles, Megaphone, Eye, Plus, Trash2, RotateCw } from 'lucide-react'
import { toast } from 'sonner'
import { marked } from 'marked'

const REWRITE_OPS = [
  { key: 'regenerate', label: 'Regenerate section', icon: RefreshCw, desc: 'Fresh angle, same intent' },
  { key: 'readability', label: 'Improve readability', icon: Eye, desc: 'Simpler, clearer' },
  { key: 'expand', label: 'Expand section', icon: Maximize2, desc: 'More depth, examples' },
  { key: 'shorten', label: 'Shorten section', icon: Minimize2, desc: 'Tighten, remove fluff' },
  { key: 'seo', label: 'SEO optimization rewrite', icon: Sparkles, desc: 'Strong semantic SEO' },
  { key: 'humanize', label: 'Humanize rewrite', icon: Wand2, desc: 'Anti-AI tone, varied rhythm' },
]
const TONE_OPTIONS = ['professional', 'conversational', 'authoritative', 'friendly', 'persuasive', 'journalistic', 'witty', 'empathetic']

export default function ArticlePage() {
  const { id } = useParams()
  const [article, setArticle] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [rewriting, setRewriting] = useState(null)
  // Editor state - structured
  const [draft, setDraft] = useState(null)

  async function load(silent) {
    if (!silent) setLoading(true)
    const res = await fetch('/api/articles/' + id)
    if (!res.ok) { setLoading(false); return }
    const data = await res.json()
    setArticle(data)
    if (!draft || data.status !== 'completed') {
      setDraft({
        title: data.title || '',
        metaDescription: data.metaDescription || '',
        h1: data.h1 || '',
        introduction: data.introduction || '',
        sections: Array.isArray(data.sections) ? data.sections : [],
        faqs: Array.isArray(data.faqs) ? data.faqs : [],
        cta: data.cta || '',
      })
    }
    setLoading(false)
  }

  useEffect(() => {
    load()
    const t = setInterval(() => {
      if (article && (article.status === 'completed' || article.status === 'failed')) return
      load(true)
    }, 3000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, article?.status])

  const previewMarkdown = useMemo(() => {
    if (!draft) return ''
    const parts = []
    parts.push(`# ${draft.h1 || draft.title || ''}`)
    if (draft.metaDescription) parts.push(`> ${draft.metaDescription}`)
    parts.push('')
    parts.push(draft.introduction || '')
    parts.push('')
    for (const s of draft.sections) {
      parts.push(`${'#'.repeat(s.level || 2)} ${s.heading}`)
      parts.push('')
      parts.push(s.content || '')
      parts.push('')
    }
    if ((draft.faqs || []).length) {
      parts.push('## Frequently Asked Questions')
      for (const f of draft.faqs) { parts.push(`### ${f.question}`); parts.push(f.answer || '') }
    }
    if (draft.cta) { parts.push('## Get Started'); parts.push(draft.cta) }
    return parts.join('\n')
  }, [draft])

  async function save() {
    if (!draft) return
    setSaving(true)
    try {
      const res = await fetch('/api/articles/' + id, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      })
      if (res.ok) { toast.success('Saved'); const data = await res.json(); setArticle(data) }
      else toast.error('Save failed')
    } finally { setSaving(false) }
  }

  async function rewrite({ target, sectionIndex, operation, tone }) {
    const key = `${target}-${sectionIndex ?? ''}-${operation}`
    setRewriting(key)
    try {
      const res = await fetch(`/api/articles/${id}/rewrite`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target, sectionIndex, operation, tone }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Rewrite failed')
      // Apply locally
      setDraft(d => {
        const next = { ...d }
        if (target === 'section') {
          next.sections = next.sections.map((s, i) => i === sectionIndex ? { ...s, content: data.text } : s)
        } else if (target === 'intro') next.introduction = data.text
        else if (target === 'cta') next.cta = data.text
        else if (target === 'title') next.title = data.text
        else if (target === 'metaDescription') next.metaDescription = data.text
        return next
      })
      toast.success(`${operation === 'regenerate' ? 'Regenerated' : 'Rewritten'} (≈${data.tokenUsage?.total_tokens || '?'} tokens)`)
    } catch (e) { toast.error(e.message) } finally { setRewriting(null) }
  }

  async function retryGen() {
    const res = await fetch(`/api/articles/${id}/retry`, { method: 'POST' })
    if (res.ok) { toast.success('Re-queued'); load() }
    else toast.error('Could not retry')
  }

  function copyContent() { navigator.clipboard.writeText(previewMarkdown); toast.success('Copied') }

  function addSection() { setDraft(d => ({ ...d, sections: [...d.sections, { heading: 'New section', level: 2, content: '' }] })) }
  function removeSection(i) { setDraft(d => ({ ...d, sections: d.sections.filter((_, idx) => idx !== i) })) }
  function moveSection(i, dir) {
    setDraft(d => {
      const arr = [...d.sections]
      const j = i + dir
      if (j < 0 || j >= arr.length) return d
      ;[arr[i], arr[j]] = [arr[j], arr[i]]
      return { ...d, sections: arr }
    })
  }

  if (loading) return <div className="p-10"><Skeleton className="h-8 w-64 mb-4" /><Skeleton className="h-96 w-full" /></div>
  if (!article) return <div className="p-10">Article not found</div>

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto">
      <Button asChild variant="ghost" size="sm" className="mb-4"><Link href="/dashboard/history"><ArrowLeft className="h-4 w-4 mr-1" /> Back</Link></Button>
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline">{article.status}</Badge>
            {article.structureVariant && <Badge variant="secondary" className="text-xs">{article.structureVariant}</Badge>}
            {article.primaryKeyword && <span className="text-sm text-muted-foreground">{article.primaryKeyword}</span>}
          </div>
          <h1 className="text-2xl font-bold truncate">{draft?.title || article.primaryKeyword}</h1>
        </div>
        {article.status === 'completed' && (
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={copyContent}><Copy className="h-4 w-4 mr-1" /> Copy</Button>
            <ExportButton id={id} format="html" label="HTML" />
            <ExportButton id={id} format="markdown" label="MD" />
            <ExportButton id={id} format="docx" label="DOCX" />
            <ExportButton id={id} format="txt" label="TXT" />
            <Button onClick={save} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />} Save</Button>
          </div>
        )}
        {article.status === 'failed' && (
          <Button onClick={retryGen} variant="outline" size="sm"><RotateCw className="h-4 w-4 mr-1" /> Retry generation</Button>
        )}
      </div>

      {article.status !== 'completed' && article.status !== 'failed' && (
        <Card className="p-10 text-center">
          <Loader2 className="h-8 w-8 mx-auto animate-spin text-primary mb-3" />
          <h3 className="font-semibold">{article.status === 'processing' ? 'Generating article…' : 'Queued'}</h3>
          <p className="text-sm text-muted-foreground mt-1">This usually takes 20-40 seconds. The page will refresh automatically.</p>
        </Card>
      )}

      {article.status === 'failed' && (
        <Card className="p-6 border-red-500/30 bg-red-500/5">
          <h3 className="font-semibold text-red-500">Generation failed</h3>
          <p className="text-sm text-muted-foreground mt-1">{article.error || 'Unknown error.'}</p>
        </Card>
      )}

      {article.status === 'completed' && draft && (
        <Tabs defaultValue="editor">
          <TabsList className="mb-4">
            <TabsTrigger value="editor"><FileText className="h-4 w-4 mr-2" /> Editor</TabsTrigger>
            <TabsTrigger value="preview"><Code className="h-4 w-4 mr-2" /> Preview</TabsTrigger>
            <TabsTrigger value="serp"><Search className="h-4 w-4 mr-2" /> SERP report</TabsTrigger>
            <TabsTrigger value="meta">SEO meta</TabsTrigger>
          </TabsList>
          <TabsContent value="editor" className="space-y-4">
            {/* Title + Meta */}
            <Card className="p-6 space-y-4">
              <BlockHeader title="Title & Meta" />
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Title</Label>
                  <RewriteMenu loading={rewriting} target="title" onRewrite={(op, tone) => rewrite({ target: 'title', operation: op, tone })} compact />
                </div>
                <Input value={draft.title} onChange={e => setDraft(d => ({ ...d, title: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Meta description</Label>
                  <RewriteMenu loading={rewriting} target="metaDescription" onRewrite={(op, tone) => rewrite({ target: 'metaDescription', operation: op, tone })} compact />
                </div>
                <Textarea value={draft.metaDescription} onChange={e => setDraft(d => ({ ...d, metaDescription: e.target.value }))} rows={2} />
              </div>
            </Card>

            {/* Intro */}
            <Card className="p-6 space-y-3">
              <div className="flex items-center justify-between">
                <BlockHeader title="Introduction" icon={Type} />
                <RewriteMenu loading={rewriting} target="intro" onRewrite={(op, tone) => rewrite({ target: 'intro', operation: op, tone })} />
              </div>
              <Textarea value={draft.introduction} onChange={e => setDraft(d => ({ ...d, introduction: e.target.value }))} rows={8} className="font-mono text-sm" />
            </Card>

            {/* Sections */}
            {draft.sections.map((s, i) => (
              <Card key={i} className="p-6 space-y-3">
                <div className="flex items-start gap-3 flex-wrap">
                  <Input value={s.heading} onChange={e => setDraft(d => ({ ...d, sections: d.sections.map((sec, idx) => idx === i ? { ...sec, heading: e.target.value } : sec) }))} className="flex-1 font-semibold text-base" placeholder={`H${s.level || 2} heading`} />
                  <div className="flex gap-1">
                    <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => moveSection(i, -1)} title="Move up"><ChevronDown className="h-4 w-4 rotate-180" /></Button>
                    <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => moveSection(i, 1)} title="Move down"><ChevronDown className="h-4 w-4" /></Button>
                    <Button variant="outline" size="icon" className="h-9 w-9 text-red-500" onClick={() => removeSection(i)} title="Remove"><Trash2 className="h-4 w-4" /></Button>
                    <RewriteMenu loading={rewriting} target="section" sectionIndex={i} onRewrite={(op, tone) => rewrite({ target: 'section', sectionIndex: i, operation: op, tone })} />
                  </div>
                </div>
                <Textarea value={s.content} onChange={e => setDraft(d => ({ ...d, sections: d.sections.map((sec, idx) => idx === i ? { ...sec, content: e.target.value } : sec) }))} rows={10} className="font-mono text-sm" />
              </Card>
            ))}
            <Button variant="outline" onClick={addSection} className="w-full"><Plus className="h-4 w-4 mr-2" /> Add section</Button>

            {/* CTA */}
            <Card className="p-6 space-y-3">
              <div className="flex items-center justify-between">
                <BlockHeader title="Call to action" icon={Megaphone} />
                <RewriteMenu loading={rewriting} target="cta" onRewrite={(op, tone) => rewrite({ target: 'cta', operation: op === 'regenerate' ? 'cta' : op, tone })} includeCtaOp />
              </div>
              <Textarea value={draft.cta} onChange={e => setDraft(d => ({ ...d, cta: e.target.value }))} rows={5} className="font-mono text-sm" />
            </Card>
          </TabsContent>

          <TabsContent value="preview">
            <Card className="p-8">
              <article className="prose prose-invert max-w-none dark:prose-invert" dangerouslySetInnerHTML={{ __html: marked.parse(previewMarkdown || '') }} />
            </Card>
          </TabsContent>
          <TabsContent value="serp">
            <Card className="p-6">{article.serpData ? <SerpReport data={article.serpData} /> : <p className="text-muted-foreground">No SERP data captured.</p>}</Card>
          </TabsContent>
          <TabsContent value="meta">
            <Card className="p-6 space-y-4 text-sm">
              <Row label="Slug" value={<div className="font-mono">{article.slug}</div>} />
              <Row label="Structure variant" value={<Badge variant="secondary">{article.structureVariant || 'classic'}</Badge>} />
              <Row label="Keywords" value={<div className="flex gap-1 flex-wrap mt-1">{(article.keywords || []).map(k => <Badge key={k} variant="secondary">{k}</Badge>)}</div>} />
              <Row label="Token usage" value={<div className="font-mono text-xs">{JSON.stringify(article.tokenUsage || {})}</div>} />
              <Row label="Rewrites applied" value={<div className="text-xs text-muted-foreground">{(article.rewrites || []).length} rewrite{(article.rewrites || []).length === 1 ? '' : 's'}</div>} />
              <Row label="Schema (JSON-LD)" value={<pre className="text-xs p-3 bg-muted/40 rounded overflow-auto">{JSON.stringify(article.schemaJsonLd, null, 2)}</pre>} />
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}

function Row({ label, value }) {
  return <div><div className="text-xs text-muted-foreground uppercase">{label}</div><div className="mt-1">{value}</div></div>
}

function BlockHeader({ title, icon: Icon }) {
  return <div className="flex items-center gap-2 text-sm uppercase tracking-wider text-muted-foreground">{Icon ? <Icon className="h-4 w-4" /> : null} {title}</div>
}

function RewriteMenu({ onRewrite, loading, target, sectionIndex, compact, includeCtaOp }) {
  const key = `${target}-${sectionIndex ?? ''}`
  const isLoading = loading && loading.startsWith(key)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size={compact ? 'sm' : 'sm'} disabled={isLoading}>
          {isLoading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Wand2 className="h-4 w-4 mr-1" />} AI rewrite <ChevronDown className="h-3 w-3 ml-1" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>AI rewrite</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {REWRITE_OPS.map(op => (
          <DropdownMenuItem key={op.key} onClick={() => onRewrite(op.key)}>
            <op.icon className="h-4 w-4 mr-2" />
            <div className="flex flex-col">
              <span>{op.label}</span>
              <span className="text-xs text-muted-foreground">{op.desc}</span>
            </div>
          </DropdownMenuItem>
        ))}
        {includeCtaOp && (
          <DropdownMenuItem onClick={() => onRewrite('cta')}>
            <Megaphone className="h-4 w-4 mr-2" />
            <div className="flex flex-col"><span>CTA rewrite</span><span className="text-xs text-muted-foreground">High-converting CTA</span></div>
          </DropdownMenuItem>
        )}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger><Type className="h-4 w-4 mr-2" /> Change tone</DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            {TONE_OPTIONS.map(t => (
              <DropdownMenuItem key={t} onClick={() => onRewrite('tone', t)} className="capitalize">{t}</DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function ExportButton({ id, format, label }) {
  return <Button asChild variant="outline" size="sm"><a href={`/api/articles/${id}/export?format=${format}`} target="_blank"><Download className="h-4 w-4 mr-1" /> {label}</a></Button>
}

function SerpReport({ data }) {
  return (
    <div className="space-y-6 text-sm">
      <div className="flex gap-2 flex-wrap">
        <Badge variant="outline">Intent: {data.intent}</Badge>
        <Badge variant="outline">Difficulty: {data.difficulty}/100</Badge>
        <Badge variant="outline">{data.country?.toUpperCase()} · {data.language}</Badge>
      </div>
      <div>
        <h4 className="font-semibold mb-2">Top 10 organic results</h4>
        <div className="space-y-2">{(data.organic || []).map((o, i) => (
          <div key={i} className="p-3 rounded border border-border/50 bg-muted/30">
            <div className="text-xs text-muted-foreground">#{o.position} · {o.link}</div>
            <div className="font-medium">{o.title}</div>
            <div className="text-xs text-muted-foreground mt-1">{o.snippet}</div>
          </div>
        ))}</div>
      </div>
      {(data.competitorOutlines || []).length > 0 && (
        <div>
          <h4 className="font-semibold mb-2">Competitor outlines (scraped headings)</h4>
          <div className="space-y-3">
            {data.competitorOutlines.map((c, i) => (
              <div key={i} className="p-3 rounded border border-border/50 bg-muted/20">
                <div className="text-xs text-muted-foreground mb-1">{c.hostname}</div>
                <div className="font-medium text-sm mb-2">{c.title}</div>
                <ul className="text-xs space-y-1">{c.headings.slice(0, 12).map((h, idx) => (
                  <li key={idx} className={`${h.tag === 'h2' ? '' : 'ml-4'} text-muted-foreground`}>{h.tag === 'h2' ? '▸' : '·'} {h.text}</li>
                ))}</ul>
              </div>
            ))}
          </div>
        </div>
      )}
      {(data.semanticTerms || []).length > 0 && (
        <div>
          <h4 className="font-semibold mb-2">Semantic terms detected</h4>
          <div className="flex flex-wrap gap-1">
            {data.semanticTerms.map((t, i) => <Badge key={i} variant="secondary" className="font-normal text-xs">{t}</Badge>)}
          </div>
        </div>
      )}
      {(data.peopleAlsoAsk || []).length > 0 && (
        <div>
          <h4 className="font-semibold mb-2">People also ask</h4>
          <ul className="space-y-1 list-disc list-inside text-muted-foreground">
            {data.peopleAlsoAsk.map((p, i) => <li key={i}>{p.question}</li>)}
          </ul>
        </div>
      )}
      {(data.relatedSearches || []).length > 0 && (
        <div>
          <h4 className="font-semibold mb-2">Related searches</h4>
          <div className="flex flex-wrap gap-1">
            {data.relatedSearches.map((r, i) => <Badge key={i} variant="secondary" className="font-normal">{r}</Badge>)}
          </div>
        </div>
      )}
    </div>
  )
}
