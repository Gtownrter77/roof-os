'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase/client'

export default function ExportPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [status, setStatus] = useState('Export reads saved leads in this workspace. Import is Unknown.')

  async function exportLeads() {
    const supabase = createClient()
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setStatus('Sign in required.'); return }
      const { data: workspaceId, error: workspaceError } = await supabase.rpc('current_workspace_id')
      if (workspaceError || !workspaceId) { setStatus('No workspace is available.'); return }
      const { data, error } = await supabase.from('leads').select('id,name,address,status,created_at').eq('workspace_id', workspaceId).order('created_at', { ascending: false })
      if (error) { setStatus(error.message); return }

      const csvCell = (cell: unknown) => {
        const value = String(cell ?? 'Unknown')
        const safeValue = /^[=+\-@]/.test(value) ? "'" + value : value
        return '"' + safeValue.replace(/"/g, '""') + '"'
      }
      const rows = [['id', 'name', 'address', 'status', 'created_at'], ...(data ?? []).map((lead) => [lead.id, lead.name ?? 'Unknown', lead.address ?? 'Unknown', lead.status ?? 'Unknown', lead.created_at ?? 'Unknown'])]
      const csv = rows.map((row) => row.map(csvCell).join(',')).join('\n')
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
      const link = document.createElement('a')
      link.href = url
      link.download = 'roof-os-leads-' + new Date().toISOString().slice(0, 10) + '.csv'
      link.click()
      URL.revokeObjectURL(url)
      setStatus(data && data.length ? 'Exported ' + data.length + ' saved leads.' : 'No saved leads. Nothing invented.')
    } catch {
      setStatus('Could not export leads because the workspace request failed.')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-blue-600 text-white shadow-lg sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center">
          <button onClick={() => router.back()} className="text-white mr-3 text-xl">Back</button>
          <h1 className="text-xl font-bold">Export</h1>
        </div>
      </header>
      <main className="p-4 space-y-3">
        <p className="text-sm bg-white rounded-lg shadow p-4">{status}</p>
        <button onClick={exportLeads} className="w-full bg-blue-600 text-white py-3 rounded font-semibold">Export saved leads</button>
      </main>
    </div>
  )
}
