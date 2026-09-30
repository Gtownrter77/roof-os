'use client'

import { useMemo, useState } from 'react'
import {
  ArrowUpRight,
  Bell,
  CalendarDays,
  Check,
  ChevronDown,
  CircleDollarSign,
  ClipboardCheck,
  CloudSun,
  FileText,
  Home,
  Menu,
  MoreHorizontal,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Users,
  X,
} from 'lucide-react'

const jobs = [
  { address: '1428 Willow Creek Dr', customer: 'Maya & Jordan Lee', type: 'Full replacement', status: 'In progress', crew: 'Crew A', value: '$18,420', progress: 68, date: 'Today' },
  { address: '308 Juniper Ridge', customer: 'Elliot Ramirez', type: 'Storm restoration', status: 'Inspection', crew: 'Unassigned', value: '$12,850', progress: 32, date: 'Tomorrow' },
  { address: '77 Cedar Lane', customer: 'Priya Shah', type: 'Repair + gutters', status: 'Scheduled', crew: 'Crew B', value: '$6,740', progress: 12, date: 'Oct 3' },
  { address: '611 Oak Park Ave', customer: 'The Morgan family', type: 'Full replacement', status: 'Needs review', crew: 'Crew C', value: '$22,180', progress: 84, date: 'Oct 4' },
]

const statusStyles: Record<string, string> = {
  'In progress': 'bg-[#e8f2ff] text-[#2d65aa]',
  Inspection: 'bg-[#fff3d9] text-[#a56b05]',
  Scheduled: 'bg-[#eaf7ef] text-[#26734a]',
  'Needs review': 'bg-[#fff0ec] text-[#bd5439]',
}

