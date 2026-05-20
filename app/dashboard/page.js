'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Plus, FileText, Zap, Database, TrendingUp, Clock } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

export default function DashboardHome() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let timer
    async function load() {
      try {
        const res = await fetch('/api/dashboard/stats')
        if (res.ok) setStats(await res.json())
      } finally { setLoading(false) }
      timer = setTimeout(load, 5000)
    }
    load()
    return () => clearTimeout(timer)
  }, [])

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Your content operations overview</p>
        </div>
        <Button asChild size="lg"><Link href="/dashboard/generate"><Plus className="h-4 w-4 mr-2" /> New generation</Link></Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard label="Credits remaining" value={stats?.credits} icon={Zap} loading={loading} accent="text-amber-500" />
        <StatCard label="Articles generated" value={stats?.completedArticles} icon={FileText} loading={loading} accent="text-emerald-500" />
        <StatCard label="SERP requests" value={stats?.serpRequests} icon={TrendingUp} loading={loading} accent="text-blue-500" />
        <StatCard label="In progress" value={stats?.processingArticles} icon={Clock} loading={loading} accent="text-purple-500" />
      </div>

      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-lg">Recent generations</h2>
          <Button asChild variant="ghost" size="sm"><Link href="/dashboard/history">View all</Link></Button>
        </div>
        {loading ? (
          <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
        ) : (stats?.recent || []).length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed border-border rounded-lg">
            <Database className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground">No articles yet. Start your first generation.</p>
            <Button asChild className="mt-4"><Link href="/dashboard/generate"><Plus className="h-4 w-4 mr-2" /> New generation</Link></Button>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {stats.recent.map(a => (
              <Link key={a.id} href={`/dashboard/article/${a.id}`} className="flex items-center justify-between py-3 hover:bg-muted/30 -mx-2 px-2 rounded transition">
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate">{a.title || a.primaryKeyword}</div>
                  <div className="text-xs text-muted-foreground">{a.websiteUrl || '—'} · {formatDistanceToNow(new Date(a.createdAt), { addSuffix: true })}</div>
                </div>
                <StatusBadge status={a.status} />
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}

function StatCard({ label, value, icon: Icon, loading, accent }) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
        <Icon className={`h-4 w-4 ${accent}`} />
      </div>
      <div className="text-3xl font-bold mt-2">{loading ? <Skeleton className="h-8 w-16" /> : (value ?? 0).toLocaleString()}</div>
    </Card>
  )
}

export function StatusBadge({ status }) {
  const map = {
    queued: { label: 'Queued', cls: 'bg-muted text-muted-foreground' },
    processing: { label: 'Processing', cls: 'bg-amber-500/10 text-amber-500 border border-amber-500/30' },
    completed: { label: 'Completed', cls: 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/30' },
    failed: { label: 'Failed', cls: 'bg-red-500/10 text-red-500 border border-red-500/30' },
  }
  const cfg = map[status] || map.queued
  return <span className={`inline-flex items-center text-xs px-2 py-1 rounded-md ${cfg.cls}`}>{cfg.label}</span>
}
