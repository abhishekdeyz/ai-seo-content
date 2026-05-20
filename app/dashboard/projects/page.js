'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog'
import { Plus, Trash2, Folder, Globe } from 'lucide-react'
import { toast } from 'sonner'

export default function ProjectsPage() {
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ name: '', websiteUrl: '', description: '' })
  const [saving, setSaving] = useState(false)

  async function load() {
    const res = await fetch('/api/projects')
    if (res.ok) setProjects(await res.json())
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function create() {
    if (!form.name) return toast.error('Name required')
    setSaving(true)
    try {
      const res = await fetch('/api/projects', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      if (!res.ok) throw new Error('Failed')
      toast.success('Project created')
      setOpen(false)
      setForm({ name: '', websiteUrl: '', description: '' })
      load()
    } catch (e) { toast.error(e.message) } finally { setSaving(false) }
  }

  async function del(id) {
    if (!confirm('Delete this project? Articles will be kept (just unlinked).')) return
    await fetch('/api/projects/' + id, { method: 'DELETE' })
    toast.success('Deleted')
    load()
  }

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
          <p className="text-muted-foreground mt-1">Group generations by client or website for easy organization.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" /> New project</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New project</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2"><Label>Name *</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Client X SEO" /></div>
              <div className="space-y-2"><Label>Website URL</Label><Input value={form.websiteUrl} onChange={e => setForm(f => ({ ...f, websiteUrl: e.target.value }))} placeholder="https://clientx.com" /></div>
              <div className="space-y-2"><Label>Description</Label><Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} /></div>
            </div>
            <DialogFooter><Button onClick={create} disabled={saving}>{saving ? 'Creating…' : 'Create'}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      {loading ? <div className="grid grid-cols-1 md:grid-cols-3 gap-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32" />)}</div>
        : projects.length === 0 ? (
          <Card className="p-10 text-center text-muted-foreground">
            <Folder className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
            <p>No projects yet. Create one to organize your content by client or website.</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {projects.map(p => (
              <Card key={p.id} className="p-5">
                <div className="flex items-start justify-between gap-2">
                  <Link href={`/dashboard/history?projectId=${p.id}`} className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1"><Folder className="h-4 w-4 text-primary" /><span className="font-semibold truncate">{p.name}</span></div>
                    {p.websiteUrl && <div className="text-xs text-muted-foreground flex items-center gap-1 mb-2 truncate"><Globe className="h-3 w-3" /> {p.websiteUrl}</div>}
                    {p.description && <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{p.description}</p>}
                    <Badge variant="secondary" className="text-xs">{p.articleCount} articles</Badge>
                  </Link>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => del(p.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </Card>
            ))}
          </div>
        )}
    </div>
  )
}
