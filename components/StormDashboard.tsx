'use client'

import Link from 'next/link'
import {
  ArrowRight, ClipboardList, CloudLightning, FileText, Gauge,
  ListChecks, ShieldCheck, Users, type LucideIcon,
} from 'lucide-react'
import WorkspaceWeather from './WorkspaceWeather'

export type StormCounts = {
  leads: number | null
  inspections: number | null
  openTasks: number | null
  warrantiesDue: number | null
  estimates: number | null
  measurements: number | null
  stormEvidence: number | null
}

export type StormLead = {
  id: string
  name: string | null
  address: string | null
  status: string | null
}

type Stage = {
  label: string
  detail: string
  count: keyof StormCounts
  href: string
  icon: LucideIcon
  color: string
}

const STAGES: Stage[] = [
  { label: 'Storm evidence', detail: 'Recorded', count: 'stormEvidence', href: '/storms', icon: CloudLightning, color: 'red' },
  { label: 'Leads', detail: 'In workspace', count: 'leads', href: '/leads', icon: Users, color: 'amber' },
  { label: 'Inspections', detail: 'Sessions', count: 'inspections', href: '/inspections', icon: ClipboardList, color: 'blue' },
  { label: 'Measurements', detail: 'Records', count: 'measurements', href: '/measure', icon: Gauge, color: 'purple' },
  { label: 'Estimates', detail: 'Records', count: 'estimates', href: '/estimate', icon: FileText, color: 'cyan' },
  { label: 'Follow-ups', detail: 'Open tasks', count: 'openTasks', href: '/tasks', icon: ListChecks, color: 'orange' },
  { label: 'Warranties', detail: 'Need registration', count: 'warrantiesDue', href: '/warranty', icon: ShieldCheck, color: 'green' },
]

function Count({ value }: { value: number | null }) {
  return <span className="tabular-nums">{value === null ? '—' : value.toLocaleString('en-US')}</span>
}

function Metric({ count, label, href, icon: Icon, detail }: { count: number | null; label: string; href: string; icon: LucideIcon; detail: string }) {
  return (
    <Link href={href} className="storm-live-metric group">
      <div className="flex items-center justify-between gap-3">
        <span className="storm-label">{label}</span>
        <Icon className="h-4 w-4 text-cyan-300" aria-hidden="true" />
      </div>
      <div className="mt-2 text-3xl font-black text-white"><Count value={count} /></div>
      <p className="mt-1 text-xs text-slate-300">{count === null ? 'Not verified' : detail}</p>
    </Link>
  )
}