export default function Page() {
  const [activeNav, setActiveNav] = useState('Overview')
  const [query, setQuery] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [toast, setToast] = useState('')

  const visibleJobs = useMemo(() => jobs.filter((job) => `${job.address} ${job.customer} ${job.status}`.toLowerCase().includes(query.toLowerCase())), [query])
  const notify = (message: string) => { setToast(message); window.setTimeout(() => setToast(''), 2600) }

  return (
    <main className="min-h-screen bg-[#f7f8fa] text-[#17212b]">
      <aside className="fixed inset-y-0 left-0 hidden w-[232px] flex-col border-r border-[#e5e8ec] bg-[#fbfcfd] px-4 py-5 lg:flex">
        <div className="mb-10 flex items-center gap-2 px-2"><div className="flex size-8 items-center justify-center rounded-lg bg-[#f47b45] text-white shadow-sm"><Home size={17} strokeWidth={2.5} /></div><span className="text-[17px] font-bold tracking-[-0.03em]">roof<span className="text-[#f47b45]">os</span></span></div>
        <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#98a2ad]">Workspace</p>
        <nav className="space-y-1" aria-label="Main navigation">{['Overview', 'Jobs', 'Estimates', 'Customers', 'Crews', 'Reports'].map((item) => <button key={item} onClick={() => setActiveNav(item)} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[13px] font-semibold transition ${activeNav === item ? 'bg-[#fff0e9] text-[#d96134]' : 'text-[#6f7a85] hover:bg-[#f0f2f5] hover:text-[#17212b]'}`}><span className="w-5 text-center">{item === 'Overview' ? '◉' : item === 'Jobs' ? '▣' : item === 'Estimates' ? '≡' : item === 'Customers' ? '♧' : item === 'Crews' ? '♙' : '▤'}</span>{item}</button>)}</nav>
        <div className="mt-auto rounded-xl border border-[#e5e8ec] bg-white p-3"><div className="mb-2 flex items-center justify-between"><span className="text-[11px] font-bold text-[#66717c]">Season capacity</span><span className="text-[11px] font-bold text-[#d96134]">82%</span></div><div className="h-1.5 overflow-hidden rounded-full bg-[#edf0f2]"><div className="h-full w-[82%] rounded-full bg-[#f47b45]" /></div><p className="mt-2 text-[10px] leading-4 text-[#98a2ad]">You are on track for October targets.</p></div>
        <button className="mt-4 flex items-center gap-3 px-3 py-2 text-[12px] font-semibold text-[#7a858f]" onClick={() => notify('Settings are ready to configure')}><Settings2 size={16} />Settings</button>
      </aside>

      <div className="lg:pl-[232px]"><header className="flex h-[70px] items-center justify-between border-b border-[#e5e8ec] bg-white/90 px-5 backdrop-blur lg:px-9"><div className="flex items-center gap-3"><button className="lg:hidden" aria-label="Open navigation" onClick={() => notify('Use the desktop menu for full navigation')}><Menu size={20} /></button><div><p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#98a2ad]">Thursday, September 30, 2026</p><h1 className="mt-0.5 text-[19px] font-bold tracking-[-0.03em]">Good morning, Alex</h1></div></div><div className="flex items-center gap-3"><button aria-label="Search" className="hidden rounded-lg p-2 text-[#77828d] hover:bg-[#f3f5f7] sm:block" onClick={() => document.getElementById('job-search')?.focus()}><Search size={18} /></button><button aria-label="Notifications" className="relative rounded-lg p-2 text-[#77828d] hover:bg-[#f3f5f7]" onClick={() => notify('You have 3 new notifications')}><Bell size={18} /><span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-[#f47b45]" /></button><div className="flex size-8 items-center justify-center rounded-full bg-[#22394f] text-[11px] font-bold text-white">AL</div></div></header>
        <div className="mx-auto max-w-[1400px] px-5 py-7 lg:px-9"><div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="mb-1 text-[13px] font-semibold text-[#f47b45]">Your business at a glance</p><h2 className="text-[28px] font-bold tracking-[-0.045em] text-[#17212b]">Operations overview</h2></div><div className="flex gap-2"><button onClick={() => notify('Calendar view opened')} className="inline-flex items-center gap-2 rounded-lg border border-[#dfe4e8] bg-white px-3.5 py-2.5 text-[12px] font-bold text-[#5f6a75] shadow-sm hover:bg-[#fafbfc]"><CalendarDays size={15} />This week<ChevronDown size={14} /></button><button onClick={() => setShowAdd(true)} className="inline-flex items-center gap-2 rounded-lg bg-[#f47b45] px-3.5 py-2.5 text-[12px] font-bold text-white shadow-sm shadow-[#f47b45]/20 hover:bg-[#df6734]"><Plus size={15} />New job</button></div></div>

          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Business metrics"><Metric label="Active job value" value="$184,290" delta="12.8%" icon={<CircleDollarSign size={18} />} tone="orange" /><Metric label="Jobs this month" value="24" delta="4 more" icon={<ClipboardCheck size={18} />} tone="blue" /><Metric label="Estimates to close" value="8" delta="$62,480 total" icon={<FileText size={18} />} tone="green" /><Metric label="Avg. days to close" value="5.4" delta="0.8 days faster" icon={<Sparkles size={18} />} tone="purple" /></section>

          <section className="mt-7 grid gap-5 xl:grid-cols-[minmax(0,1fr)_330px]"><div className="min-w-0 rounded-xl border border-[#e5e8ec] bg-white shadow-[0_2px_7px_rgba(23,33,43,0.025)]"><div className="flex flex-col gap-3 border-b border-[#edf0f2] px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="text-[15px] font-bold">Active jobs</h3><p className="mt-0.5 text-[12px] text-[#96a0aa]">Keep a pulse on every roof in your pipeline.</p></div><div className="flex items-center gap-2"><label className="relative"><span className="sr-only">Search active jobs</span><Search className="absolute left-2.5 top-2.5 text-[#9aa4ad]" size={15} /><input id="job-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search jobs" className="h-9 w-full rounded-lg border border-[#e5e8ec] bg-[#fafbfc] pl-8 pr-3 text-[12px] outline-none ring-[#f47b45] placeholder:text-[#aab2b9] focus:ring-2 sm:w-[150px]" /></label><button className="rounded-lg border border-[#e5e8ec] p-2 text-[#77828d]" aria-label="Filter jobs" onClick={() => notify('Showing all active jobs')}><ChevronDown size={15} /></button></div></div><div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left"><thead className="bg-[#fafbfc] text-[10px] font-bold uppercase tracking-[0.11em] text-[#9aa4ad]"><tr><th className="px-5 py-3">Job / customer</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Crew</th><th className="px-3 py-3">Progress</th><th className="px-3 py-3">Value</th><th className="px-4 py-3"></th></tr></thead><tbody className="divide-y divide-[#edf0f2]">{visibleJobs.map((job) => <tr key={job.address} className="group hover:bg-[#fdfbf9]"><td className="px-5 py-4"><div className="text-[13px] font-bold text-[#27333e]">{job.address}</div><div className="mt-1 text-[11px] text-[#98a2ad]">{job.customer} · {job.type}</div></td><td className="px-3 py-4"><span className={`rounded-md px-2 py-1 text-[10px] font-bold ${statusStyles[job.status]}`}>{job.status}</span></td><td className="px-3 py-4 text-[12px] font-semibold text-[#68747f]">{job.crew}</td><td className="px-3 py-4"><div className="flex items-center gap-2"><div className="h-1.5 w-16 rounded-full bg-[#edf0f2]"><div className="h-full rounded-full bg-[#f47b45]" style={{ width: `${job.progress}%` }} /></div><span className="text-[11px] font-bold text-[#7d8892]">{job.progress}%</span></div></td><td className="px-3 py-4 text-[12px] font-bold text-[#27333e]">{job.value}</td><td className="px-4 py-4 text-right"><button aria-label={`More options for ${job.address}`} onClick={() => notify(`${job.address} selected`)} className="rounded-md p-1 text-[#a5adb5] hover:bg-[#f0f2f4] hover:text-[#27333e]"><MoreHorizontal size={17} /></button></td></tr>)}</tbody></table>{visibleJobs.length === 0 && <p className="px-5 py-10 text-center text-sm text-[#8b959e]">No jobs match your search.</p>}</div><div className="flex items-center justify-between border-t border-[#edf0f2] px-5 py-3"><span className="text-[11px] text-[#a0a9b1]">Showing {visibleJobs.length} of 24 jobs</span><button className="text-[11px] font-bold text-[#d96134] hover:underline" onClick={() => setActiveNav('Jobs')}>View all jobs <ArrowUpRight className="ml-1 inline" size={13} /></button></div></div>

          <aside className="space-y-5"><div className="rounded-xl border border-[#e5e8ec] bg-[#22394f] p-5 text-white"><div className="flex items-start justify-between"><div><p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#aebdca]">Weather watch</p><h3 className="mt-2 text-[21px] font-bold">Clear skies ahead</h3><p className="mt-1 text-[12px] text-[#c0ccd5]">Perfect conditions for your crews.</p></div><CloudSun className="text-[#ffc36c]" size={32} strokeWidth={1.5} /></div><div className="mt-6 flex items-end justify-between"><span className="text-[35px] font-light">74°</span><span className="text-right text-[11px] leading-4 text-[#c0ccd5]">Austin, TX<br />Low 58° · 0% rain</span></div></div><div className="rounded-xl border border-[#e5e8ec] bg-white p-5"><div className="flex items-center justify-between"><h3 className="text-[15px] font-bold">Today&apos;s checklist</h3><span className="rounded-full bg-[#eaf7ef] px-2 py-1 text-[10px] font-bold text-[#26734a]">3 / 5 done</span></div><div className="mt-4 space-y-3">{['Send 3 estimate follow-ups','Approve materials for Juniper Ridge','Schedule final inspection','Review Crew B timecards','Upload Willow Creek photos'].map((task, i) => <button key={task} onClick={() => notify(i < 3 ? 'Task already completed' : 'Task marked complete')} className="flex w-full items-center gap-3 text-left"><span className={`flex size-5 shrink-0 items-center justify-center rounded-full border ${i < 3 ? 'border-[#8fcea9] bg-[#eaf7ef] text-[#26734a]' : 'border-[#dce2e6] text-transparent'}`}><Check size={12} strokeWidth={3} /></span><span className={`text-[12px] ${i < 3 ? 'text-[#8c969f] line-through' : 'font-semibold text-[#4e5a65]'}`}>{task}</span></button>)}</div><button onClick={() => notify('Checklist opened')} className="mt-5 text-[11px] font-bold text-[#d96134] hover:underline">Open checklist <ArrowUpRight className="ml-1 inline" size={13} /></button></div><div className="rounded-xl border border-[#f2d6ca] bg-[#fff8f5] p-5"><div className="flex gap-3"><ShieldCheck size={19} className="shrink-0 text-[#e7774b]" /><div><h3 className="text-[13px] font-bold text-[#703d2e]">Insurance documents</h3><p className="mt-1 text-[11px] leading-4 text-[#9e6c5a]">2 crew certificates expire within 30 days.</p><button onClick={() => notify('Crew documents opened')} className="mt-3 text-[11px] font-bold text-[#d96134]">Review documents <ArrowUpRight className="ml-1 inline" size={13} /></button></div></div></div></aside></section>
        </div></div>
      {toast && <div role="status" className="fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-lg bg-[#17212b] px-4 py-3 text-xs font-semibold text-white shadow-xl"><Check size={15} className="text-[#7ee0a5]" />{toast}<button onClick={() => setToast('')} aria-label="Dismiss notification"><X size={14} /></button></div>}
      {showAdd && <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#17212b]/35 p-5" role="dialog" aria-modal="true" aria-labelledby="new-job-title"><div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"><div className="flex items-start justify-between"><div><h2 id="new-job-title" className="text-lg font-bold">Create a new job</h2><p className="mt-1 text-xs text-[#8c969f]">Start with the property and customer details.</p></div><button onClick={() => setShowAdd(false)} aria-label="Close dialog" className="rounded-md p-1 text-[#8c969f] hover:bg-[#f2f4f5]"><X size={18} /></button></div><div className="mt-5 space-y-3"><input aria-label="Property address" placeholder="Property address" className="h-10 w-full rounded-lg border border-[#e1e5e8] px-3 text-sm outline-none focus:ring-2 focus:ring-[#f47b45]" /><input aria-label="Customer name" placeholder="Customer name" className="h-10 w-full rounded-lg border border-[#e1e5e8] px-3 text-sm outline-none focus:ring-2 focus:ring-[#f47b45]" /></div><div className="mt-6 flex justify-end gap-2"><button onClick={() => setShowAdd(false)} className="rounded-lg px-4 py-2 text-xs font-bold text-[#697580]">Cancel</button><button onClick={() => { setShowAdd(false); notify('New job draft created') }} className="rounded-lg bg-[#f47b45] px-4 py-2 text-xs font-bold text-white">Create job</button></div></div></div>}
    </main>
  )
}

function Metric({ label, value, delta, icon, tone }: { label: string; value: string; delta: string; icon: React.ReactNode; tone: string }) {
  const tones: Record<string, string> = { orange: 'bg-[#fff0e9] text-[#df6734]', blue: 'bg-[#eaf2fb] text-[#3672b6]', green: 'bg-[#eaf7ef] text-[#26734a]', purple: 'bg-[#f1edfa] text-[#7656a5]' }
  return <div className="rounded-xl border border-[#e5e8ec] bg-white p-4 shadow-[0_2px_7px_rgba(23,33,43,0.025)]"><div className="flex items-center justify-between"><span className="text-[12px] font-semibold text-[#7f8a94]">{label}</span><span className={`flex size-8 items-center justify-center rounded-lg ${tones[tone]}`}>{icon}</span></div><p className="mt-3 text-[25px] font-bold tracking-[-0.04em]">{value}</p><p className="mt-1 text-[11px] font-semibold text-[#6fa17f]">↑ {delta}</p></div>
}
