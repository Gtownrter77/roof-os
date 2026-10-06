'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

type RateEntry = { rate: number | null; unit: string; quantity: number }
type PricingState = {
  materials: Record<string, RateEntry>
  labor: Record<string, RateEntry>
  overhead: number | null
  profit: number | null
  salesTax: number | null
  permits: number | null
  dumpFees: number | null
}

const MATERIALS = {
  shingles: { unit: 'sq' },
  underlayment: { unit: 'roll' },
  flashing: { unit: 'ft' },
  gutters: { unit: 'ft' },
  dripEdge: { unit: 'ft' },
  iceWaterShield: { unit: 'roll' },
  ridgeVent: { unit: 'ft' },
  starterShingles: { unit: 'ft' },
} as const

const LABOR = {
  tearOff: { unit: 'sq', key: 'demo' },
  installation: { unit: 'sq', key: 'roofing' },
  flashingWork: { unit: 'hr' },
  gutterWork: { unit: 'hr' },
  cleanup: { unit: 'hr' },
} as const

const initialPricing: PricingState = {
  materials: Object.fromEntries(Object.entries(MATERIALS).map(([key, value]) => [key, { rate: null, unit: value.unit, quantity: 0 }])) ,
  labor: Object.fromEntries(Object.entries(LABOR).map(([key, value]) => [key, { rate: null, unit: value.unit, quantity: 0 }])) ,
  overhead: null,
  profit: null,
  salesTax: null,
  permits: null,
  dumpFees: null,
}

function formatMoney(value: number) {
  return '$' + value.toFixed(2)
}

