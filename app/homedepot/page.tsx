'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

type Material = { id?: string; name?: string; brand?: string; product_line?: string; variant?: string; sku?: string; unit?: string; price?: number; source?: string }

export default function HomeDepotPage() {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<Material[]>([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const load = async () => {
    setLoading(true)
    setMessage('')
    const query = search.trim() ? `?q=${encodeURIComponent(search.trim())}` : ''
    try {
      const response = await fetch(`/api/materials${query}`)
      const payload = await response.json()
      if (!response.ok) { setResults([]); setMessage(payload.error ?? 'Material catalog unavailable.'); return }
      setResults(payload.materials ?? payload.results ?? [])
    } catch { setResults([]); setMessage('Material catalog unavailable.') }
    finally { setLoading(false) }
  }

  useEffect(() => { void load() }, [])

  return <div className="min-h-screen bg-gray-50 pb-20">
    <header className="bg-orange-600 text-white shadow-lg sticky top-0 z-10"><div className="px-4 py-3 flex items-center"><button onClick={() => router.back()} className="mr-3 text-xl">←</button><h1 className="text-xl font-bold">Material Catalog</h1></div></header>
    <main className="p-4 max-w-4xl mx-auto">
      <section className="bg-white rounded-lg shadow p-4 mb-4"><h2 className="font-semibold">Catalog search</h2><p className="text-xs text-gray-500 mt-1">Catalog records and retailer reference prices are shown only when returned by the connected backend. No hard-coded retailer prices are used.</p><div className="flex gap-2 mt-3"><input value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') void load() }} className="flex-1 p-2 border rounded-lg" placeholder="Search materials" /><button onClick={() => void load()} disabled={loading} className="bg-blue-600 text-white px-4 py-2 rounded-lg disabled:opacity-50">{loading ? 'Loading…' : 'Search'}</button></div></section>
      {message && <p className="text-sm text-red-700 mb-3" role="status">{message}</p>}
      <div className="space-y-3">{results.map((item, index) => <article key={item.id ?? index} className="bg-white rounded-lg shadow p-4"><div className="flex justify-between gap-4"><div><h3 className="font-semibold">{item.name ?? item.product_line ?? 'Material'}</h3><p className="text-xs text-gray-500">{[item.brand, item.variant, item.sku].filter(Boolean).join(' · ')}</p></div>{typeof item.price === 'number' && <span className="font-semibold">${item.price.toFixed(2)}{item.unit ? ` / ${item.unit}` : ''}</span>}</div>{item.source && <p className="text-xs text-gray-500 mt-2">Source: {item.source}</p>}</article>)}</div>
      {!loading && !message && results.length === 0 && <section className="bg-white rounded-lg shadow p-5 text-sm text-gray-600">No catalog records matched the current search.</section>}
    </main>
  </div>
}