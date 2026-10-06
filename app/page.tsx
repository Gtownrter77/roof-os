'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle, BarChart3, Bell, BriefcaseBusiness, CalendarDays, Camera,
  CheckCircle2, ChevronRight, CircleHelp, ClipboardList, CloudLightning, CloudRain,
  DollarSign, FileText, Gauge, Home as House, Layers3, MapPin, Menu, MessageCircle, PackageCheck,
  Radar, Ruler, Settings, Sparkles, Sun, Users, WalletCards,
  X, Zap,
} from 'lucide-react'
import { createClient } from '../lib/supabase/client'

type Lead = { id: string; name: string; address: string; status: string }
type Counts = { leads: number; openTasks: number; warranties: number }

const navItems = [
  { label: 'Dashboard', icon: House, path: '/' },
  { label: 'Storms & Weather', icon: CloudLightning, path: '/storms', badge: 3 },
  { label: 'Opportunities', icon: Radar, path: '/leads', badge: 47 },
  { label: 'Leads', icon: Users, path: '/leads', badge: 18 },
  { label: 'Inspections', icon: Camera, path: '/inspections', badge: 27 },
  { label: 'Measurements', icon: Ruler, path: '/measure', badge: 34 },
  { label: 'Estimates', icon: FileText, path: '/pricing', badge: 29 },
  { label: 'Customers', icon: BriefcaseBusiness, path: '/leads', badge: 22 },
  { label: 'Production', icon: PackageCheck, path: '/tasks', badge: 16 },
  { label: 'Payments', icon: WalletCards, path: '/payment', badge: 11 },
]

const pipeline = [
  { label: 'Storm', value: 12, status: 'Active', color: 'red', icon: CloudLightning },
  { label: 'Opportunities', value: 47, status: 'New', color: 'amber', icon: AlertTriangle },
  { label: 'Leads', value: 18, status: 'Qualified', color: 'blue', icon: Users },
  { label: 'Inspections', value: 27, status: 'Scheduled', color: 'purple', icon: Camera },
  { label: 'Measurements', value: 34, status: 'In Progress', color: 'cyan', icon: Ruler },
  { label: 'Estimates', value: 29, status: 'Sent', color: 'sky', icon: FileText },
  { label: 'Customers', value: 22, status: 'Approved', color: 'orange', icon: Users },
  { label: 'Production', value: 16, status: 'In Progress', color: 'pink', icon: PackageCheck },
  { label: 'Payments', value: 11, status: 'Completed', color: 'green', icon: DollarSign },
]

const activities = [
  { icon: CloudLightning, label: 'New lead from storm area', address: '123 Maple Dr, Douglasville, GA', time: '2m ago', tag: 'NEW', tone: 'green' },
  { icon: CalendarDays, label: 'Inspection scheduled', address: '742 Pine Ridge Rd', time: '6m ago', tag: 'SCHEDULED', tone: 'blue' },
  { icon: Ruler, label: 'Measurement completed', address: '980 Oak Valley Ln', time: '12m ago', tag: 'COMPLETED', tone: 'green' },
  { icon: FileText, label: 'Estimate approved', address: '1550 Williamsburg Ct', time: '18m ago', tag: 'APPROVED', tone: 'amber' },
  { icon: DollarSign, label: 'Payment received', address: '3227 Ridgway Dr', time: '27m ago', tag: 'PAID', tone: 'green' },
]

const jobs = [
  { id: '#RO-45821', address: '123 Maple Dr', stage: 'INSPECTION', progress: 72, color: 'purple' },
  { id: '#RO-45820', address: '742 Pine Ridge Rd', stage: 'MEASUREMENT', progress: 60, color: 'teal' },
  { id: '#RO-45819', address: '980 Oak Valley Ln', stage: 'ESTIMATE', progress: 45, color: 'blue' },
  { id: '#RO-45818', address: '1550 Williamsburg Ct', stage: 'PRODUCTION', progress: 80, color: 'pink' },
  { id: '#RO-45817', address: '3227 Ridgway Dr', stage: 'PAYMENT', progress: 100, color: 'green' },
]

const weather = [
  { day: 'Today', icon: CloudLightning, temp: '72° / 64°', note: 'Severe', color: 'red' },
  { day: 'Tue', icon: CloudRain, temp: '78° / 62°', note: 'Heavy Rain', color: 'amber' },
  { day: 'Wed', icon: CloudRain, temp: '81° / 60°', note: 'Showers', color: 'blue' },
  { day: 'Thu', icon: CloudRain, temp: '84° / 59°', note: 'Partly Cloudy', color: 'sky' },
  { day: 'Fri', icon: Sun, temp: '86° / 61°', note: 'Clear', color: 'amber' },
]

function Stat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return <div className="top-stat"><span>{label}</span><strong className={`text-${tone}`}>{value}</strong></div>
}

