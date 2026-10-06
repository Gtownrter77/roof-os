'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase/client'

type ReferenceProduct = {
  id: string
  name: string
  brand: string
  sku: string
  unit: string
  price: number | null
  inStock: boolean | null
  availability: string
  imageUrl: string | null
  url: string | null
}

const categories = [
  'Roofing',
  'Siding',
  'Windows',
  'Doors',
  'Gutters',
  'Decking',
  'Insulation',
  'Fasteners',
  'Tools',
  'Paint',
  'Lumber',
]

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function firstString(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
    if (typeof value === 'number') return String(value)
  }
  return ''
}

function firstNumber(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key]
    const number = typeof value === 'number' ? value : typeof value === 'string' ? Number(value.replace(/[$,]/g, '')) : NaN
    if (Number.isFinite(number)) return number
  }
  return null
}

function firstBoolean(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'boolean') return value
    if (typeof value === 'string') {
      if (/^(in stock|available|yes|true)$/i.test(value.trim())) return true
      if (/^(out of stock|unavailable|no|false)$/i.test(value.trim())) return false
    }
  }
  return null
}

function collectArrays(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) return payload.filter(isRecord)
  if (!isRecord(payload)) return []

  for (const key of ['products', 'items', 'results']) {
    if (Array.isArray(payload[key])) return payload[key].filter(isRecord)
  }

  const nestedData = payload.data
  if (Array.isArray(nestedData)) return nestedData.filter(isRecord)
  if (isRecord(nestedData)) return collectArrays(nestedData)

  return []
}

function normalizeProducts(payload: unknown): ReferenceProduct[] {
  return collectArrays(payload).slice(0, 24).map((item, index) => ({
    id: firstString(item, ['id', 'product_id', 'sku']) || `provider-${index}`,
    name: firstString(item, ['name', 'title', 'product_name', 'description']) || 'Unnamed Home Depot product',
    brand: firstString(item, ['brand', 'manufacturer']) || 'Unknown',
    sku: firstString(item, ['sku', 'product_number', 'model']) || 'Unknown',
    unit: firstString(item, ['unit', 'selling_unit', 'unit_of_measure']) || 'each',
    price: firstNumber(item, ['price', 'current_price', 'regular_price', 'retail_price']),
    inStock: firstBoolean(item, ['in_stock', 'inStock', 'available']),
    availability: firstString(item, ['availability', 'stock_status', 'inventory_status']) || 'Unknown',
    imageUrl: firstString(item, ['image', 'image_url', 'thumbnail']) || null,
    url: firstString(item, ['url', 'product_url', 'link']) || null,
  }))
}

