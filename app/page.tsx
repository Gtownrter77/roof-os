'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import QuickActions from '../components/QuickActions'
import WorkspaceWeather from '../components/WorkspaceWeather'
import { createClient } from '../lib/supabase/client'
import {
  Activity, CalendarDays, Camera, ClipboardList, CloudLightning, FileText,
  Gauge, Home as HomeIcon, ListChecks, Settings, ShieldCheck, Sparkles, Users, Wallet,
} from 'lucide-react'

type Lead = { id: string; name: string | null; address: string | null; status: string | null }
type Counts = { leads: number | null; inspections: number | null; openTasks: number | null; warrantiesDue: number | null }
type MetricProps = { label: string; value: number | null; detail: string; href: string; icon: React.ComponentType<{ className?: string }> }

const NAV_ITEMS = [
  { href: '/', label: 'Dashboard', icon: HomeIcon },
  { href: '/weather', label: 'Weather & radar', icon: CloudLightning },
  { href: '/storms', label: 'Storm alerts', icon: Activity },
  { href: '/leads', label: 'Leads & CRM', icon: Users },
  { href: '/inspections', label: 'Inspections', icon: ClipboardList },
  { href: '/measure', label: 'Measurements', icon: Gauge },
  { href: '/photo-estimate', label: 'Photo reports', icon: Camera },
  { href: '/reports', label: 'Reports', icon: FileText },
  { href: '/pricing-config', label: 'Price book', icon: Wallet },
  { href: '/tasks', label: 'Tasks', icon: ListChecks },
  { href: '/calendar', label: 'Calendar', icon: CalendarDays },
  { href: '/warranty', label: 'Warranties', icon: ShieldCheck },
  { href: '/ai', label: 'AI tools · pilot', icon: Sparkles, pilot: true },
  { href: '/settings', label: 'Settings', icon: Settings },
]

const FEATURES = [
  { href: '/leads', label: 'Leads & CRM', detail: 'Manage lead records, status, assignment, and follow-up.', icon: Users },
  { href: '/inspections', label: 'Inspections', detail: 'Open saved field inspections and photo evidence.', icon: ClipboardList },
  { href: '/photo-estimate', label: 'Photo-to-report', detail: 'Build a sourced report draft; technician verification is still required.', icon: Camera },
  { href: '/measure', label: 'Measurements', detail: 'Review proposed quantities; AI and aerial suggestions are not authoritative.', icon: Gauge },
  { href: '/pricing-config', label: 'Owner price book', detail: 'Configure workspace pricing; draft values are not a final estimate.', icon: Wallet },
  { href: '/tasks', label: 'Tasks & follow-up', detail: 'Track open work recorded in this workspace.', icon: ListChecks },
  { href: '/calendar', label: 'Calendar', detail: 'Open the workspace calendar and scheduled work.', icon: CalendarDays },
  { href: '/warranty', label: 'Warranty records', detail: 'Review records that still need registration steps.', icon: ShieldCheck },
]

function Metric({ label, value, detail, href, icon: Icon }: MetricProps) {
  return (
    <Link href={href} className="group rounded-xl border border-white/10 bg-slate-900/80 p-4 transition hover:border-cyan-300/50 hover:bg-slate-900">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">{label}</p>
        <Icon className="h-4 w-4 text-cyan-300" aria-hidden="true" />
      </div>
      <p className="mt-3 text-3xl font-black tabular-nums text-white">{value === null ? '—' : value}</p>
      <p className="mt-1 text-xs text-slate-400">{detail}</p>
    </Link>
  )
}