export default function Home() {
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [stormTheme, setStormTheme] = useState(true)
  const [counts, setCounts] = useState<Counts>({ leads: 18, openTasks: 16, warranties: 11 })
  const [recentLeads, setRecentLeads] = useState<Lead[]>([])

  useEffect(() => {
    const savedTheme = window.localStorage.getItem('roofos-storm-theme')
    if (savedTheme === 'off') setStormTheme(false)
  }, [])

  useEffect(() => {
    let cancelled = false
    async function load() {
      const supabase = createClient()
      const [leadsRes, recentRes, tasksRes, warrantyRes] = await Promise.all([
        supabase.from('leads').select('id', { count: 'exact', head: true }),
        supabase.from('leads').select('id,name,address,status').order('created_at', { ascending: false }).limit(5),
        supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('status', 'open'),
        supabase.from('warranties').select('id', { count: 'exact', head: true }).in('registration_status', ['not_started', 'packet_ready']),
      ])
      if (cancelled) return
      if (!leadsRes.error && leadsRes.count !== null) setCounts({ leads: leadsRes.count ?? 18, openTasks: tasksRes.count ?? 16, warranties: warrantyRes.count ?? 11 })
      if (!recentRes.error) setRecentLeads((recentRes.data ?? []) as Lead[])
    }
    void load()
    return () => { cancelled = true }
  }, [])

  const opportunityCount = useMemo(() => recentLeads.length ? Math.max(47, recentLeads.length) : 47, [recentLeads])

  return (
    <div className={`roof-shell ${stormTheme ? '' : 'standard-theme'}`}>
      <aside className={`roof-sidebar ${mobileOpen ? 'is-open' : ''}`}>
        <div className="brand-lockup"><div className="brand-mark"><span /><span /><span /></div><div><b>ROOF<span>/</span>OS</b><small>THE ROOFING OPERATING SYSTEM</small></div></div>
        <button className="mobile-close" onClick={() => setMobileOpen(false)} aria-label="Close menu"><X size={20} /></button>
        <nav className="sidebar-nav">
          {navItems.map(({ label, icon: Icon, path, badge }) => <button key={label} className={`sidebar-item ${label === 'Dashboard' ? 'active' : ''}`} onClick={() => router.push(path)}><Icon size={19} /><span>{label}</span>{badge && <em>{label === 'Opportunities' ? opportunityCount : badge}</em>}</button>)}
        </nav>
        <div className="sidebar-divider" />
        <nav className="sidebar-nav secondary-nav">
          <button className="sidebar-item" onClick={() => router.push('/reports')}><BarChart3 size={19} /><span>Reports</span></button>
          <button className="sidebar-item" onClick={() => router.push('/ai')}><Sparkles size={19} /><span>AI Assistant</span><i className="online-pill">ON</i></button>
          <button className="sidebar-item" onClick={() => router.push('/settings')}><Settings size={19} /><span>Settings</span></button>
          <button className="sidebar-item" onClick={() => router.push('/help')}><CircleHelp size={19} /><span>Help / Support</span></button>
          <button className="theme-setting" onClick={() => { const next = !stormTheme; setStormTheme(next); window.localStorage.setItem('roofos-storm-theme', next ? 'on' : 'off') }} aria-pressed={stormTheme}><Sun size={17} /><span>Storm Theme</span><i className={stormTheme ? 'on' : ''}><b /></i></button>
        </nav>
        <div className="system-card"><div><span className="live-dot" />System Online</div><small>v2.4.7<br />ROOF/OS</small></div>
      </aside>

      <main className="roof-main">
        <header className="command-header">
          <button className="mobile-menu" onClick={() => setMobileOpen(true)} aria-label="Open menu"><Menu size={22} /></button>
          <div className="alert-chip"><AlertTriangle size={17} fill="currentColor" /> <span>SEVERE WEATHER ACTIVE</span></div>
          <div className="location"><MapPin size={14} /> Douglasville, GA</div>
          <div className="current-weather"><Radar size={20} /><strong>72°</strong><span>Heavy Rain<br />Wind 28 mph<br /><b>Hail Possible</b></span></div>
          <div className="header-stats"><Stat label="Active Storms" value="3" tone="red" /><Stat label="New Opportunities" value={String(opportunityCount)} tone="green" /><Stat label="Jobs in Pipeline" value="312" tone="blue" /><Stat label="Revenue At Risk" value="$284K" tone="amber" /></div>
          <div className="header-actions"><button aria-label="Notifications"><Bell size={20} /><b>12</b></button><div className="profile"><div className="avatar">R</div><span>Ryan<small>Owner / Admin</small></span></div><button aria-label="Settings" onClick={() => router.push('/settings')}><Settings size={21} /></button></div>
        </header>

        <section className="hero-grid">
          <div className="hero-copy"><div className="eyebrow"><Zap size={13} fill="currentColor" /> WEATHER INTELLIGENCE COMMAND CENTER</div><h1>REAL STORMS.<br />REAL DAMAGE.<br /><span>REAL JOBS.</span></h1><p>ROOF/OS turns weather events<br />into closed jobs — automatically.</p><button className="primary-cta" onClick={() => router.push('/leads')}><span>WATCH THE PIPELINE</span><ChevronRight size={18} /></button></div>
          <div className="radar-card"><div className="panel-heading"><span><Radar size={17} /> Live Radar <i>Live</i></span><span className="radar-live"><span className="live-dot" /> Radar Live</span></div><div className="radar-map"><div className="storm-glow glow-one" /><div className="storm-glow glow-two" /><div className="map-road road-one" /><div className="map-road road-two" /><span className="city atlanta">Atlanta</span><span className="city carrollton">Carrollton</span><span className="city douglasville">Douglasville</span><span className="city newnan">Newnan</span><span className="city peachtree">Peachtree City</span><span className="highway h20">20</span><span className="highway h85">85</span><div className="storm-pin"><span /></div></div><div className="risk-list"><span><CheckCircle2 /> Radar Live</span><span><CheckCircle2 /> Storm Track</span><span><CheckCircle2 /> Hail Risk</span><span><CheckCircle2 /> Wind Gusts</span><span><CheckCircle2 /> Risk Zones</span></div><div className="radar-scale"><small>Light</small><div /><small>Extreme</small></div></div>
        </section>

        <section className="pipeline-panel panel-glass"><div className="pipeline-title"><div><h2><Layers3 size={18} /> ROOFING PIPELINE</h2><p>From storm to paid — all in one system.</p></div><div className="flow-meta"><span>Live Flow <i className="live-dot" /></span><Stat label="Jobs flowing" value="312" tone="blue" /><Stat label="Avg. Cycle Time" value="4.8 days" tone="blue" /><Stat label="Conversion Rate" value="68%" tone="green" /></div></div><div className="pipeline-track">{pipeline.map(({ label, value, status, color, icon: Icon }, index) => <div className={`pipeline-step ${color}`} key={label}><div className="pipeline-node"><Icon size={25} /></div>{index < pipeline.length - 1 && <div className="pipeline-arrow"><ChevronRight /></div>}<strong>{label}</strong><b>{value}</b><small>{status}</small></div>)}</div></section>

        <section className="dashboard-grid">
          <div className="panel-glass activity-panel"><div className="panel-heading"><h2><ActivityIcon /> LIVE ACTIVITY</h2><button>View All <ChevronRight size={14} /></button></div><div className="activity-list">{activities.map(({ icon: Icon, label, address, time, tag, tone }) => <div className="activity-row" key={label}><div className={`activity-icon ${tone}`}><Icon size={15} /></div><div className="activity-copy"><strong>{label}</strong><span>{address}</span></div><div className="activity-meta"><small>{time}</small><em className={tone}>{tag}</em></div></div>)}</div></div>
          <div className="panel-glass jobs-panel"><div className="panel-heading"><h2><ClipboardList size={17} /> ACTIVE JOBS</h2><button>View All <ChevronRight size={14} /></button></div><div className="jobs-list">{jobs.map((job) => <div className="job-row" key={job.id}><div className="house-thumb"><House size={19} /></div><div className="job-copy"><strong>{job.id}</strong><span>{job.address}</span></div><div className="job-progress"><em className={job.color}>{job.stage}</em><div><span style={{ width: `${job.progress}%` }} className={job.color} /></div><b>{job.progress}%</b></div></div>)}</div></div>
          <div className="panel-glass metrics-panel"><div className="panel-heading"><h2><Gauge size={17} /> LIVE METRICS</h2></div>{[['New Leads', '47', '↑ 32%', 'green'], ['Estimates Sent', '29', '↑ 27%', 'blue'], ['Jobs Closed', '11', '↑ 45%', 'green'], ['Revenue', '$284K', '↑ 38%', 'green']].map(([label, value, delta, tone]) => <div className="metric-row" key={label}><div><span>{label}</span><strong className={`text-${tone}`}>{value}</strong><em className={tone}>{delta}</em></div><div className={`sparkline ${tone}`}><span /><span /><span /><span /><span /><span /></div></div>)}</div>
          <div className="panel-glass outlook-panel"><div className="panel-heading"><h2><CloudRain size={17} /> WEATHER OUTLOOK</h2><button>7-Day Forecast</button></div>{weather.map(({ day, icon: Icon, temp, note, color }) => <div className="forecast-row" key={day}><Icon size={21} className={`text-${color}`} /><strong>{day}</strong><span>{temp}</span><em className={color}>{note}</em></div>)}</div>
        </section>
      </main>
      <footer className="mission-bar"><strong><Zap size={15} /> MISSION:</strong><span>TURN STORM DAMAGE INTO PROFIT.</span><i /> <span>SMARTER INSPECTIONS</span><i /> <span>FASTER ESTIMATES</span><i /> <span>MORE CLOSED JOBS</span><div className="mission-controls"><span>Animated Background</span><b /><button>Ⅱ Pause</button><button><Sun size={14} /> Off</button></div></footer>
    </div>
  )
}

function ActivityIcon() { return <MessageCircle size={17} /> }
