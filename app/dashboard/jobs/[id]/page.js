'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { ArrowLeft, RefreshCw, Download, Pause, Play, RotateCw, ChevronDown } from 'lucide-react'
import { StatusBadge } from '../../page'
import { toast } from 'sonner'

export default function JobDetail() {
  const { id } = useParams()
  const [job, setJob] = useState(null)
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(false)

  async function load() {
    const res = await fetch('/api/jobs/' + id)
    if (res.ok) setJob(await res.json())
    setLoading(false)
  }
  useEffect(() => {
    load()
    const t = setInterval(load, 3000)
    return () => clearInterval(t)
  }, [id])

  async function act(action) {
    setActing(true)
    try {
      const res = await fetch(`/api/jobs/${id}/${action}`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      if (action === 'pause') toast.success('Job paused')
      else if (action === 'resume') toast.success('Job resumed')
      else if (action === 'retry-failed') toast.success(`Retrying ${data.retried || 0} failed articles`)
      load()
    } catch (e) { toast.error(e.message) } finally { setActing(false) }
  }

  function exportZip(format) {
    const u = `/api/jobs/${id}/export?format=${format}`
    window.open(u, '_blank')
  }

  if (loading) return <div className="p-10"><Skeleton className="h-32 w-full" /></div>
  if (!job) return <div className="p-10">Job not found</div>

  const pct = job.totalArticles ? Math.round((job.completedArticles + job.failedArticles) * 100 / job.totalArticles) : 0
  const isFinal = job.status === 'completed' && (job.queuedArticles + job.processingArticles) === 0

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto">
      <Button asChild variant="ghost" size="sm" className="mb-4"><Link href="/dashboard/jobs"><ArrowLeft className="h-4 w-4 mr-1" /> Back to jobs</Link></Button>
      <Card className="p-6 mb-6">
        <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <StatusBadge status={job.paused ? 'queued' : job.status} />
              {job.paused && <span className="text-xs text-amber-500">Paused</span>}
              <span className="text-xs text-muted-foreground">Job ID: {job.id.slice(0, 8)}</span>
            </div>
            <h1 className="text-2xl font-bold">{job.name}</h1>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={load}><RefreshCw className="h-4 w-4 mr-1" /> Refresh</Button>
            {!isFinal && !job.paused && (
              <Button variant="outline" size="sm" onClick={() => act('pause')} disabled={acting}><Pause className="h-4 w-4 mr-1" /> Pause</Button>
            )}
            {!isFinal && job.paused && (
              <Button variant="outline" size="sm" onClick={() => act('resume')} disabled={acting}><Play className="h-4 w-4 mr-1" /> Resume</Button>
            )}
            {job.failedArticles > 0 && (
              <Button variant="outline" size="sm" onClick={() => act('retry-failed')} disabled={acting}><RotateCw className="h-4 w-4 mr-1" /> Retry failed ({job.failedArticles})</Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" disabled={!job.completedArticles}><Download className="h-4 w-4 mr-1" /> Export all <ChevronDown className="h-3 w-3 ml-1" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => exportZip('html')}>HTML (.zip)</DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportZip('markdown')}>Markdown (.zip)</DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportZip('docx')}>DOCX (.zip)</DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportZip('txt')}>TXT (.zip)</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-3 mb-4 text-center">
          <Stat label="Total" value={job.totalArticles} />
          <Stat label="Completed" value={job.completedArticles} color="text-emerald-500" />
          <Stat label="In progress" value={job.processingArticles + job.queuedArticles} color="text-amber-500" />
          <Stat label="Failed" value={job.failedArticles} color="text-red-500" />
        </div>
        <Progress value={pct} className="h-3" />
        <div className="text-xs text-muted-foreground mt-2 text-right">{pct}% complete</div>
      </Card>

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/30">
            <tr className="text-left text-xs uppercase text-muted-foreground">
              <th className="p-3">#</th>
              <th className="p-3">Keyword</th>
              <th className="p-3">Status</th>
              <th className="p-3 text-right">Open</th>
            </tr>
          </thead>
          <tbody>
            {(job.articles || []).map((a, i) => (
              <tr key={a.id} className="border-t border-border">
                <td className="p-3 text-muted-foreground tabular-nums">{i + 1}</td>
                <td className="p-3">
                  <div className="font-medium">{a.title || a.primaryKeyword}</div>
                  {a.error && <div className="text-xs text-red-500 mt-1">{a.error}</div>}
                </td>
                <td className="p-3"><StatusBadge status={a.status} /></td>
                <td className="p-3 text-right"><Button asChild variant="ghost" size="sm"><Link href={`/dashboard/article/${a.id}`}>Open →</Link></Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}

function Stat({ label, value, color }) {
  return (
    <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
      <div className="text-xs uppercase text-muted-foreground">{label}</div>
      <div className={`text-2xl font-bold ${color || ''}`}>{value ?? 0}</div>
    </div>
  )
}
