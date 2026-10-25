'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

type PublicPassport = {
  property_address: string
  homeowner_name: string | null
  material_system: string | null
  manufacturer: string | null
  color: string | null
  install_date: string | null
  status: string
}

export default function SharedPassportPage() {
  const params = useParams<{ token: string }>()
  const [passport, setPassport] = useState<PublicPassport | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    async function load() {
      try {
        const res = await fetch(`/api/passport/public?token=${encodeURIComponent(params.token)}`, { signal: controller.signal })
        const body = await res.json() as { passport?: PublicPassport; error?: string }
        if (!res.ok || !body.passport) {
          setError(body.error ?? 'This passport link is not available.')
          return
        }
        setPassport(body.passport)
      } catch {
        if (!controller.signal.aborted) setError('This passport link could not be loaded.')
      }
    }
    void load()
    return () => controller.abort()
  }, [params.token])

  return (
    <main className="ops-bg flex min-h-screen items-center justify-center p-4">
      <section className="w-full max-w-lg glass rounded-2xl p-6">
        <p className="text-xs uppercase tracking-wide text-slate-500">ROOF/OS Roof Passport</p>
        <h1 className="mt-2 text-2xl font-bold">Your roof record</h1>

        {error && <p className="mt-4 text-sm text-red-300" role="alert">{error}</p>}

        {!error && !passport && <p className="mt-4 text-sm text-slate-300">Loading your roof record…</p>}

        {passport && (
          <dl className="mt-5 space-y-3 text-sm">
            <Row label="Property" value={passport.property_address} />
            {passport.homeowner_name && <Row label="Homeowner" value={passport.homeowner_name} />}
            <Row label="Material system" value={passport.material_system} />
            <Row label="Manufacturer" value={passport.manufacturer} />
            <Row label="Color" value={passport.color} />
            <Row label="Installed" value={passport.install_date} />
            <Row label="Status" value={passport.status} />
          </dl>
        )}

        <p className="mt-6 text-xs text-slate-500">This is a read-only record shared by your roofing contractor. It does not expose customer, pricing, or workspace data.</p>
      </section>
    </main>
  )
}

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-white/5 pb-2">
      <dt className="text-slate-400">{label}</dt>
      <dd className="text-right font-medium text-slate-100">{value || '—'}</dd>
    </div>
  )
}
