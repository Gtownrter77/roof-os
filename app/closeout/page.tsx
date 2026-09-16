'use client'

import { useEffect, useState } from 'react'
import { createClient } from '../../lib/supabase/client'

const NEED = ['before', 'damage', 'completed']

export default function CloseoutPage() {
  const supabase = createClient()
  const [have, setHave] = useState<string[]>([])

  useEffect(() => {
    supabase.from('inspection_photos').select('album').limit(500).then(({ data }) => {
      setHave(Array.from(new Set((data ?? []).map((row: { album?: string }) => row.album || 'general'))))
    })
  }, [supabase])

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-24">
      <h1 className="text-2xl font-bold">Closeout gate</h1>
      <p className="text-sm text-gray-600 mb-4">Missing albums block “ready.” They do not block drafting.</p>
      {NEED.map((album) => (
        <div key={album} className="bg-white rounded-lg shadow p-3 mb-2 flex justify-between text-sm">
          <span>{album}</span>
          <span>{have.includes(album) ? 'on file' : 'missing'}</span>
        </div>
      ))}
    </div>
  )
}
