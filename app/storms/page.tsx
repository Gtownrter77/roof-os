import Link from 'next/link'
import { ArrowLeft, ShieldAlert } from 'lucide-react'
import WorkspaceWeather from '../../components/WorkspaceWeather'

export default function StormsPage() {
  return (
    <main className="min-h-screen bg-[#070b14] px-3 pb-24 pt-5 text-slate-100 md:px-6 md:pt-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-cyan-300 hover:underline"><ArrowLeft className="h-4 w-4" /> Dashboard</Link>
        <header className="rounded-2xl border border-red-300/15 bg-gradient-to-r from-[#24111a] via-slate-950 to-slate-950 p-5 md:p-7">
          <div className="flex items-center gap-3"><ShieldAlert className="h-7 w-7 text-red-300" /><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-red-200">Location-specific · source-linked</p><h1 className="text-2xl font-black text-white md:text-3xl">Storms & alerts</h1></div></div>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">Shows only active NWS alerts returned for the workspace service ZIP, with a link to the official alert. A weather alert is not proof of roof damage, a loss date, or an insurance outcome.</p>
        </header>
        <WorkspaceWeather variant="full" />
      </div>
    </main>
  )
}
