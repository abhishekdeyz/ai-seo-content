'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Search, Trash2, Download, Eye, Folder, Globe, LayoutGrid, List } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { StatusBadge } from '../page'
import { toast } from 'sonner'

export default function HistoryPage() {
  const sp = useSearchParams()
  const initialProject = sp.get('projectId') || 'all'
  const [items, setItems] = useState([])
  const [groups, setGroups] = useState(null)
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('all')
  const [website, setWebsite] = useState('')
  const [projectId, setProjectId] = useState(initialProject)
  const [groupBy, setGroupBy] = useState('none')

  useEffect(() => { fetch('/api/projects').then(r => r.ok && r.json()).then(d => setProjects(d || [])) }, [])

  async function load() {
    setLoading(true)
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    if (status && status !== 'all') params.set('status', status)
    if (website) params.set('website', website)
    if (projectId && projectId !== 'all') params.set('projectId', projectId)
    if (groupBy === 'website') params.set('groupBy', 'website')
    params.set('limit', '100')
    const res = await fetch('/api/articles?' + params.toString())
    const data = await res.json()
    setItems(data.items || [])
    setGroups(data.groups || null)
    setLoading(false)
  }
  useEffect(() => { load() }, [])
  useEffect(() => { const t = setTimeout(load, 300); return () => clearTimeout(t) }, [q, status, website, projectId, groupBy])

  async function del(id) {
    if (!confirm('Delete this article?')) return
    await fetch('/api/articles/' + id, { method: 'DELETE' })
    toast.success('Deleted')
    load()
  }

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">History</h1>
          <p className="text-muted-foreground mt-1">All your generations — search, filter, group, edit, re-export.</p>
        </div>
      </div>
      <Card className="p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <div className="relative md:col-span-2">
            <Search className="h-4 w-4 absolute left-3 top-3 text-muted-foreground" />
            <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search by keyword or title…" className="pl-10" />
          </div>
          <Select value={projectId} onValueChange={setProjectId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All projects</SelectItem>
              <SelectItem value="none">Unassigned</SelectItem>
              {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="processing">Processing</SelectItem>
              <SelectItem value="queued">Queued</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex gap-2">
            <Input value={website} onChange={e => setWebsite(e.target.value)} placeholder="Website filter" className="flex-1" />
            <Button variant={groupBy === 'website' ? 'default' : 'outline'} size="icon" onClick={() => setGroupBy(g => g === 'website' ? 'none' : 'website')} title="Group by website">
              {groupBy === 'website' ? <List className="h-4 w-4" /> : <LayoutGrid className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </Card>

      {loading ? (
        <Card><div className="p-4 space-y-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div></Card>
      ) : groupBy === 'website' && groups && Object.keys(groups).length ? (
        <div className="space-y-5">
          {Object.entries(groups).map(([siteKey, list]) => (
            <Card key={siteKey} className="overflow-hidden">
              <div className="px-4 py-3 bg-muted/30 flex items-center gap-2">
                <Globe className="h-4 w-4 text-primary" />
                <span className="font-semibold">{siteKey}</span>
                <Badge variant="secondary" className="ml-2">{list.length}</Badge>
              </div>
              <Table items={list} del={del} />
            </Card>
          ))}
        </div>
      ) : items.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground">No articles match. Start a new generation.</Card>
      ) : (
        <Card className="overflow-hidden"><Table items={items} del={del} /></Card>
      )}
    </div>
  )
}

function Table({ items, del }) {
  return (
    <table className="w-full text-sm">
      <thead className="bg-muted/30">
        <tr className="text-left text-xs uppercase text-muted-foreground">
          <th className="p-3">Title / Keyword</th>
          <th className="p-3 hidden md:table-cell">Website</th>
          <th className="p-3 hidden md:table-cell">Created</th>
          <th className="p-3">Status</th>
          <th className="p-3 text-right">Actions</th>
        </tr>
      </thead>
      <tbody>
        {items.map(a => (
          <tr key={a.id} className="border-t border-border hover:bg-muted/20">
            <td className="p-3 max-w-md">
              <Link href={`/dashboard/article/${a.id}`} className="font-medium hover:text-primary">{a.title || a.primaryKeyword}</Link>
              <div className="text-xs text-muted-foreground truncate">{a.primaryKeyword}{a.structureVariant ? ` · ${a.structureVariant}` : ''}</div>
            </td>
            <td className="p-3 text-xs text-muted-foreground hidden md:table-cell">{a.websiteUrl || '—'}</td>
            <td className="p-3 text-xs text-muted-foreground hidden md:table-cell">{formatDistanceToNow(new Date(a.createdAt), { addSuffix: true })}</td>
            <td className="p-3"><StatusBadge status={a.status} /></td>
            <td className="p-3 text-right">
              <div className="flex justify-end gap-1">
                <Button asChild variant="ghost" size="icon" className="h-8 w-8"><Link href={`/dashboard/article/${a.id}`}><Eye className="h-4 w-4" /></Link></Button>
                {a.status === 'completed' && (
                  <Button asChild variant="ghost" size="icon" className="h-8 w-8"><a href={`/api/articles/${a.id}/export?format=html`} target="_blank"><Download className="h-4 w-4" /></a></Button>
                )}
                <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => del(a.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
