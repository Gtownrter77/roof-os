'use client'

import { useEffect, useState } from 'react'
import { createClient } from '../../lib/supabase/client'

export default function MaterialsPage() {
  const supabase = createClient()
  const [rows, setRows] = useState<any[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    supabase.from('material_catalog').select('id,name,brand,category').order('name').limit(100)
      .then(({ data, error: queryError }) => {
        if (queryError) setError(queryError.message)
        else setRows(data ?? [])
      })
  }, [supabase])

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-24">
      <h1 className="text-2xl font-bold">Materials</h1>
      <p className="text-sm text-gray-600 mb-4">Catalog in your workspace. Store prices stay reference-only.</p>
      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
      {rows.length === 0 && !error && <p className="text-sm text-gray-500">No catalog rows yet. Seed comes from migration 019.</p>}
      {rows.map((row) => (
        <div key={row.id} className="bg-white rounded-lg shadow p-3 mb-2 text-sm">
          <p className="font-medium">{row.brand ? `${row.brand} ` : ''}{row.name}</p>
          <p className="text-gray-500">{row.category}</p>
        </div>
      ))}
    </div>
  )
}
