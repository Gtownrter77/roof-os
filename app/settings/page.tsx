'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

type Settings = { price_refresh_frequency: string; default_language: string; default_zipcode: string; preferred_brands: Record<string, string>; material_search_mode: string }
type TaxRates = { state: number; county: number; city: number; specialDistrict: number }
const initialSettings: Settings = { price_refresh_frequency: 'weekly', default_language: 'en-US', default_zipcode: '', preferred_brands: { shingles: 'GAF' }, material_search_mode: 'catalog_and_retailer' }
const initialTax: TaxRates = { state: 0, county: 0, city: 0, specialDistrict: 0 }

export default function SettingsPage() {
  const router = useRouter()
  const [settings, setSettings] = useState<Settings>(initialSettings)
  const [taxRates, setTaxRates] = useState<TaxRates>(initialTax)
  const [taxSource, setTaxSource] = useState('')
  const [loaded, setLoaded] = useState(false)
  const [message, setMessage] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    Promise.all([fetch('/api/settings'), fetch('/api/pricing/labor-rates')]).then(async ([settingsResponse, pricingResponse]) => {
      const settingsPayload = await settingsResponse.json(); const pricingPayload = await pricingResponse.json()
      if (settingsResponse.ok && settingsPayload.settings) setSettings({ ...initialSettings, ...settingsPayload.settings, preferred_brands: { ...initialSettings.preferred_brands, ...(settingsPayload.settings.preferred_brands ?? {}) } })
      if (pricingResponse.ok) { setTaxRates({ ...initialTax, ...(pricingPayload.taxRates ?? {}) }); setTaxSource(pricingPayload.taxSource ?? '') }
      setLoaded(true)
    }).catch(() => { setLoaded(true); setMessage('Could not load saved settings.') })
  }, [])

  const updateTax = (key: keyof TaxRates, value: string) => setTaxRates(prev => ({ ...prev, [key]: Number(value) || 0 }))
  const totalTax = Object.values(taxRates).reduce((sum, rate) => sum + rate, 0)

  const save = async () => {
    setMessage('Saving owner settings…')
    const settingsResponse = await fetch('/api/settings', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(settings) })
    const pricingResponse = await fetch('/api/pricing/labor-rates', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ rates: {}, market: settings.default_zipcode || 'owner-defined market', taxRates, taxSource }) })
    const settingsPayload = await settingsResponse.json(); const pricingPayload = await pricingResponse.json()
    setMessage(settingsResponse.ok && pricingResponse.ok ? `Saved. Combined tax rate is ${totalTax.toFixed(4)}%. Pricing remains a draft until owner review and activation.` : (settingsPayload.error ?? pricingPayload.error ?? 'Could not save settings.'))
  }

  const refreshPrices = async () => {
    setRefreshing(true); setMessage('Refreshing the active Home Depot watchlist…')
    const response = await fetch('/api/pricing/refresh', { method: 'POST' }); const payload = await response.json()
    setRefreshing(false); setMessage(response.ok ? `Manual refresh complete: ${payload.count ?? 0} watchlist item(s) processed.` : (payload.error ?? 'Manual refresh failed.'))
  }

  return <div className="min-h-screen bg-gray-50 pb-20">
    <header className="bg-blue-600 text-white shadow-lg sticky top-0 z-10"><div className="px-4 py-3 flex items-center"><button onClick={() => router.back()} className="mr-3 text-xl">←</button><h1 className="text-xl font-bold">Settings</h1></div></header>
    <main className="p-4 max-w-2xl mx-auto space-y-4">
      <section className="bg-white rounded-lg shadow p-4"><h2 className="font-semibold mb-1">Pricing refresh</h2><p className="text-xs text-gray-500 mb-3">Weekly is the default. Manual refresh uses the approved retailer watchlist and the 100-inquiry monthly budget.</p><label className="block text-sm">Update frequency<select value={settings.price_refresh_frequency} onChange={e => setSettings({ ...settings, price_refresh_frequency: e.target.value })} className="w-full mt-1 p-2 border rounded"><option value="weekly">Weekly</option><option value="manual">Manual only</option><option value="disabled">Disabled</option></select></label><button onClick={refreshPrices} disabled={refreshing || settings.price_refresh_frequency === 'disabled'} className="mt-3 bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50">{refreshing ? 'Refreshing…' : 'Refresh prices now'}</button></section>
      <section className="bg-white rounded-lg shadow p-4"><h2 className="font-semibold mb-1">Tax jurisdiction</h2><p className="text-xs text-gray-500 mb-3">Rates are stored separately and added only in the owner-managed draft price book.</p><div className="grid grid-cols-2 gap-3">{([['state','State'],['county','County'],['city','City / municipality'],['specialDistrict','Special district']] as const).map(([key, label]) => <label key={key} className="text-sm">{label}<div className="flex items-center mt-1"><input type="number" min="0" max="100" step="0.0001" value={taxRates[key]} onChange={e => updateTax(key, e.target.value)} className="w-full p-2 border rounded" /><span className="ml-1">%</span></div></label>)}</div><p className="mt-3 text-sm font-semibold">Combined rate: {totalTax.toFixed(4)}%</p><label className="block mt-3 text-sm">Tax source / jurisdiction<input value={taxSource} onChange={e => setTaxSource(e.target.value)} maxLength={200} className="w-full mt-1 p-2 border rounded" placeholder="Cobb County, GA — owner verified" /></label></section>
      <section className="bg-white rounded-lg shadow p-4"><h2 className="font-semibold mb-1">Language and material search</h2><div className="space-y-3"><label className="block text-sm">Default language<select value={settings.default_language} onChange={e => setSettings({ ...settings, default_language: e.target.value })} className="w-full mt-1 p-2 border rounded"><option value="en-US">English (US)</option><option value="es-US">Spanish (US)</option></select></label><label className="block text-sm">Default ZIP code<input value={settings.default_zipcode} onChange={e => setSettings({ ...settings, default_zipcode: e.target.value })} inputMode="numeric" maxLength={5} className="w-full mt-1 p-2 border rounded" placeholder="30123" /></label><label className="block text-sm">Material search mode<select value={settings.material_search_mode} onChange={e => setSettings({ ...settings, material_search_mode: e.target.value })} className="w-full mt-1 p-2 border rounded"><option value="catalog_and_retailer">Catalog plus retailer reference</option><option value="catalog_only">Catalog only</option></select></label><label className="block text-sm">Preferred shingle brand<input value={settings.preferred_brands.shingles ?? ''} onChange={e => setSettings({ ...settings, preferred_brands: { ...settings.preferred_brands, shingles: e.target.value } })} className="w-full mt-1 p-2 border rounded" placeholder="GAF" /></label></div></section>
      <button onClick={save} disabled={!loaded} className="w-full bg-blue-600 text-white py-3 rounded font-semibold disabled:opacity-50">Save owner settings</button>{message && <p className="text-sm bg-blue-50 text-blue-900 rounded p-3">{message}</p>}
    </main>
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t flex justify-around py-2 px-4"><button onClick={() => router.push('/')} className="text-gray-500">Home</button><button onClick={() => router.push('/pricing-config')} className="text-gray-500">Pricing</button><button onClick={() => router.push('/settings')} className="text-blue-600">Settings</button></nav>
  </div>
}
