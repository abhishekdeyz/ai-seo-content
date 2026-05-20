'use client'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { ArrowRight, Sparkles, Search, Zap, Database, FileText, Globe, Layers, Workflow, ShieldCheck, BarChart3, Check, Bot } from 'lucide-react'

export default function LandingPage() {
  const { data: session } = useSession()
  const isAuthed = !!session?.user

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 gradient-mesh pointer-events-none" />
      <div className="absolute inset-0 grid-pattern opacity-30 pointer-events-none" />

      {/* Nav */}
      <header className="relative z-10 border-b border-border/40 backdrop-blur-md bg-background/30">
        <div className="container mx-auto flex items-center justify-between py-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <span className="font-bold text-xl tracking-tight">SEOForge<span className="text-primary"> AI</span></span>
          </Link>
          <nav className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition">Features</a>
            <a href="#workflow" className="hover:text-foreground transition">Workflow</a>
            <a href="#pricing" className="hover:text-foreground transition">Pricing</a>
            <a href="#faq" className="hover:text-foreground transition">FAQ</a>
          </nav>
          <div className="flex items-center gap-3">
            {isAuthed ? (
              <Button asChild><Link href="/dashboard">Dashboard <ArrowRight className="ml-1.5 h-4 w-4" /></Link></Button>
            ) : (
              <>
                <Button asChild variant="ghost"><Link href="/signin">Sign in</Link></Button>
                <Button asChild><Link href="/signup">Start free <ArrowRight className="ml-1.5 h-4 w-4" /></Link></Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative z-10 container mx-auto px-4 pt-20 pb-24 text-center">
        <Badge variant="outline" className="mb-6 border-primary/30 bg-primary/10 text-primary px-4 py-1.5">
          <Sparkles className="h-3.5 w-3.5 mr-1.5" /> Built for SEO agencies handling 500+ articles/month
        </Badge>
        <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 leading-[1.05]">
          Bulk SEO content,<br />
          <span className="text-gradient">at agency scale.</span>
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
          SEOForge AI is a SERP-aware content operations platform. Upload a CSV, hit run, and ship 50-500 ranked-ready articles backed by live competitor data, People Also Ask, and search intent analysis.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="lg" className="text-base h-12 px-6 shadow-xl shadow-primary/30">
            <Link href={isAuthed ? '/dashboard/generate' : '/signup'}>Generate articles in bulk <ArrowRight className="ml-2 h-4 w-4" /></Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="text-base h-12 px-6">
            <a href="#workflow">See the workflow</a>
          </Button>
        </div>
        <div className="mt-10 flex items-center justify-center gap-6 text-sm text-muted-foreground">
          <div className="flex items-center gap-2"><Check className="h-4 w-4 text-green-500" /> 100 free credits</div>
          <div className="flex items-center gap-2"><Check className="h-4 w-4 text-green-500" /> No credit card</div>
          <div className="flex items-center gap-2"><Check className="h-4 w-4 text-green-500" /> CSV bulk upload</div>
        </div>

        {/* Mock dashboard preview */}
        <div className="mt-16 relative max-w-5xl mx-auto">
          <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500/30 via-purple-500/30 to-blue-500/30 rounded-2xl blur-2xl" />
          <Card className="relative overflow-hidden border-border/50">
            <div className="bg-card border-b border-border px-4 py-2 flex items-center gap-2">
              <div className="flex gap-1.5">
                <div className="h-3 w-3 rounded-full bg-red-500/60" />
                <div className="h-3 w-3 rounded-full bg-yellow-500/60" />
                <div className="h-3 w-3 rounded-full bg-green-500/60" />
              </div>
              <span className="text-xs text-muted-foreground ml-2">seoforge.ai/dashboard/generate</span>
            </div>
            <div className="p-6 md:p-10 bg-gradient-to-br from-card to-background">
              <div className="grid grid-cols-3 gap-4 mb-6">
                {[
                  { label: 'Credits', value: '4,820' },
                  { label: 'Articles', value: '312' },
                  { label: 'SERP queries', value: '987' },
                ].map(s => (
                  <div key={s.label} className="p-4 rounded-lg bg-muted/50 border border-border/50 text-left">
                    <div className="text-xs text-muted-foreground uppercase tracking-wide">{s.label}</div>
                    <div className="text-2xl font-bold mt-1">{s.value}</div>
                  </div>
                ))}
              </div>
              <div className="text-left p-4 rounded-lg bg-muted/30 border border-border/50 font-mono text-xs space-y-1">
                <div className="text-green-400">✓ best running shoes for marathons → generated</div>
                <div className="text-green-400">✓ how to start affiliate marketing 2025 → generated</div>
                <div className="text-amber-400">○ local seo strategies for dentists → processing…</div>
                <div className="text-amber-400">○ wordpress vs webflow comparison → processing…</div>
                <div className="text-muted-foreground">· queued: 47 articles</div>
              </div>
            </div>
          </Card>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="relative z-10 container mx-auto px-4 py-24">
        <div className="text-center mb-16">
          <Badge variant="outline" className="mb-4">Features</Badge>
          <h2 className="text-4xl md:text-5xl font-bold mb-4">Everything an agency needs.<br />Nothing it doesn’t.</h2>
          <p className="text-muted-foreground max-w-xl mx-auto">SEOForge is not a chatbot. It is a content ops platform engineered for scale, automation, and SERP intelligence.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            { icon: Layers, title: 'Bulk CSV workflows', desc: 'Upload a CSV with 50-500 keywords. Per-row settings for country, language, type, and word count.' },
            { icon: Search, title: 'Live SERP intelligence', desc: 'Every article is briefed with real-time competitor headings, PAA, related searches, and intent.' },
            { icon: Bot, title: 'Smart prompt pipeline', desc: 'Prompts dynamically built per keyword using SERP signals. No static one-prompt fits-all.' },
            { icon: Workflow, title: 'Queue & retries', desc: 'Concurrency-controlled queue with retries and progress tracking. Built for unattended bulk runs.' },
            { icon: ShieldCheck, title: 'Human-grade writing', desc: 'No em dashes, no AI giveaways. Anti-detection humanization with variable sentence structure.' },
            { icon: FileText, title: 'Export everywhere', desc: 'Download as HTML, Markdown, DOCX, TXT. Schema markup and meta included.' },
            { icon: BarChart3, title: 'Agency dashboard', desc: 'Track credits, generations, SERP queries, history, and per-website rollups.' },
            { icon: Database, title: 'Full history', desc: 'Every article, SERP report, and token-usage log retained, searchable, and re-editable.' },
            { icon: Globe, title: 'WordPress ready', desc: 'Publishing pipeline pluggable for WordPress, drafts, scheduling and featured images.' },
          ].map(f => (
            <Card key={f.title} className="p-6 border-border/50 bg-card/50 hover:bg-card transition group">
              <div className="h-11 w-11 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center mb-4 group-hover:scale-110 transition">
                <f.icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-semibold text-lg mb-2">{f.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* Workflow */}
      <section id="workflow" className="relative z-10 container mx-auto px-4 py-24">
        <div className="text-center mb-16">
          <Badge variant="outline" className="mb-4">Workflow</Badge>
          <h2 className="text-4xl md:text-5xl font-bold mb-4">From keyword to publish in 4 steps.</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[
            { step: '01', title: 'Upload keywords', desc: 'Paste a list or upload a CSV with up to 500 rows. Set defaults globally or per row.' },
            { step: '02', title: 'Live SERP brief', desc: 'We query Serper for the top 10 results, PAA, related searches and competitor titles.' },
            { step: '03', title: 'AI generation', desc: 'OpenAI builds a SERP-aligned, human-toned article with title, meta, FAQs and schema.' },
            { step: '04', title: 'Edit & export', desc: 'Edit in our editor, export to HTML, Markdown, DOCX, TXT, or push to WordPress.' },
          ].map(s => (
            <Card key={s.step} className="p-6 border-border/50 bg-card/50">
              <div className="text-5xl font-bold text-primary/30 mb-4">{s.step}</div>
              <h3 className="font-semibold text-lg mb-2">{s.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="relative z-10 container mx-auto px-4 py-24">
        <div className="text-center mb-16">
          <Badge variant="outline" className="mb-4">Pricing</Badge>
          <h2 className="text-4xl md:text-5xl font-bold mb-4">Pricing built for content ops teams.</h2>
          <p className="text-muted-foreground">Start free. Upgrade when you scale.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 max-w-6xl mx-auto">
          {[
            { name: 'Free', price: '$0', credits: '100 credits', features: ['Single + bulk', 'SERP analysis', 'All exports'] },
            { name: 'Starter', price: '$29', credits: '500 articles/mo', features: ['Everything in Free', 'Priority queue', 'API access'] },
            { name: 'Agency', price: '$99', credits: '3,000 articles/mo', highlight: true, features: ['Everything in Starter', 'WordPress publishing', 'Team seats'] },
            { name: 'Enterprise', price: 'Custom', credits: 'Unlimited', features: ['SLA + uptime', 'Dedicated support', 'On-prem option'] },
          ].map(p => (
            <Card key={p.name} className={`p-6 ${p.highlight ? 'border-primary shadow-2xl shadow-primary/20 relative' : 'border-border/50'}`}>
              {p.highlight && <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">Most popular</Badge>}
              <h3 className="font-semibold text-xl mb-2">{p.name}</h3>
              <div className="flex items-baseline gap-1 mb-2">
                <span className="text-4xl font-bold">{p.price}</span>
                {p.price !== 'Custom' && <span className="text-muted-foreground text-sm">/mo</span>}
              </div>
              <div className="text-sm text-muted-foreground mb-6">{p.credits}</div>
              <ul className="space-y-2 mb-6">
                {p.features.map(f => (
                  <li key={f} className="flex items-center gap-2 text-sm"><Check className="h-4 w-4 text-green-500" /> {f}</li>
                ))}
              </ul>
              <Button asChild variant={p.highlight ? 'default' : 'outline'} className="w-full"><Link href="/signup">Get started</Link></Button>
            </Card>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="relative z-10 container mx-auto px-4 py-24 max-w-3xl">
        <div className="text-center mb-16">
          <Badge variant="outline" className="mb-4">FAQ</Badge>
          <h2 className="text-4xl md:text-5xl font-bold mb-4">Frequently asked questions.</h2>
        </div>
        <Accordion type="single" collapsible className="w-full">
          {[
            { q: 'Is this just an AI writer?', a: 'No. SEOForge is a bulk SEO content operations platform. Every article uses live SERP intelligence and is part of a job queue with retries, history, and exports.' },
            { q: 'How does bulk work?', a: 'Upload a CSV with columns: website_url, primary_keyword, secondary_keywords, country, language, article_type. We queue and process them with concurrency limits.' },
            { q: 'Which AI is used?', a: 'OpenAI (configurable model). Each request uses a custom prompt built from the SERP analysis returned by Serper API.' },
            { q: 'Can I edit articles?', a: 'Yes. Every article opens in an editor where you can rewrite, regenerate sections, and re-export to HTML, Markdown, DOCX, or TXT.' },
            { q: 'Do you support WordPress publishing?', a: 'WordPress publishing is on the roadmap and architecturally ready.' },
          ].map((f, i) => (
            <AccordionItem key={i} value={`item-${i}`}>
              <AccordionTrigger className="text-left">{f.q}</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">{f.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      {/* CTA */}
      <section className="relative z-10 container mx-auto px-4 py-24">
        <Card className="relative overflow-hidden p-12 md:p-16 text-center border-primary/30">
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-blue-500/10" />
          <div className="relative">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">Ship 500 SEO articles this week.</h2>
            <p className="text-muted-foreground mb-8 max-w-xl mx-auto">Stop writing one article at a time. Switch to a content ops workflow built for agencies.</p>
            <Button asChild size="lg" className="text-base h-12 px-6 shadow-xl shadow-primary/30">
              <Link href="/signup">Start free <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
          </div>
        </Card>
      </section>

      <footer className="relative z-10 border-t border-border/40 py-8 text-center text-sm text-muted-foreground">
        <div className="container mx-auto">© 2025 SEOForge AI. Built for SEO content ops.</div>
      </footer>
    </div>
  )
}
