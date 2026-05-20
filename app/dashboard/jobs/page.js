'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import { Plus } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { StatusBadge } from '../page'

export default function JobsList() {
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let timer
    async function load() {
      const res = await fetch('/api/jobs')
      if (res.ok) setJobs(await res.json())
      setLoading(false)
      timer = setTimeout(load, 4000)
    }
    load()
    return () => clearTimeout(timer)
  }, [])

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Bulk jobs</h1>
          <p className="text-muted-foreground mt-1">Track concurrent bulk generations and progress.</p>
        </div>
        <Button asChild><Link href="/dashboard/generate"><Plus className="h-4 w-4 mr-2" /> New job</Link></Button>
      </div>
      {loading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}</div>
      ) : jobs.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground">No bulk jobs yet.</Card>
      ) : (
        <div className="space-y-3">
          {jobs.map(j => {
            const pct = j.totalArticles ? Math.round((j.completedArticles + j.failedArticles) * 100 / j.totalArticles) : 0
            return (
              <Card key={j.id} className="p-5">
                <div className="flex items-start justify-between mb-3 gap-4">
                  <div className="min-w-0">
                    <Link href={`/dashboard/jobs/${j.id}`} className="font-semibold hover:text-primary">{j.name}</Link>
                    <div className="text-xs text-muted-foreground mt-1">{formatDistanceToNow(new Date(j.createdAt), { addSuffix: true })}</div>
                  </div>
                  <StatusBadge status={j.status} />
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex-1">
                    <Progress value={pct} className="h-2" />
                  </div>
                  <div className="text-xs text-muted-foreground tabular-nums">
                    {j.completedArticles}/{j.totalArticles} done
                    {j.failedArticles ? <span className="text-red-500 ml-1">· {j.failedArticles} failed</span> : null}
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
