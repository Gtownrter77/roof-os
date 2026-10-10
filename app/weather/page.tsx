import Link from 'next/link'
import { ArrowLeft, CloudLightning } from 'lucide-react'
import WorkspaceWeather from '../../components/WorkspaceWeather'

export default function WeatherPage() {
  return (
    <main className="min-h-screen bg-[#070b14] px-3 pb-24 pt-5 text-slate-100 md:px-6 md:pt-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-cyan-300 hover:underline"><ArrowLeft className="h-4 w-4" /> Dashboard</Link>
        <header className="rounded-2xl border border-white/10 bg-gradient-to-r from-slate-900 to-slate-950 p-5 md:p-7">
          <div className="flex items-center gap-3"><CloudLightning className="h-7 w-7 text-cyan-300" /><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">NOAA/NWS sources</p><h1 className="text-2xl font-black text-white md:text-3xl">Weather & radar</h1></div></div>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">The map follows the service-area ZIP saved in workspace Settings. Radar is the latest available NOAA/NWS MRMS quality-controlled base-reflectivity composite; forecasts and alerts come from the National Weather Service. If a source is unavailable, the status is shown as unknown.</p>
          <Link
            href="/radar"
            className="mt-4 inline-flex items-center rounded-lg bg-cyan-400 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-cyan-300"
          >
            Open radar cinema →
          </Link>
        </header>
        <WorkspaceWeather variant="full" />
      </div>
    </main>
  )
}
