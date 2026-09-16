'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase/client'

const ALBUMS = ['before', 'damage', 'measurements', 'materials', 'work_in_progress', 'completed', 'general']

export default function AlbumsPage() {
  const router = useRouter()
  const supabase = createClient()
  const [counts, setCounts] = useState<Record<string, number>>({})

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('inspection_photos').select('album').limit(500)
      const next: Record<string, number> = {}
      ALBUMS.forEach((album) => { next[album] = 0 })
      ;(data ?? []).forEach((row: { album?: string }) => {
        const key = row.album || 'general'
        next[key] = (next[key] || 0) + 1
      })
      setCounts(next)
    }
    void load()
  }, [supabase])

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-24">
      <button onClick={() => router.push('/third10')} className="text-blue-600 text-sm mb-3">Third 10</button>
      <h1 className="text-2xl font-bold">Albums</h1>
      <p className="text-sm text-gray-600 mb-4">Guided sets. Markup on the image is not in this slice. Originals stay in Storage.</p>
      {ALBUMS.map((album) => (
        <div key={album} className="bg-white rounded-lg shadow p-3 mb-2 flex justify-between">
          <span className="text-sm font-medium">{album.replaceAll('_', ' ')}</span>
          <span className="text-sm text-gray-500">{counts[album] ?? 0}</span>
        </div>
      ))}
      <button onClick={() => router.push('/camera')} className="mt-3 w-full bg-blue-600 text-white py-2 rounded font-semibold">Add photos</button>
    </div>
  )
}