export default function Home() {
  const [recentLeads, setRecentLeads] = useState<Lead[]>([])
  const [recentError, setRecentError] = useState(false)
  const [counts, setCounts] = useState<Counts>({ leads: null, inspections: null, openTasks: null, warrantiesDue: null })
  const [loading, setLoading] = useState(true)
  const [ownerLabel, setOwnerLabel] = useState('Workspace member')

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const supabase = createClient()
        const [leads, recent, inspections, tasks, warranties, user] = await Promise.all([
          supabase.from('leads').select('id', { count: 'exact', head: true }),
          supabase.from('leads').select('id,name,address,status').order('created_at', { ascending: false }).limit(5),
          supabase.from('inspection_sessions').select('id', { count: 'exact', head: true }),
          supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('status', 'open'),
          supabase.from('warranties').select('id', { count: 'exact', head: true }).in('registration_status', ['not_started', 'packet_ready']),
          supabase.auth.getUser(),
        ])
        if (cancelled) return
        setCounts({
          leads: leads.error ? null : (leads.count ?? 0),
          inspections: inspections.error ? null : (inspections.count ?? 0),
          openTasks: tasks.error ? null : (tasks.count ?? 0),
          warrantiesDue: warranties.error ? null : (warranties.count ?? 0),
        })
        setRecentError(Boolean(recent.error))
        setRecentLeads(recent.error ? [] : (recent.data ?? []))
        if (user.data.user?.email) setOwnerLabel(user.data.user.email)
      } catch {
        if (!cancelled) setRecentError(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    const timer = window.setInterval(() => { void load() }, 10 * 60 * 1000)
    return () => { cancelled = true; window.clearInterval(timer) }
  }, [])

  return (
    <div className="min-h-screen bg-[#070b14] pb-24 text-slate-100 lg:pb-8">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#070b14]/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-4 py-3 md:px-6">
          <Link href="/" className="text-xl font-black tracking-tight text-white">ROOF<span className="text-red-500">/</span>OS<span className="ml-2 hidden text-xs font-medium tracking-[0.18em] text-slate-400 sm:inline">ROOFING OPERATIONS</span></Link>
          <div className="flex items-center gap-3">
            <span className="hidden max-w-56 truncate text-xs text-slate-300 md:inline">{ownerLabel}</span>
            <Link href="/settings" aria-label="Workspace settings" className="rounded-lg border border-white/10 p-2 text-slate-300 hover:bg-white/10"><Settings className="h-4 w-4" /></Link>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1600px] gap-5 px-3 py-4 md:px-6 lg:grid-cols-[220px_minmax(0,1fr)] lg:py-6">
        <aside className="hidden lg:block">
          <nav aria-label="ROOF/OS features" className="sticky top-20 space-y-1 rounded-2xl border border-white/10 bg-slate-950/70 p-3">
            {NAV_ITEMS.map(({ href, label, icon: Icon, pilot }) => (
              <Link key={href} href={href} aria-current={href === '/' ? 'page' : undefined} className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${href === '/' ? 'bg-blue-600 font-bold text-white' : 'text-slate-300 hover:bg-white/10 hover:text-white'}`}>
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate">{label}</span>
                {pilot && <span className="rounded bg-amber-400/15 px-1.5 py-0.5 text-[9px] font-bold uppercase text-amber-200">Pilot</span>}
              </Link>
            ))}
          </nav>
        </aside>

        <main className="min-w-0 space-y-5">
          <WorkspaceWeather variant="hero" tickerMetrics={[
            { label: 'Leads', value: counts.leads },
            { label: 'Inspections', value: counts.inspections },
            { label: 'Open tasks', value: counts.openTasks },
            { label: 'Warranties to register', value: counts.warrantiesDue },
          ]} />

          <section aria-label="Live workspace counts" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <Metric label="Leads" value={counts.leads} detail="Workspace records" href="/leads" icon={Users} />
            <Metric label="Inspections" value={counts.inspections} detail="Saved inspection sessions" href="/inspections" icon={ClipboardList} />
            <Metric label="Open tasks" value={counts.openTasks} detail="Recorded follow-ups" href="/tasks" icon={ListChecks} />
            <Metric label="Warranties to register" value={counts.warrantiesDue} detail="Not started or packet ready" href="/warranty" icon={ShieldCheck} />
          </section>

          <section aria-labelledby="workflow-title" className="rounded-2xl border border-white/10 bg-slate-950/65 p-4 md:p-5">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div><p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">Available in this workspace</p><h2 id="workflow-title" className="mt-1 text-xl font-bold text-white">ROOF/OS workflows</h2></div>
              <p className="max-w-xl text-xs leading-5 text-slate-400">Counts above come from workspace records. No sample storms, pipeline totals, or revenue figures are substituted.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {FEATURES.map(({ href, label, detail, icon: Icon }) => (
                <Link key={href} href={href} className="group rounded-xl border border-white/10 bg-white/[0.035] p-4 transition hover:border-cyan-300/40 hover:bg-white/[0.07]">
                  <Icon className="h-5 w-5 text-cyan-300" aria-hidden="true" />
                  <h3 className="mt-3 font-bold text-white">{label}</h3>
                  <p className="mt-1 text-xs leading-5 text-slate-400">{detail}</p>
                </Link>
              ))}
            </div>
          </section>

          <section aria-labelledby="recent-title" className="rounded-2xl border border-white/10 bg-slate-950/65 p-4 md:p-5">
            <div className="mb-2 flex items-center justify-between gap-3"><h2 id="recent-title" className="font-bold text-white">Recent properties</h2><Link href="/leads" className="text-sm text-cyan-300 hover:underline">All leads</Link></div>
            {loading && <p className="py-4 text-sm text-slate-400" role="status">Loading workspace records…</p>}
            {!loading && recentError && <p className="py-4 text-sm text-amber-200">Recent leads could not be verified. Open Leads to retry.</p>}
            {!loading && !recentError && recentLeads.length === 0 && <p className="py-4 text-sm text-slate-400">No lead records were returned for this workspace.</p>}
            {recentLeads.map((lead) => (
              <Link key={lead.id} href={`/passport/${lead.id}`} className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 py-3 first:border-0 hover:bg-white/[0.03]">
                <span className="min-w-0"><span className="block truncate text-sm font-semibold text-white">{lead.name || 'Unknown lead name'}</span><span className="block truncate text-xs text-slate-400">{lead.address || 'Address not recorded'}</span></span>
                <span className="rounded-full bg-cyan-300/10 px-2.5 py-1 text-xs text-cyan-200">{lead.status?.replaceAll('_', ' ') || 'Status unknown'}</span>
              </Link>
            ))}
          </section>
          <p className="pb-2 text-center text-[11px] text-slate-500">AI observes. ROOF/OS validates. Technicians verify. Estimators price.</p>
        </main>
      </div>
      <QuickActions />
    </div>
  )
}
