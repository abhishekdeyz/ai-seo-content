'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { Sparkles } from 'lucide-react'
import { toast } from 'sonner'

export default function SignInPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  async function onSubmit(e) {
    e.preventDefault()
    setLoading(true)
    const res = await signIn('credentials', { email, password, redirect: false })
    setLoading(false)
    if (res?.error) {
      toast.error('Invalid credentials')
      return
    }
    toast.success('Welcome back')
    router.push('/dashboard')
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 gradient-mesh">
      <Card className="w-full max-w-md p-8">
        <Link href="/" className="flex items-center gap-2 justify-center mb-8">
          <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <span className="font-bold text-xl">SEOForge<span className="text-primary"> AI</span></span>
        </Link>
        <h1 className="text-2xl font-bold mb-2 text-center">Welcome back</h1>
        <p className="text-sm text-muted-foreground text-center mb-6">Sign in to your content ops dashboard</p>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="you@agency.com" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="••••••••" />
          </div>
          <Button className="w-full" disabled={loading}>{loading ? 'Signing in…' : 'Sign in'}</Button>
        </form>
        <p className="text-sm text-muted-foreground text-center mt-6">No account? <Link href="/signup" className="text-primary hover:underline">Create one</Link></p>
      </Card>
    </div>
  )
}