export default function HomeDepotPage() {
  const router = useRouter()
  const searchControllerRef = useRef<AbortController | null>(null)
  const [search, setSearch] = useState('')
  const [zipcode, setZipcode] = useState('')
  const [results, setResults] = useState<ReferenceProduct[]>([])
  const [rawResponse, setRawResponse] = useState<unknown>(null)
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')

  const searchProducts = async (queryOverride = search.trim()) => {
    const query = queryOverride.trim()
    if (!query) {
      setError('Enter a product or select a category.')
      return
    }

    searchControllerRef.current?.abort()
    const controller = new AbortController()
    searchControllerRef.current = controller
    setLoading(true)
    setError('')
    setStatus('Looking up current Home Depot reference data…')
    setResults([])
    setRawResponse(null)

    try {
      const supabase = createClient()
      const { data: workspaceId, error: workspaceError } = await supabase.rpc('current_workspace_id')
      if (workspaceError || typeof workspaceId !== 'string') throw new Error('Active workspace is required for retailer reference pricing.')

      const params = new URLSearchParams({
        workspaceId,
        query,
      })
      if (zipcode.trim()) params.set('zipcode', zipcode.trim())

      const response = await fetch(`/api/pricing/home-depot?${params.toString()}`, {
        signal: controller.signal,
        cache: 'no-store',
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error ?? 'Home Depot reference lookup failed.')

      const normalized = normalizeProducts(payload.response)
      setResults(normalized)
      setRawResponse(payload.response)
      setStatus(
        normalized.length
          ? `${normalized.length} reference result(s) returned. Pricing and availability remain provider data, not an estimate or order.`
          : 'The provider returned data, but no standard product records could be safely normalized. Review the raw response below.'
      )
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      setError(err instanceof Error ? err.message : 'Home Depot reference lookup failed.')
      setStatus('')
    } finally {
      if (searchControllerRef.current === controller) {
        searchControllerRef.current = null
        setLoading(false)
      }
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-gradient-to-r from-orange-600 to-orange-500 text-white shadow-lg sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center">
          <button type="button" onClick={() => router.back()} className="text-white mr-3 text-xl" aria-label="Go back">←</button>
          <h1 className="text-xl font-bold">🏪 Home Depot Reference</h1>
          <span className="ml-2 bg-white/20 text-white text-xs px-2 py-0.5 rounded-full">SOURCE DATA</span>
        </div>
      </header>

      <main className="p-4">
        <div className="bg-white rounded-lg shadow p-4 mb-4">
          <p className="text-sm font-semibold">Retailer reference only</p>
          <p className="text-xs text-gray-600 mt-1">
            Results come from the configured Home Depot provider and workspace cache. ROOF/OS does not fabricate prices, stock, orders, or retailer quotes.
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-4 mb-4 border border-orange-200">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products…"
              aria-label="Search Home Depot products"
              className="p-2 border rounded-lg text-sm"
              onKeyDown={(e) => {
                if (e.key === 'Enter') void searchProducts()
              }}
            />
            <input
              type="text"
              value={zipcode}
              onChange={(e) => setZipcode(e.target.value.replace(/\D/g, '').slice(0, 5))}
              inputMode="numeric"
              maxLength={5}
              placeholder="ZIP code (optional)"
              aria-label="Home Depot ZIP code"
              className="p-2 border rounded-lg text-sm"
            />
          </div>
          <button
            type="button"
            onClick={() => void searchProducts()}
            disabled={loading}
            className="w-full mt-2 bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-60"
          >
            {loading ? 'Searching…' : '🔍 Search Home Depot'}
          </button>

          <div className="mt-3 flex flex-wrap gap-1">
            {categories.map((category) => (
              <button
                type="button"
                key={category}
                onClick={() => {
                  setCategory(category)
                  setSearch(category)
                  void searchProducts(category)
                }}
                className={`text-xs px-3 py-1 rounded-full ${
                  search === category ? 'bg-orange-600 text-white' : 'bg-gray-200 text-gray-700'
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>

        {status && <p className="bg-blue-50 text-blue-900 rounded-lg p-3 text-sm mb-4" role="status">{status}</p>}
        {error && <p className="bg-red-50 text-red-800 rounded-lg p-3 text-sm mb-4" role="alert">{error}</p>}

        {results.length > 0 && (
          <div className="space-y-3">
            {results.map((product) => (
              <div key={product.id} className="bg-white rounded-lg shadow p-4 border border-gray-200">
                <div className="flex gap-3">
                  {product.imageUrl ? (
                    <img src={product.imageUrl} alt="" className="w-16 h-16 object-contain rounded border" />
                  ) : (
                    <div className="w-16 h-16 rounded border flex items-center justify-center text-2xl" aria-hidden="true">🏪</div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm">{product.name}</p>
                    <p className="text-xs text-gray-500">{product.brand}</p>
                    <p className="text-xs text-gray-400">SKU: {product.sku} · Unit: {product.unit}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-orange-600">{product.price === null ? 'Unknown' : `$${product.price.toFixed(2)}`}</p>
                    <p className="text-xs text-gray-400">provider reference</p>
                  </div>
                </div>
                <div className="mt-2 flex gap-2 text-xs">
                  <span className={`px-2 py-1 rounded ${product.inStock === true ? 'bg-green-100 text-green-800' : product.inStock === false ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-700'}`}>
                    {product.inStock === true ? 'In stock' : product.inStock === false ? 'Out of stock' : product.availability}
                  </span>
                  {product.url && (
                    <a href={product.url} target="_blank" rel="noreferrer" className="text-blue-600 underline">
                      Provider product
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {rawResponse && (
          <details className="mt-4 bg-white rounded-lg shadow p-4">
            <summary className="cursor-pointer text-sm font-semibold">Raw provider response</summary>
            <pre className="mt-3 max-h-96 overflow-auto text-xs whitespace-pre-wrap break-words">{JSON.stringify(rawResponse, null, 2)}</pre>
          </details>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t flex justify-around py-2 px-4">
        <button type="button" onClick={() => router.push('/')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">🏠</span>
          <span className="text-xs">Home</span>
        </button>
        <button type="button" onClick={() => router.push('/homedepot')} className="flex flex-col items-center text-orange-600">
          <span className="text-xl">🏪</span>
          <span className="text-xs">HD</span>
        </button>
        <button type="button" onClick={() => router.push('/templates')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">📄</span>
          <span className="text-xs">Templates</span>
        </button>
        <button type="button" onClick={() => router.push('/upsell')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">💰</span>
          <span className="text-xs">Upsell</span>
        </button>
        <button type="button" onClick={() => router.push('/settings')} className="flex flex-col items-center text-gray-400">
          <span className="text-gray-400 text-xl">⚙️</span>
          <span className="text-xs">Settings</span>
        </button>
      </nav>
    </div>
  )
}
