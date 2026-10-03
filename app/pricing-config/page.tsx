'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

type Rate = { rate: number; unit: string; description: string }
type Rates = Record<string, Rate>
const CATEGORIES: Array<[string, string, string]> = [
  ['roofing', 'Roofing', 'sq'], ['siding', 'Siding', 'sq'], ['windows', 'Windows', 'each'], ['doors', 'Doors', 'each'],
  ['gutters', 'Gutters', 'ft'], ['decking', 'Decking', 'sq'], ['drywall', 'Drywall', 'sq'], ['painting', 'Painting', 'sq'],
  ['electrical', 'Electrical', 'hr'], ['plumbing', 'Plumbing', 'hr'], ['hvac', 'HVAC', 'hr'], ['demo', 'Demolition', 'hr'],
  ['cleanup', 'Cleanup', 'hr'], ['inspection', 'Inspection', 'hr'], ['consulting', 'Consulting', 'hr'],
]
const emptyRates = (): Rates => Object.fromEntries(CATEGORIES.map(([key, label, unit]) => [key, { rate: 0, unit, description: `${label} labor` }]))

export default function PricingConfigPage() {
  const router = useRouter()
  const [rates, setRates] = useState<Rates>(emptyRates)
  const [taxRates, setTaxRates] = useState({ state: 0, county: 0, city: 0, specialDistrict: 0 })
  const [taxSource, setTaxSource] = useState('')
  const [market, setMarket] = useState('')
  const [source, setSource] = useState('unconfigured')
  const [status, setStatus] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/pricing/labor-rates').then(async (response) => {
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error ?? 'Could not load price book.')
      const loaded = emptyRates()
      for (const [key, value] of Object.entries(payload.rates ?? {})) if (loaded[key]) loaded[key] = { ...loaded[key], rate: Number(value) }
      setRates(loaded)
      setTaxRates({ state: Number(payload.taxRates?.state ?? 0), county: Number(payload.taxRates?.county ?? 0), city: Number(payload.taxRates?.city ?? 0), specialDistrict: Number(payload.taxRates?.specialDistrict ?? 0) })
      setTaxSource(payload.taxSource ?? '')
      setMarket(payload.priceBook?.market ?? '')
      setSource(payload.source === 'owner-managed' ? 'owner-managed' : 'unconfigured')
      if (payload.warning) setStatus(payload.warning)
    }).catch((error) => setStatus(error instanceof Error ? error.message : 'Could not load price book.'))
  }, [])

  const updateRate = (key: string, value: string) => {
    const number = Number(value)
    if (Number.isFinite(number) && number >= 0) setRates((current) => ({ ...current, [key]: { ...current[key], rate: number } }))
  }

  const save = async () => {
    setSaving(true); setStatus('')
    try {
      const response = await fetch('/api/pricing/labor-rates', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ rates: Object.fromEntries(Object.entries(rates).map(([key, value]) => [key, value.rate])), market: market.trim() || 'owner-defined market', taxRates, taxSource: taxSource.trim() }) })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error ?? 'Could not save price book.')
      setSource('owner-managed')
      setStatus(`Saved draft price book ${payload.priceBookId}. Review and activate it before external quoting.`)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not save price book.')
    } finally { setSaving(false) }
  }

  const combinedTax = Object.values(taxRates).reduce((sum, value) => sum + value, 0)

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-blue-700 text-white shadow sticky top-0 z-10"><div className="px-4 py-3 flex items-center"><button onClick={() => router.back()} className="mr-3 text-xl" aria-label="Back">←</button><h1 className="text-xl font-bold">Owner Price Book</h1></div></header>
      <main className="p-4 max-w-3xl mx-auto space-y-4">
        <section className="bg-white rounded-lg shadow p-4">
          <div className="flex justify-between gap-3"><div><h2 className="font-semibold">Owner-managed labor rates</h2><p className="text-xs text-gray-500 mt-1">No market rate is assumed. Enter the rates you actually use.</p></div><span className="text-xs px-2 py-1 rounded bg-slate-100 text-slate-700">{source}</span></div>
          <label className="block text-sm font-medium mt-4">Market / service area<input value={market} onChange={(e) => setMarket(e.target.value)} className="mt-1 w-full p-2 border rounded-lg" placeholder="Owner-defined market" /></label>
          <div className="mt-4 space-y-2">{CATEGORIES.map(([key, label, unit]) => <label key={key} className="grid grid-cols-[1fr_120px_70px] gap-2 items-center text-sm"><span>{label}</span><input type="number" min="0" step="0.01" value={rates[key]?.rate ?? 0} onChange={(e) => updateRate(key, e.target.value)} className="p-2 border rounded-lg" /><span className="text-xs text-gray-500">{unit}</span></label>)}</div>
        </section>

        <section className="bg-white rounded-lg shadow p-4">
          <h2 className="font-semibold">Jurisdiction tax</h2><p className="text-xs text-gray-500 mt-1">Enter verified local rates and record where the rates came from. ROOF/OS does not infer them from a state table.</p>
          <div className="grid grid-cols-2 gap-3 mt-3">{([['state','State'],['county','County'],['city','City / municipality'],['specialDistrict','Special district']] as const).map(([key,label]) => <label key={key} className="text-sm">{label}<input type="number" min="0" max="100" step="0.0001" value={taxRates[key]} onChange={(e) => setTaxRates((current) => ({ ...current, [key]: Number(e.target.value) || 0 }))} className="mt-1 w-full p-2 border rounded-lg" /></label>)}</div>
          <p className="text-xs text-gray-600 mt-2">Combined rate: {combinedTax.toFixed(4)}%</p>
          <label className="block text-sm mt-3">Tax source / jurisdiction<input value={taxSource} onChange={(e) => setTaxSource(e.target.value)} maxLength={200} className="mt-1 w-full p-2 border rounded-lg" placeholder="Official source or owner-verified jurisdiction reference" /></label>
        </section>

        {status && <p className="bg-slate-100 border rounded-lg p-3 text-sm" role="status">{status}</p>}
        <button onClick={() => void save()} disabled={saving} className="w-full bg-blue-700 text-white py-3 rounded-lg font-semibold disabled:opacity-50">{saving ? 'Saving…' : 'Save Draft Price Book'}</button>
        <button onClick={() => router.push('/pricing')} className="w-full bg-white border border-slate-300 py-3 rounded-lg font-semibold">Back to Pricing</button>
      </main>
    </div>
  )
}
