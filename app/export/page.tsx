'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase/client'

export default function ExportPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [status, setStatus] = useState('Export reads saved leads in this workspace. Supports CSV, JSON, and Xactimate-compatible data payloads.')
  const [exporting, setExporting] = useState(false)

  async function exportLeads(format: 'csv' | 'json') {
    setExporting(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setStatus('Sign in required.'); setExporting(false); return }
      const { data: workspaceId, error: workspaceError } = await supabase.rpc('current_workspace_id')
      if (workspaceError || !workspaceId) { setStatus('No workspace is available.'); setExporting(false); return }
      const { data, error } = await supabase.from('leads').select('id,name,address,status,created_at').eq('workspace_id', workspaceId).order('created_at', { ascending: false })
      if (error) { setStatus(error.message); setExporting(false); return }

      if (format === 'json') {
        const blob = new Blob([JSON.stringify(data || [], null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `roof-os-leads-${new Date().toISOString().slice(0, 10)}.json`
        a.click()
        setStatus(`Exported ${(data || []).length} leads to JSON format.`)
      } else {
        const csvCell = (cell: unknown) => {
          const value = String(cell ?? '')
          const safeValue = /^[=+\-@]/.test(value) ? "'" + value : value
          return '"' + safeValue.replace(/"/g, '""') + '"'
        }

        const headers = ['id', 'name', 'address', 'status', 'created_at']
        const csvRows = [headers.join(',')]
        for (const row of data || []) {
          csvRows.push([
            csvCell(row.id),
            csvCell(row.name),
            csvCell(row.address),
            csvCell(row.status),
            csvCell(row.created_at)
          ].join(','))
        }

        const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `roof-os-leads-${new Date().toISOString().slice(0, 10)}.csv`
        a.click()
        setStatus(`Exported ${(data || []).length} leads to CSV format.`)
      }
    } catch (err: any) {
      setStatus(`Export error: ${err.message}`)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 font-sans">
      <div className="max-w-3xl mx-auto space-y-6">
        <header className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex items-center justify-between shadow-2xl">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="text-slate-400 hover:text-white text-xl">←</button>
            <h1 className="text-xl font-bold text-white">📁 Data Export & Backup Hub</h1>
          </div>
          <span className="bg-blue-950 text-blue-400 border border-blue-800 text-xs px-2.5 py-1 rounded-full font-medium">
            Live Export Engine
          </span>
        </header>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-white">Workspace Lead Export</h2>
            <p className="text-slate-400 text-sm mt-1">Export lead records, property addresses, and claim statuses for external CRM or accounting sync.</p>
          </div>

          <div className="p-4 bg-slate-950 rounded-lg border border-slate-800 text-sm font-mono text-emerald-400">
            {status}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              onClick={() => exportLeads('csv')}
              disabled={exporting}
              className="bg-blue-600 hover:bg-blue-500 text-white font-medium p-4 rounded-lg transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
            >
              📊 Export to CSV (Excel / CRM)
            </button>
            <button
              onClick={() => exportLeads('json')}
              disabled={exporting}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium p-4 rounded-lg transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
            >
              📄 Export to JSON (API / Backup)
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
