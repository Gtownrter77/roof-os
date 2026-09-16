'use client'

import { useEffect, useState } from 'react'
import { createClient } from '../../lib/supabase/client'

export default function SupplementPage() {
  const supabase = createClient()
  const [rows, setRows] = useState<any[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    supabase.from('supplements').select('id,status,created_at').order('created_at', { ascending: false }).limit(50)
      .then(({ data, error: queryError }) => {
        if (queryError) setError(queryError.message)
        else setRows(data ?? [])
      })
  }, [supabase])

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-24">
      <h1 className="text-2xl font-bold">Supplements</h1>
      <p className="text-sm text-gray-600 mb-4">Review list. No carrier PDF reader in this slice.</p>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {rows.length === 0 && !error && <p className="text-sm text-gray-500">No supplement records yet.</p>}
      {rows.map((row) => (
        <div key={row.id} className="bg-white rounded-lg shadow p-3 mb-2 text-sm">{row.status} · {row.id.slice(0, 8)}</div>
      ))}
    </div>
  )
}
