'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Search, Trash2, Download, Eye, X } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { StatusBadge } from '../page'
import { toast } from 'sonner'

export default function HistoryPage() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('all')
  const [website, setWebsite] = useState('')

  async function load() {
    setLoading(true)
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    if (status && status !== 'all') params.set('status', status)
    if (website) params.set('website', website)
    const res = await fetch('/api/articles?' + params.toString())
    const data = await res.json()
    setItems(data.items || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])
  useEffect(() => { const t = setTimeout(load, 300); return () => clearTimeout(t) }, [q, status, website])

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
          <p className="text-muted-foreground mt-1">All your generations — search, filter, edit, re-export.</p>
        </div>
      </div>
      <Card className="p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="relative md:col-span-2">
            <Search className="h-4 w-4 absolute left-3 top-3 text-muted-foreground" />
            <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search by keyword or title…" className="pl-10" />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="processing">Processing</SelectItem>
              <SelectItem value="queued">Queued</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
          <Input value={website} onChange={e => setWebsite(e.target.value)} placeholder="Filter by website…" />
        </div>
      </Card>

      <Card className="overflow-hidden">
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
            {loading ? Array.from({ length: 6 }).map((_, i) => (
              <tr key={i}><td colSpan={5} className="p-3"><Skeleton className="h-8 w-full" /></td></tr>
            )) : items.length === 0 ? (
              <tr><td colSpan={5} className="text-center p-10 text-muted-foreground">No articles match. Start a new generation.</td></tr>
            ) : items.map(a => (
              <tr key={a.id} className="border-t border-border hover:bg-muted/20">
                <td className="p-3 max-w-md">
                  <Link href={`/dashboard/article/${a.id}`} className="font-medium hover:text-primary">{a.title || a.primaryKeyword}</Link>
                  <div className="text-xs text-muted-foreground truncate">{a.primaryKeyword}</div>
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
      </Card>
    </div>
  )
}