/** Atmospheric presentation of verified workspace records, never invented pipeline statistics. */
export default function StormDashboard({
  counts, recentLeads, recentError, loading,
}: {
  counts: StormCounts
  recentLeads: StormLead[]
  recentError: boolean
  loading: boolean
}) {
  return (
    <div className="storm-dashboard space-y-4 pb-4">
      <header className="storm-dashboard-top">
        <div className="flex flex-wrap items-center gap-3">
          <span className="storm-live-indicator"><span className="h-2 w-2 rounded-full bg-emerald-400" /> ROOF/OS COMMAND CENTER</span>
          <span className="text-xs text-slate-300">Live workspace records · NOAA/NWS weather sources</span>
        </div>
        <Link href="/settings" className="text-xs font-semibold text-cyan-200 hover:underline">Visual settings</Link>
      </header>

      <section className="storm-command-hero" aria-label="Storm Mode overview">
        <div className="storm-command-copy">
          <p className="storm-label tracking-[0.24em]">STORM-DRIVEN ROOFING OPERATIONS</p>
          <h1>REAL STORMS.<br />REAL DAMAGE.<br /><span>REAL JOBS.</span></h1>
          <p className="max-w-md text-sm leading-6 text-slate-200 md:text-base">
            Track official weather, inspect properties, verify measurements,
            and manage every job from one command center.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <a href="#storm-pipeline" className="storm-hero-cta inline-flex items-center gap-2 rounded-lg px-5 py-3 text-sm font-extrabold">
              View the pipeline <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </a>
            <Link href="/weather" className="inline-flex items-center rounded-lg border border-white/25 bg-black/45 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10">
              Live weather radar
            </Link>
          </div>
          <p className="mt-5 text-xs text-slate-300">
            Weather alerts are shown only when verified by official sources. No sample job, weather, or revenue numbers.
          </p>
        </div>
        <div className="storm-command-weather" aria-label="Official weather radar and alerts">
          <WorkspaceWeather variant="compact" />
        </div>
      </section>

      <section id="storm-pipeline" className="storm-command-panel scroll-mt-28" aria-labelledby="storm-pipeline-heading">
        <div className="storm-panel-heading">
          <div>
            <p className="storm-label">ROOFING PIPELINE</p>
            <h2 id="storm-pipeline-heading" className="mt-1 text-xl font-black text-white">From storm evidence to completed work</h2>
          </div>
          <span className="text-xs text-slate-300">Counts reflect workspace records, not conversion predictions</span>
        </div>
        <div className="storm-stage-track">
          {STAGES.map(({ label, detail, href, count, icon: Icon, color }, index) => (
            <Link key={href} href={href} className={`storm-stage storm-stage-${color}`} aria-label={`${label}, ${counts[count] === null ? 'count unavailable' : counts[count] + ' records'}`}>
              <span className="storm-stage-orb"><Icon className="h-6 w-6" aria-hidden="true" /></span>
              <span className="mt-3 text-[11px] font-extrabold uppercase tracking-wide text-white">{label}</span>
              <span className="mt-1 text-2xl font-black tabular-nums"><Count value={counts[count]} /></span>
              <span className="text-[10px] text-slate-300">{counts[count] === null ? 'Not verified' : detail}</span>
              {index < STAGES.length - 1 && <ArrowRight className="storm-stage-arrow h-4 w-4" aria-hidden="true" />}
            </Link>
          ))}
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Live workspace metrics">
        <Metric count={counts.leads} label="LEADS" detail="Workspace lead records" href="/leads" icon={Users} />
        <Metric count={counts.inspections} label="INSPECTIONS" detail="Saved inspection sessions" href="/inspections" icon={ClipboardList} />
        <Metric count={counts.estimates} label="ESTIMATES" detail="Saved estimate records" href="/estimate" icon={FileText} />
        <Metric count={counts.openTasks} label="FOLLOW-UPS" detail="Open tasks" href="/tasks" icon={ListChecks} />
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <section className="storm-command-panel" aria-labelledby="storm-activity-heading">
          <div className="storm-panel-heading">
            <h2 id="storm-activity-heading" className="font-bold text-white">RECENT LEADS</h2>
            <Link href="/leads" className="text-xs font-bold text-cyan-200 hover:underline">All leads</Link>
          </div>
          <div className="p-4">
            {loading && <p className="text-sm text-slate-300" role="status">Loading records…</p>}
            {!loading && recentError && <p className="text-sm text-amber-200">Leads are unavailable. Open Leads to retry.</p>}
            {!loading && !recentError && recentLeads.length === 0 && <p className="text-sm text-slate-300">No recent lead records in this workspace.</p>}
            {!recentError && recentLeads.map((lead) => (
              <Link key={lead.id} href={`/passport/${lead.id}`} className="flex items-center justify-between gap-3 border-b border-white/10 py-3 last:border-0 hover:bg-white/5">
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-white">{lead.name || 'Unnamed lead'}</span>
                  <span className="block truncate text-xs text-slate-300">{lead.address || 'Address not recorded'}</span>
                </span>
                <span className="shrink-0 rounded-md border border-cyan-300/25 bg-cyan-300/10 px-2 py-1 text-[10px] font-bold text-cyan-200">{lead.status?.replaceAll('_', ' ') || 'Unknown'}</span>
              </Link>
            ))}
          </div>
        </section>
        <section className="storm-command-panel" aria-labelledby="storm-actions-heading">
          <div className="storm-panel-heading"><h2 id="storm-actions-heading" className="font-bold text-white">COMMAND ACTIONS</h2></div>
          <div className="grid gap-2 p-4">
            {[
              { href: '/leads/new', label: 'Add a new lead', icon: Users },
              { href: '/inspections', label: 'Open inspections', icon: ClipboardList },
              { href: '/measure', label: 'Review measurements', icon: Gauge },
              { href: '/estimate', label: 'Open estimates', icon: FileText },
              { href: '/weather', label: 'Review weather & radar', icon: CloudLightning },
            ].map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.045] px-4 py-3 text-sm font-semibold text-slate-100 hover:border-cyan-300/50 hover:bg-cyan-400/10">
                <span className="flex items-center gap-3"><Icon className="h-4 w-4 text-cyan-300" aria-hidden="true" />{label}</span>
                <ArrowRight className="h-4 w-4 text-slate-400" aria-hidden="true" />
              </Link>
            ))}
          </div>
        </section>
      </div>
      <p className="text-center text-[11px] text-slate-300">AI observes. ROOF/OS validates. Technicians verify. Estimators price.</p>
    </div>
  )
}
