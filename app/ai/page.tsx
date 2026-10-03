'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase/client'

export default function AIPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [leads, setLeads] = useState<{id:string; name:string|null}[]>([])
  const [leadId, setLeadId] = useState('')
  const [status, setStatus] = useState('Loading saved leads.')
  const [loading, setLoading] = useState(false)
  const [report, setReport] = useState('')
  const [inspectionData, setInspectionData] = useState({
    address: '',
    city: '',
    state: '',
    date: '',
    inspector: '',
    roofCondition: '',
    stormDamage: '',
    recommendations: 'Replace damaged shingles, inspect flashing'
  })


  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { if (!cancelled) setStatus('Sign in required.'); return }
      const { data: workspaceId, error: workspaceError } = await supabase.rpc('current_workspace_id')
      if (workspaceError || !workspaceId) { if (!cancelled) setStatus('No workspace is available.'); return }
      const { data, error } = await supabase.from('leads').select('id,name').eq('workspace_id', workspaceId).order('created_at', { ascending: false }).limit(50)
      if (cancelled) return
      if (error) { setStatus(error.message); return }
      setLeads(data ?? [])
      setStatus(data && data.length ? 'Choose a lead. No model is called.' : 'No saved leads.')
    }
    load()
    return () => { cancelled = true }
  }, [supabase])

  const generateReport = async () => {
    setLoading(true)
    setReport('')
    const { data: { user } } = await supabase.auth.getUser()
    const { data: workspaceId } = await supabase.rpc('current_workspace_id')
    if (!user || !workspaceId || !leadId) { setStatus('A signed-in workspace and a saved lead are required.'); setLoading(false); return }
    const body = `Inspection notes saved. Address: ${inspectionData.address || 'Unknown'}. City: ${inspectionData.city || 'Unknown'}. State: ${inspectionData.state || 'Unknown'}. Date: ${inspectionData.date || 'Unknown'}. Inspector: ${inspectionData.inspector || 'Unknown'}. Condition: ${inspectionData.roofCondition || 'Unknown'}. Storm: ${inspectionData.stormDamage || 'Unknown'}. Notes: ${inspectionData.recommendations || 'none'}. No model called. Report not generated.`
    const { error } = await supabase.from('lead_activity').insert({ lead_id: leadId, workspace_id: workspaceId, user_id: user.id, kind: 'note', body })
    setStatus(error ? error.message : 'Notes saved on the lead. No report was generated.')
    setLoading(false)
  }

  const downloadReport = () => {
    const blob = new Blob([report], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `inspection-report-${inspectionData.address.replace(/\s/g, '')}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-blue-600 text-white shadow-lg sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center">
          <button onClick={() => router.back()} className="text-white mr-3 text-xl">←</button>
          <h1 className="text-xl font-bold">🤖 AI Report Generator</h1>
        </div>
      </header>

      <main className="p-4"><label className="block text-sm bg-white rounded-lg shadow p-4 mb-4">Saved lead<select value={leadId} onChange={(event) => setLeadId(event.target.value)} className="mt-1 w-full rounded border p-2"><option value="">Choose a lead</option>{leads.map((lead) => <option key={lead.id} value={lead.id}>{lead.name || lead.id}</option>)}</select><p className="text-xs text-gray-500 mt-2">{status}</p></label><p className="text-sm bg-white rounded-lg shadow p-4 mb-4">No model was called. Result is Unknown.</p><p className="text-sm bg-white rounded-lg shadow p-4 mb-4">This draft stays in this browser. It is not saved, not an inspection, and not a bid.</p>
        {/* Input Section */}
        <div className="bg-white rounded-lg shadow p-4 mb-4">
          <h2 className="font-semibold text-sm mb-3">📝 Inspection Details</h2>
          <div className="space-y-3">
            <input 
              type="text" 
              value={inspectionData.address}
              onChange={(e) => setInspectionData({...inspectionData, address: e.target.value})}
              className="w-full p-2 border rounded-lg text-sm"
              placeholder="Address"
            />
            <input 
              type="text" 
              value={inspectionData.roofCondition}
              onChange={(e) => setInspectionData({...inspectionData, roofCondition: e.target.value})}
              className="w-full p-2 border rounded-lg text-sm"
              placeholder="Roof Condition"
            />
            <textarea 
              value={inspectionData.recommendations}
              onChange={(e) => setInspectionData({...inspectionData, recommendations: e.target.value})}
              className="w-full p-2 border rounded-lg text-sm"
              rows={3}
              placeholder="Recommendations"
            />
          </div>
        </div>

        {/* Generate Button */}
        <button 
          onClick={generateReport}
          disabled={loading}
          className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold disabled:opacity-50 flex items-center justify-center"
        >
          {loading ? '⏳ Generating...' : '🤖 Generate AI Report'}
        </button>

        {/* Report Output */}
        {report && (
          <div className="mt-4">
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-semibold text-sm">📄 Generated Report</h3>
                <button 
                  onClick={downloadReport}
                  className="bg-green-600 text-white px-3 py-1 rounded text-sm"
                >
                  ⬇️ Download
                </button>
              </div>
              <pre className="whitespace-pre-wrap text-sm text-gray-700 bg-gray-50 p-3 rounded">
                {report}
              </pre>
            </div>

            {/* Approval Workflow */}
            <div className="mt-4 bg-white rounded-lg shadow p-4">
              <h3 className="font-semibold text-sm mb-3">✅ Approval Workflow</h3>
              <div className="flex space-x-2">
                <button className="flex-1 bg-green-600 text-white py-2 rounded-lg text-sm">
                  ✅ Approve
                </button>
                <button className="flex-1 bg-yellow-600 text-white py-2 rounded-lg text-sm">
                  ✏️ Edit
                </button>
                <button className="flex-1 bg-red-600 text-white py-2 rounded-lg text-sm">
                  ❌ Reject
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-2">⚠️ Report must be reviewed before sending</p>
            </div>
          </div>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t flex justify-around py-2 px-4">
        <button onClick={() => router.push('/')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">🏠</span>
          <span className="text-xs">Home</span>
        </button>
        <button onClick={() => router.push('/leads')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">👤</span>
          <span className="text-xs">Leads</span>
        </button>
        <button onClick={() => router.push('/ai')} className="flex flex-col items-center text-blue-600">
          <span className="text-xl">🤖</span>
          <span className="text-xs">AI</span>
        </button>
        <button onClick={() => router.push('/notifications')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">🔔</span>
          <span className="text-xs">Alerts</span>
        </button>
        <button onClick={() => router.push('/settings')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">⚙️</span>
          <span className="text-xs">Settings</span>
        </button>
      </nav>
    </div>
  )
}
