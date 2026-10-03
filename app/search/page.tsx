'use client'


import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase/client'

type Lead = { id: string; name: string | null; address: string | null; status: string | null }

export default function SearchPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Lead[]>([])
  const [status, setStatus] = useState('Search reads this workspace only.')

  async function handleSearch(event: React.FormEvent) {
    event.preventDefault()
    const term = query.trim()
    if (term.length < 2) {
      setResults([])
      setStatus('Type at least 2 characters.')
      return
    }
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setStatus('Sign in required.')
      setResults([])
      return
    }
    const { data: workspaceId, error: workspaceError } = await supabase.rpc('current_workspace_id')
    if (workspaceError || !workspaceId) {
      setStatus('No workspace is available.')
      setResults([])
      return
    }
    const safe = term.replace(/[%_,]/g, ' ')
    const { data, error } = await supabase.from('leads').select('id,name,address,status').eq('workspace_id', workspaceId).or(`name.ilike.%${safe}%,address.ilike.%${safe}%`).limit(25)
    if (error) {
      setStatus(error.message)
      setResults([])
      return
    }
    setResults(data ?? [])
    setStatus(data && data.length ? 'Results are saved leads in this workspace.' : 'No matching lead. Other record types are Unknown.')
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-blue-600 text-white shadow-lg sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center">
          <button onClick={() => router.back()} className="text-white mr-3 text-xl">Back</button>
          <h1 className="text-xl font-bold">Search</h1>
        </div>
      </header>
      <main className="p-4 space-y-3">
        <form onSubmit={handleSearch} className="flex gap-2">
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search lead name or address" className="flex-1 p-3 border rounded-lg" />
          <button type="submit" className="bg-blue-600 text-white px-4 py-3 rounded-lg font-semibold">Search</button>
        </form>
        <p className="text-sm bg-white rounded-lg shadow p-4">{status}</p>
        {results.map((lead) => (
          <button key={lead.id} onClick={() => router.push(`/leads/${lead.id}`)} className="w-full text-left bg-white rounded-lg shadow p-4">
            <p className="font-semibold text-sm">{lead.name || 'Unknown'}</p>
            <p className="text-xs text-gray-500">{lead.address || 'Unknown'} · {lead.status || 'Unknown'}</p>
          </button>
        ))}
      </main>
    </div>
  )
}
