'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase/client'

type Message = { id: string; body: string; created_at: string; user_id: string }

export default function ChatPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [rows, setRows] = useState<Message[]>([])
  const [body, setBody] = useState('')
  const [status, setStatus] = useState('Checking workspace messages.')
  const [userId, setUserId] = useState('')

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setStatus('Sign in required.'); return }
    setUserId(user.id)
    const { data: workspaceId, error: workspaceError } = await supabase.rpc('current_workspace_id')
    if (workspaceError || !workspaceId) { setStatus('No workspace is available.'); return }
    const { data, error } = await supabase.from('workspace_messages').select('id,body,created_at,user_id').eq('workspace_id', workspaceId).order('created_at', { ascending: true }).limit(100)
    if (error) { setStatus(error.message); setRows([]); return }
    setRows(data ?? [])
    setStatus(data && data.length ? 'Saved workspace messages.' : 'No saved messages. Migration 044 must be applied before a send can persist.')
  }

  useEffect(() => { load() }, [supabase])

  async function send(event: React.FormEvent) {
    event.preventDefault()
    const text = body.trim()
    if (!text) return
    const { data: { user } } = await supabase.auth.getUser()
    const { data: workspaceId } = await supabase.rpc('current_workspace_id')
    if (!user || !workspaceId) { setStatus('Sign in and workspace are required.'); return }
    const { error } = await supabase.from('workspace_messages').insert({ workspace_id: workspaceId, user_id: user.id, body: text })
    if (error) { setStatus(error.message); return }
    setBody('')
    await load()
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-blue-600 text-white shadow-lg sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center">
          <button onClick={() => router.back()} className="text-white mr-3 text-xl">Back</button>
          <h1 className="text-xl font-bold">Chat</h1>
        </div>
      </header>
      <main className="p-4 space-y-3">
        <p className="text-sm bg-white rounded-lg shadow p-4">{status}</p>
        {rows.map((row) => (
          <div key={row.id} className="bg-white rounded-lg shadow p-4">
            <p className="text-sm">{row.body}</p>
            <p className="text-xs text-gray-500">{row.user_id === userId ? 'You' : 'Workspace member'} · {new Date(row.created_at).toLocaleString()}</p>
          </div>
        ))}
        <form onSubmit={send} className="flex gap-2">
          <input value={body} onChange={(event) => setBody(event.target.value)} className="flex-1 p-3 border rounded-lg" placeholder="Message this workspace" />
          <button className="bg-blue-600 text-white px-4 py-3 rounded-lg font-semibold">Send</button>
        </form>
      </main>
    </div>
  )
}
