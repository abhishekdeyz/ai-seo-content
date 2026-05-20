'use client'
import { useState, useCallback, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Papa from 'papaparse'
import { useDropzone } from 'react-dropzone'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Sparkles, Upload, FileText, Search, Loader2, ArrowRight, X, Download } from 'lucide-react'
import { toast } from 'sonner'

const COUNTRIES = [
  { value: 'us', label: 'United States' },
  { value: 'gb', label: 'United Kingdom' },
  { value: 'ca', label: 'Canada' },
  { value: 'au', label: 'Australia' },
  { value: 'in', label: 'India' },
  { value: 'de', label: 'Germany' },
  { value: 'fr', label: 'France' },
  { value: 'es', label: 'Spain' },
  { value: 'br', label: 'Brazil' },
  { value: 'mx', label: 'Mexico' },
]
const LANGUAGES = [
  { value: 'en', label: 'English' }, { value: 'es', label: 'Spanish' }, { value: 'fr', label: 'French' }, { value: 'de', label: 'German' }, { value: 'pt', label: 'Portuguese' }, { value: 'hi', label: 'Hindi' }, { value: 'it', label: 'Italian' }, { value: 'nl', label: 'Dutch' },
]
const TONES = ['professional', 'conversational', 'authoritative', 'friendly', 'persuasive', 'journalistic']
const TYPES = ['blog post', 'product review', 'comparison', 'listicle', 'how-to guide', 'pillar page', 'local seo page']

export default function GeneratePage() {
  const router = useRouter()
  const [tab, setTab] = useState('single')
  const [projects, setProjects] = useState([])
  useEffect(() => { fetch('/api/projects').then(r => r.ok && r.json()).then(d => setProjects(d || [])) }, [])

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">New generation</h1>
        <p className="text-muted-foreground mt-1">SERP-aware article generation. Single or bulk CSV.</p>
      </div>
      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="single"><Sparkles className="h-4 w-4 mr-2" /> Single article</TabsTrigger>
          <TabsTrigger value="bulk"><Upload className="h-4 w-4 mr-2" /> Bulk CSV (50-500)</TabsTrigger>
        </TabsList>
        <TabsContent value="single"><SingleForm projects={projects} /></TabsContent>
        <TabsContent value="bulk"><BulkForm projects={projects} /></TabsContent>
      </Tabs>
    </div>
  )
}