export default function PricingPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [sourceMessage, setSourceMessage] = useState('No owner-managed price book is loaded.')
  const [pricing, setPricing] = useState<PricingState>(initialPricing)
  const [roofArea, setRoofArea] = useState('')
  const [totals, setTotals] = useState({
    materials: 0,
    labor: 0,
    overhead: 0,
    profit: 0,
    taxes: 0,
    total: 0,
    perSquare: 0,
    complete: false,
  })

  useEffect(() => {
    let cancelled = false

    async function loadOwnerRates() {
      try {
        const response = await fetch('/api/pricing/labor-rates', { cache: 'no-store' })
        const payload = await response.json()
        if (cancelled) return

        if (!response.ok) {
          setSourceMessage(payload.error ?? 'Owner pricing source could not be loaded.')
          return
        }

        if (payload.source !== 'owner-managed' || !payload.priceBook) {
          setSourceMessage('No active owner-managed price book is available. Enter approved rates manually or configure pricing first.')
          return
        }

        setPricing((current) => {
          const labor = { ...current.labor }
          for (const [key, entry] of Object.entries(labor)) {
            const sourceKey = LABOR[key as keyof typeof LABOR]?.key ?? key
            const value = Number(payload.rates?.[sourceKey])
            labor[key] = { ...entry, rate: Number.isFinite(value) ? value : null }
          }
          return {
            ...current,
            labor,
            salesTax: Number(payload.localTaxRate) / 100,
          }
        })
        setSourceMessage(`Owner-managed price book loaded: ${payload.priceBook.name ?? 'unnamed price book'}. Material rates still require sourced values.`)
      } catch {
        if (!cancelled) setSourceMessage('Could not load the owner-managed price source.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadOwnerRates()
    return () => {
      cancelled = true
    }
  }, [])

  const updateQuantities = (area: number) => {
    if (!Number.isFinite(area) || area < 0) return
    const squares = area / 100
    setRoofArea(area ? String(area) : '')
    setPricing((current) => ({
      ...current,
      labor: {
        ...current.labor,
        tearOff: { ...current.labor.tearOff, quantity: squares },
        installation: { ...current.labor.installation, quantity: squares },
      },
    }))
  }

  const updateEntry = (category: 'materials' | 'labor', item: string, field: 'rate' | 'quantity', value: string) => {
    const parsed = value === '' ? null : Number(value)
    if (parsed !== null && (!Number.isFinite(parsed) || parsed < 0)) return
    setPricing((current) => ({
      ...current,
      [category]: {
        ...current[category],
        [item]: {
          ...current[category][item],
          [field]: parsed ?? 0,
          ...(field === 'rate' ? { rate: parsed } : { quantity: parsed ?? 0 }),
        },
      },
    }))
  }

  const updateScalar = (field: 'overhead' | 'profit' | 'salesTax' | 'permits' | 'dumpFees', value: string) => {
    const parsed = value === '' ? null : Number(value)
    if (parsed !== null && (!Number.isFinite(parsed) || parsed < 0)) return
    setPricing((current) => ({ ...current, [field]: parsed }))
  }

  useEffect(() => {
    const materialMissing = Object.values(pricing.materials).some((item) => item.quantity > 0 && item.rate === null)
    const laborMissing = Object.values(pricing.labor).some((item) => item.quantity > 0 && item.rate === null)
    const percentageMissing = pricing.overhead === null || pricing.profit === null || pricing.salesTax === null
    const feeMissing = pricing.permits === null || pricing.dumpFees === null
    const complete = !materialMissing && !laborMissing && !percentageMissing && !feeMissing

    if (!complete) {
      setTotals((current) => ({ ...current, complete: false }))
      return
    }

    const materialTotal = Object.values(pricing.materials).reduce((sum, item) => sum + (item.rate ?? 0) * item.quantity, 0)
    const laborTotal = Object.values(pricing.labor).reduce((sum, item) => sum + (item.rate ?? 0) * item.quantity, 0)
    const overhead = materialTotal * (pricing.overhead ?? 0) / 100
    const profit = (materialTotal + laborTotal + overhead) * (pricing.profit ?? 0) / 100
    const taxes = (materialTotal + laborTotal + overhead + profit + (pricing.permits ?? 0) + (pricing.dumpFees ?? 0)) * (pricing.salesTax ?? 0) / 100
    const total = materialTotal + laborTotal + overhead + profit + taxes + (pricing.permits ?? 0) + (pricing.dumpFees ?? 0)
    const squares = Number(roofArea) / 100

    setTotals({
      materials: materialTotal,
      labor: laborTotal,
      overhead,
      profit,
      taxes,
      total,
      perSquare: squares > 0 ? total / squares : 0,
      complete: true,
    })
  }, [pricing, roofArea])

  return (
    <div className="ops-bg min-h-screen lg:pl-[232px] pb-16">
      <header className="glass sticky top-0 z-10 border-x-0 border-t-0">
        <div className="mx-auto flex max-w-[1240px] items-center px-4 py-3">
          <button type="button" onClick={() => router.back()} className="mr-3 text-xl text-cyan-300" aria-label="Go back">←</button>
          <h1 className="text-xl font-black">💰 Draft Pricing Calculator</h1>
          <span className="ml-2 rounded bg-amber-500 px-2 py-1 text-xs font-bold text-black">SOURCE-GATED</span>
        </div>
      </header>

      <main className="mx-auto max-w-[1240px] p-4">
        <div className="glass mb-4 rounded-xl p-4">
          <p className="text-sm font-semibold">Pricing source status</p>
          <p className="mt-1 text-sm text-slate-300">{loading ? 'Checking for an owner-managed price book…' : sourceMessage}</p>
          <p className="mt-2 text-xs text-amber-300">No customer total is calculated until every used rate, markup, tax, and fee has an explicit entered/source value.</p>
        </div>

        <div className="glass mb-4 rounded-xl p-4">
          <h3 className="font-semibold text-sm mb-3">📐 Planning quantity input</h3>
          <div className="flex gap-2">
            <input
              type="number"
              min="0"
              placeholder="Roof area (sq ft)"
              value={roofArea}
              onChange={(e) => updateQuantities(Number(e.target.value))}
              className="flex-1 p-2 border rounded-lg text-black"
              aria-label="Roof area in square feet"
            />
            <button type="button" onClick={() => updateQuantities(Number(roofArea) || 0)} className="rounded-lg bg-gradient-to-r from-blue-600 to-cyan-500 px-4 py-2 text-white">
              Calculate quantities
            </button>
          </div>
          <p className="mt-2 text-xs text-slate-400">1 square = 100 sq ft. Only tear-off and installation square quantities are derived here; remaining quantities must be field-entered.</p>
        </div>

        <div className="glass mb-4 rounded-xl p-4">
          <h3 className="font-semibold text-sm mb-3">🧱 Material inputs</h3>
          <div className="space-y-2">
            {Object.entries(pricing.materials).map(([key, item]) => (
              <div key={key} className="grid grid-cols-4 gap-2 items-center">
                <span className="text-xs capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
                <input type="number" min="0" step="0.01" value={item.rate ?? ''} placeholder="Unknown" onChange={(e) => updateEntry('materials', key, 'rate', e.target.value)} className="w-full rounded border border-white/15 bg-black/25 p-1 text-xs text-white" aria-label={key + ' rate'} />
                <input type="number" min="0" step="0.01" value={item.quantity} onChange={(e) => updateEntry('materials', key, 'quantity', e.target.value)} className="w-full rounded border border-white/15 bg-black/25 p-1 text-xs text-white" aria-label={key + ' quantity'} />
                <span className="text-xs font-medium text-right">{item.rate === null ? 'Unknown' : formatMoney(item.rate * item.quantity)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="glass mb-4 rounded-xl p-4">
          <h3 className="font-semibold text-sm mb-3">👷 Labor inputs</h3>
          <div className="space-y-2">
            {Object.entries(pricing.labor).map(([key, item]) => (
              <div key={key} className="grid grid-cols-4 gap-2 items-center">
                <span className="text-xs capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
                <input type="number" min="0" step="0.01" value={item.rate ?? ''} placeholder="Unknown" onChange={(e) => updateEntry('labor', key, 'rate', e.target.value)} className="w-full rounded border border-white/15 bg-black/25 p-1 text-xs text-white" aria-label={key + ' labor rate'} />
                <input type="number" min="0" step="0.01" value={item.quantity} onChange={(e) => updateEntry('labor', key, 'quantity', e.target.value)} className="w-full rounded border border-white/15 bg-black/25 p-1 text-xs text-white" aria-label={key + ' labor quantity'} />
                <span className="text-xs font-medium text-right">{item.rate === null ? 'Unknown' : formatMoney(item.rate * item.quantity)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="glass mb-4 rounded-xl p-4">
          <h3 className="font-semibold text-sm mb-3">📊 Owner-entered markup and fees</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {([
              ['overhead', 'Overhead %'],
              ['profit', 'Profit %'],
              ['salesTax', 'Sales tax %'],
              ['permits', 'Permit fee'],
              ['dumpFees', 'Dump fees'],
            ] as const).map(([key, label]) => (
              <label key={key} className="text-xs text-slate-400">
                {label}
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={pricing[key] ?? ''}
                  placeholder="Unknown"
                  onChange={(e) => updateScalar(key, e.target.value)}
                  className="w-full mt-1 rounded border border-white/15 bg-black/25 p-2 text-sm text-white"
                />
              </label>
            ))}
          </div>
        </div>

        <div className="rounded-xl border-2 border-cyan-400/50 bg-cyan-400/10 p-4 mb-4">
          {!totals.complete ? (
            <div className="space-y-2">
              <p className="text-lg font-bold">Customer total: Unknown</p>
              <p className="text-sm text-slate-300">Complete every rate and fee used by this draft before a numeric total can be calculated.</p>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex justify-between"><span className="text-sm">Materials</span><span className="font-medium">{formatMoney(totals.materials)}</span></div>
              <div className="flex justify-between"><span className="text-sm">Labor</span><span className="font-medium">{formatMoney(totals.labor)}</span></div>
              <div className="flex justify-between"><span className="text-sm">Overhead</span><span className="font-medium">{formatMoney(totals.overhead)}</span></div>
              <div className="flex justify-between"><span className="text-sm">Profit</span><span className="font-medium">{formatMoney(totals.profit)}</span></div>
              <div className="flex justify-between"><span className="text-sm">Taxes</span><span className="font-medium">{formatMoney(totals.taxes)}</span></div>
              <div className="border-t pt-2 border-blue-300 flex justify-between text-lg font-bold">
                <span>Draft total</span>
                <span className="text-cyan-300">{formatMoney(totals.total)}</span>
              </div>
              <div className="flex justify-between text-sm text-gray-500">
                <span>Per square</span><span>{formatMoney(totals.perSquare)}</span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 mt-4">
            <button type="button" onClick={() => router.push('/photo-estimate')} className="rounded-lg bg-blue-600 py-2 text-sm text-white">Open Photo Estimate</button>
            <button type="button" onClick={() => router.push('/pricing-config')} className="rounded-lg bg-emerald-600 py-2 text-sm text-white">Configure Source Rates</button>
          </div>
        </div>

        <div className="glass rounded-xl p-3 text-center">
          <p className="text-xs text-gray-300">Retailer reference data belongs in the Home Depot/Lowe&apos;s provider screens. This page never invents a retailer price.</p>
          <p className="text-[11px] text-gray-500 mt-1">A draft total is not a carrier rate, licensed Xactimate price, or customer quote until your approved workflow says otherwise.</p>
        </div>
      </main>
    </div>
  )
}
