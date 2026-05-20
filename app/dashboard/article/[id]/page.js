'use client'
import { useEffect, useState } from 'react'
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
import { ArrowLeft, Loader2, Download, Copy, Save, FileText, Code, Search } from 'lucide-react'
import { toast } from 'sonner'
import { marked } from 'marked'

export default function ArticlePage() {
  const { id } = useParams()
  const [article, setArticle] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editor, setEditor] = useState({ title: '', metaDescription: '', markdown: '' })

  async function load() {
    const res = await fetch('/api/articles/' + id)
    if (!res.ok) { setLoading(false); return }
    const data = await res.json()
    setArticle(data)
    setEditor({ title: data.title || '', metaDescription: data.metaDescription || '', markdown: data.markdown || '' })
    setLoading(false)
  }

  useEffect(() => {
    load()
    const t = setInterval(() => {
      if (article && (article.status === 'completed' || article.status === 'failed')) return
      load()
    }, 3000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, article?.status])

  async function save() {
    setSaving(true)
    try {
      const res = await fetch('/api/articles/' + id, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editor),
      })
      if (res.ok) toast.success('Saved')
      else toast.error('Save failed')
    } finally { setSaving(false) }
  }

  function copyContent() {
    navigator.clipboard.writeText(editor.markdown)
    toast.success('Copied to clipboard')
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
            {article.primaryKeyword && <span className="text-sm text-muted-foreground">{article.primaryKeyword}</span>}
          </div>
          <h1 className="text-2xl font-bold truncate">{article.title || article.primaryKeyword}</h1>
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

      {article.status === 'completed' && (
        <Tabs defaultValue="editor">
          <TabsList className="mb-4">
            <TabsTrigger value="editor"><FileText className="h-4 w-4 mr-2" /> Editor</TabsTrigger>
            <TabsTrigger value="preview"><Code className="h-4 w-4 mr-2" /> Preview</TabsTrigger>
            <TabsTrigger value="serp"><Search className="h-4 w-4 mr-2" /> SERP report</TabsTrigger>
            <TabsTrigger value="meta">SEO meta</TabsTrigger>
          </TabsList>
          <TabsContent value="editor">
            <Card className="p-6 space-y-4">
              <div className="space-y-2">
                <Label>Title</Label>
                <Input value={editor.title} onChange={e => setEditor(s => ({ ...s, title: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Meta description</Label>
                <Textarea value={editor.metaDescription} onChange={e => setEditor(s => ({ ...s, metaDescription: e.target.value }))} rows={2} />
              </div>
              <div className="space-y-2">
                <Label>Content (Markdown)</Label>
                <Textarea value={editor.markdown} onChange={e => setEditor(s => ({ ...s, markdown: e.target.value }))} rows={28} className="font-mono text-sm" />
              </div>
            </Card>
          </TabsContent>
          <TabsContent value="preview">
            <Card className="p-8">
              <article className="prose prose-invert max-w-none dark:prose-invert" dangerouslySetInnerHTML={{ __html: marked.parse(editor.markdown || '') }} />
            </Card>
          </TabsContent>
          <TabsContent value="serp">
            <Card className="p-6">
              {article.serpData ? <SerpReport data={article.serpData} /> : <p className="text-muted-foreground">No SERP data captured.</p>}
            </Card>
          </TabsContent>
          <TabsContent value="meta">
            <Card className="p-6 space-y-4 text-sm">
              <div><div className="text-xs text-muted-foreground uppercase">Slug</div><div className="font-mono">{article.slug}</div></div>
              <div><div className="text-xs text-muted-foreground uppercase">Keywords</div><div className="flex gap-1 flex-wrap mt-1">{(article.keywords || []).map(k => <Badge key={k} variant="secondary">{k}</Badge>)}</div></div>
              <div><div className="text-xs text-muted-foreground uppercase">Token usage</div><div className="font-mono">{JSON.stringify(article.tokenUsage || {})}</div></div>
              <div><div className="text-xs text-muted-foreground uppercase">Schema (JSON-LD)</div><pre className="text-xs p-3 bg-muted/40 rounded overflow-auto">{JSON.stringify(article.schemaJsonLd, null, 2)}</pre></div>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
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