function SingleForm({ projects }) {
  const router = useRouter()
  const [form, setForm] = useState({
    websiteUrl: '', primaryKeyword: '', secondaryKeywords: '',
    country: 'us', language: 'en', tone: 'professional', articleType: 'blog post',
    wordCount: 1500, includeFaqs: true, includeMeta: true, includeSchema: true, humanize: true,
    avoidBrands: '', projectId: '',
  })
  const [serp, setSerp] = useState(null)
  const [serpLoading, setSerpLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  function upd(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function analyzeSerp() {
    if (!form.primaryKeyword) return toast.error('Enter a primary keyword first')
    setSerpLoading(true); setSerp(null)
    try {
      const res = await fetch('/api/serp/analyze', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword: form.primaryKeyword, country: form.country, language: form.language }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'SERP analysis failed')
      setSerp(data)
      toast.success('SERP analyzed')
    } catch (e) { toast.error(e.message) } finally { setSerpLoading(false) }
  }

  async function generate() {
    if (!form.primaryKeyword) return toast.error('Enter a primary keyword')
    setSubmitting(true)
    try {
      const body = {
        ...form,
        projectId: form.projectId || null,
        secondaryKeywords: form.secondaryKeywords.split(',').map(s => s.trim()).filter(Boolean),
        avoidBrands: form.avoidBrands.split(',').map(s => s.trim()).filter(Boolean),
      }
      const res = await fetch('/api/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Generation failed')
      toast.success('Article queued! Redirecting…')
      router.push(`/dashboard/article/${data.id}`)
    } catch (e) { toast.error(e.message) } finally { setSubmitting(false) }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-6">
        <Card className="p-6 space-y-4">
          <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Target</h3>
          {projects && projects.length > 0 && (
            <div className="space-y-2">
              <Label>Project (optional)</Label>
              <Select value={form.projectId || 'none'} onValueChange={v => upd('projectId', v === 'none' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="No project" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No project</SelectItem>
                  {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Website URL (optional)</Label>
              <Input value={form.websiteUrl} onChange={e => upd('websiteUrl', e.target.value)} placeholder="https://example.com" />
            </div>
            <div className="space-y-2">
              <Label>Primary keyword *</Label>
              <Input value={form.primaryKeyword} onChange={e => upd('primaryKeyword', e.target.value)} placeholder="best running shoes for marathons" />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Secondary keywords (comma separated)</Label>
              <Input value={form.secondaryKeywords} onChange={e => upd('secondaryKeywords', e.target.value)} placeholder="marathon running shoes, long distance shoes" />
            </div>
            <SelectField label="Country" value={form.country} onChange={v => upd('country', v)} options={COUNTRIES} />
            <SelectField label="Language" value={form.language} onChange={v => upd('language', v)} options={LANGUAGES} />
            <SelectField label="Tone" value={form.tone} onChange={v => upd('tone', v)} options={TONES.map(t => ({ value: t, label: t }))} />
            <SelectField label="Article type" value={form.articleType} onChange={v => upd('articleType', v)} options={TYPES.map(t => ({ value: t, label: t }))} />
          </div>
          <div className="space-y-2">
            <Label>Word count: {form.wordCount}</Label>
            <Slider min={500} max={4000} step={100} value={[form.wordCount]} onValueChange={v => upd('wordCount', v[0])} />
          </div>
        </Card>
        <Card className="p-6 space-y-4">
          <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Article options</h3>
          <div className="grid grid-cols-2 gap-4">
            <ToggleRow label="Include FAQs" value={form.includeFaqs} onChange={v => upd('includeFaqs', v)} />
            <ToggleRow label="Meta description" value={form.includeMeta} onChange={v => upd('includeMeta', v)} />
            <ToggleRow label="Schema markup (JSON-LD)" value={form.includeSchema} onChange={v => upd('includeSchema', v)} />
            <ToggleRow label="AI humanization" value={form.humanize} onChange={v => upd('humanize', v)} />
          </div>
          <div className="space-y-2">
            <Label>Avoid brands/companies (comma separated)</Label>
            <Input value={form.avoidBrands} onChange={e => upd('avoidBrands', e.target.value)} placeholder="Nike, Adidas" />
          </div>
        </Card>
        <div className="flex gap-3">
          <Button variant="outline" onClick={analyzeSerp} disabled={serpLoading}>
            {serpLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />} Preview SERP
          </Button>
          <Button onClick={generate} disabled={submitting} size="lg" className="flex-1">
            {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />} Generate article (1 credit)
          </Button>
        </div>
      </div>
      <div className="lg:col-span-1">
        <Card className="p-6 sticky top-6">
          <h3 className="font-semibold flex items-center gap-2 mb-3"><Search className="h-4 w-4" /> SERP intelligence</h3>
          {serpLoading ? <div className="text-muted-foreground text-sm flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Querying Google…</div>
            : !serp ? <p className="text-sm text-muted-foreground">Click “Preview SERP” to see live competitor data before generating.</p>
            : <SerpView data={serp} />}
        </Card>
      </div>
    </div>
  )
}

function SerpView({ data }) {
  return (
    <div className="space-y-4 text-sm">
      <div className="flex flex-wrap gap-2">
        <Badge variant="outline">Intent: {data.intent}</Badge>
        <Badge variant="outline">Difficulty: {data.difficulty}/100</Badge>
      </div>
      <div>
        <div className="font-medium mb-2">Top results</div>
        <div className="space-y-2">{data.organic.slice(0, 5).map((o, i) => (
          <div key={i} className="p-2 rounded bg-muted/50 border border-border/50">
            <div className="text-xs text-muted-foreground">#{o.position} · {new URL(o.link).hostname}</div>
            <div className="font-medium text-xs truncate">{o.title}</div>
          </div>
        ))}</div>
      </div>
      {data.peopleAlsoAsk?.length > 0 && (
        <div>
          <div className="font-medium mb-2">People also ask</div>
          <ul className="space-y-1 text-xs text-muted-foreground list-disc list-inside">
            {data.peopleAlsoAsk.slice(0, 5).map((p, i) => <li key={i}>{p.question}</li>)}
          </ul>
        </div>
      )}
      {data.relatedSearches?.length > 0 && (
        <div>
          <div className="font-medium mb-2">Related searches</div>
          <div className="flex flex-wrap gap-1">
            {data.relatedSearches.slice(0, 8).map((r, i) => <Badge key={i} variant="secondary" className="text-xs font-normal">{r}</Badge>)}
          </div>
        </div>
      )}
    </div>
  )
}

function BulkForm({ projects }) {
  const router = useRouter()
  const [rows, setRows] = useState([])
  const [name, setName] = useState('')
  const [projectId, setProjectId] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [defaults, setDefaults] = useState({ country: 'us', language: 'en', tone: 'professional', articleType: 'blog post', wordCount: 1500, includeFaqs: true, includeMeta: true, includeSchema: true, humanize: true })

  const onDrop = useCallback((acceptedFiles) => {
    const file = acceptedFiles?.[0]
    if (!file) return
    Papa.parse(file, {
      header: true, skipEmptyLines: true,
      complete: (res) => {
        const cleaned = (res.data || []).filter(r => r.primary_keyword || r.primaryKeyword)
        if (!cleaned.length) { toast.error('No rows with primary_keyword found in CSV'); return }
        setRows(cleaned)
        toast.success(`Loaded ${cleaned.length} rows`)
      },
      error: (e) => toast.error(e.message),
    })
  }, [])
  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, accept: { 'text/csv': ['.csv'] }, maxFiles: 1 })

  function downloadTemplate() {
    const csv = 'website_url,primary_keyword,secondary_keywords,country,language,article_type\nhttps://example.com,best running shoes,marathon shoes;long distance,us,en,blog post\nhttps://example.com,how to start affiliate marketing,affiliate guide;earn online,us,en,how-to guide'
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'seoforge-template.csv'; a.click(); URL.revokeObjectURL(url)
  }

  function addRow() { setRows(r => [...r, { primary_keyword: '', website_url: '', secondary_keywords: '' }]) }
  function removeRow(i) { setRows(r => r.filter((_, idx) => idx !== i)) }
  function updateRow(i, k, v) { setRows(r => r.map((row, idx) => idx === i ? { ...row, [k]: v } : row)) }

  async function submit() {
    if (!rows.length) return toast.error('Add at least one row')
    setSubmitting(true)
    try {
      const res = await fetch('/api/bulk', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, rows, defaults, projectId: projectId || null }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Bulk submission failed')
      toast.success(`Queued ${data.totalArticles} articles`)
      router.push(`/dashboard/jobs/${data.id}`)
    } catch (e) { toast.error(e.message) } finally { setSubmitting(false) }
  }

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold">Upload CSV</h3>
            <p className="text-xs text-muted-foreground mt-1">Columns: website_url, primary_keyword, secondary_keywords, country, language, article_type</p>
          </div>
          <Button variant="outline" size="sm" onClick={downloadTemplate}><Download className="h-4 w-4 mr-2" /> Download template</Button>
        </div>
        <div {...getRootProps()} className={`border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition ${isDragActive ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}>
          <input {...getInputProps()} />
          <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
          <p className="font-medium">{isDragActive ? 'Drop the CSV here' : 'Drag a CSV here, or click to browse'}</p>
          <p className="text-xs text-muted-foreground mt-1">Up to 500 rows</p>
        </div>
      </Card>

      <Card className="p-6 space-y-4">
        <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Defaults (applied when row is empty)</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <SelectField label="Country" value={defaults.country} onChange={v => setDefaults(d => ({ ...d, country: v }))} options={COUNTRIES} />
          <SelectField label="Language" value={defaults.language} onChange={v => setDefaults(d => ({ ...d, language: v }))} options={LANGUAGES} />
          <SelectField label="Tone" value={defaults.tone} onChange={v => setDefaults(d => ({ ...d, tone: v }))} options={TONES.map(t => ({ value: t, label: t }))} />
          <SelectField label="Article type" value={defaults.articleType} onChange={v => setDefaults(d => ({ ...d, articleType: v }))} options={TYPES.map(t => ({ value: t, label: t }))} />
        </div>
        <div className="space-y-2">
          <Label>Default word count: {defaults.wordCount}</Label>
          <Slider min={500} max={4000} step={100} value={[defaults.wordCount]} onValueChange={v => setDefaults(d => ({ ...d, wordCount: v[0] }))} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <ToggleRow label="Include FAQs" value={defaults.includeFaqs} onChange={v => setDefaults(d => ({ ...d, includeFaqs: v }))} />
          <ToggleRow label="Schema markup" value={defaults.includeSchema} onChange={v => setDefaults(d => ({ ...d, includeSchema: v }))} />
          <ToggleRow label="Meta description" value={defaults.includeMeta} onChange={v => setDefaults(d => ({ ...d, includeMeta: v }))} />
          <ToggleRow label="AI humanization" value={defaults.humanize} onChange={v => setDefaults(d => ({ ...d, humanize: v }))} />
        </div>
        <div className="space-y-2">
          <Label>Job name</Label>
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Client X — May launch batch" />
        </div>
        {projects && projects.length > 0 && (
          <div className="space-y-2">
            <Label>Project (optional)</Label>
            <Select value={projectId || 'none'} onValueChange={v => setProjectId(v === 'none' ? '' : v)}>
              <SelectTrigger><SelectValue placeholder="No project" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No project</SelectItem>
                {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
      </Card>

      {rows.length > 0 && (
        <Card className="p-0 overflow-hidden">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <h3 className="font-semibold">{rows.length} keywords queued</h3>
            <Button variant="ghost" size="sm" onClick={addRow}>+ Add row</Button>
          </div>
          <div className="max-h-96 overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 sticky top-0">
                <tr><th className="text-left p-2">Primary keyword</th><th className="text-left p-2">Website</th><th className="text-left p-2">Country</th><th className="text-left p-2">Type</th><th></th></tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="p-2"><Input className="h-8" value={r.primary_keyword || r.primaryKeyword || ''} onChange={e => updateRow(i, 'primary_keyword', e.target.value)} /></td>
                    <td className="p-2"><Input className="h-8" value={r.website_url || ''} onChange={e => updateRow(i, 'website_url', e.target.value)} placeholder="—" /></td>
                    <td className="p-2"><Input className="h-8 w-16" value={r.country || ''} onChange={e => updateRow(i, 'country', e.target.value)} placeholder="us" /></td>
                    <td className="p-2"><Input className="h-8" value={r.article_type || ''} onChange={e => updateRow(i, 'article_type', e.target.value)} placeholder="—" /></td>
                    <td className="p-2"><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeRow(i)}><X className="h-4 w-4" /></Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Button onClick={submit} disabled={submitting || !rows.length} size="lg" className="w-full">
        {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />} Queue {rows.length || 0} articles · {rows.length || 0} credits
      </Button>
    </div>
  )
}

function SelectField({ label, value, onChange, options }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>{options.map(o => <SelectItem key={o.value} value={o.value} className="capitalize">{o.label}</SelectItem>)}</SelectContent>
      </Select>
    </div>
  )
}
function ToggleRow({ label, value, onChange }) {
  return (
    <div className="flex items-center justify-between p-3 border border-border/50 rounded-md">
      <Label className="text-sm font-normal">{label}</Label>
      <Switch checked={value} onCheckedChange={onChange} />
    </div>
  )
}
