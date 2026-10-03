'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase/client'

export default function DeckPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [loading, setLoading] = useState(false)
  const [estimate, setEstimate] = useState<any>(null)
  const [leads, setLeads] = useState<{id:string; name:string|null}[]>([])
  const [leadId, setLeadId] = useState('')
  const [status, setStatus] = useState('Loading saved leads.')

  const [form, setForm] = useState({
    deckSize: 0,
    height: 0,
    material: 'Pressure Treated',
    deckingType: 'Composite',
    includesRails: true,
    includesStairs: false,
    includesLighting: false,
    includesBuiltInSeating: false,
    includesPlanterBoxes: false,
    includesPergola: false,
    hasHotTub: false,
    includesScreening: false,
    includesSkirting: false,
    railingType: 'Wood',
    stairCount: 0,
    complexity: 'Standard',
    state: 'GA',
  })

  const deckMaterials = [
    'Pressure Treated', 'Cedar', 'Redwood', 'Composite', 'PVC', 
    'Tropical Hardwood', 'Aluminum', 'Steel'
  ]

  const deckingTypes = ['Composite', 'Wood', 'PVC', 'Aluminum']
  const railingTypes = ['Wood', 'Composite', 'Metal', 'Glass', 'Cable']
  const complexities = ['Standard', 'Complex', 'Custom', 'Luxury']


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
      setStatus(data && data.length ? 'Choose a lead. Price stays Unknown.' : 'No saved leads.')
    }
    load()
    return () => { cancelled = true }
  }, [supabase])

  const calculateEstimate = async () => {
    setEstimate(null)
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { data: workspaceId } = await supabase.rpc('current_workspace_id')
    if (!user || !workspaceId || !leadId) { setStatus('A signed-in workspace and a saved lead are required.'); setLoading(false); return }
    const body = `Deck measurements saved. Measurements: ${JSON.stringify(form)}. Price Unknown. No dollar figure written.`
    const { error } = await supabase.from('lead_activity').insert({ lead_id: leadId, workspace_id: workspaceId, user_id: user.id, kind: 'note', body })
    setStatus(error ? error.message : 'Saved on the lead. Price remains Unknown.')
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-lg sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center">
          <button onClick={() => router.back()} className="text-white mr-3 text-xl">←</button>
          <h1 className="text-xl font-bold">🪵 Deck Estimator</h1>
          <span className="ml-2 bg-green-500 text-white text-xs px-2 py-0.5 rounded-full animate-pulse">PRO</span>
        </div>
      </header>

      <main className="p-4"><p className="text-sm bg-white rounded-lg shadow p-4 mb-4">Price is Unknown. This screen does not write a dollar figure. A human approves every price.</p><label className="block text-sm bg-white rounded-lg shadow p-4 mb-4">Saved lead<select value={leadId} onChange={(event) => setLeadId(event.target.value)} className="mt-1 w-full rounded border p-2"><option value="">Choose a lead</option>{leads.map((lead) => <option key={lead.id} value={lead.id}>{lead.name || lead.id}</option>)}</select><p className="text-xs text-gray-500 mt-2">{status}</p></label>
        {/* Inputs */}
        <div className="bg-white rounded-lg shadow-lg p-4 mb-4 border border-amber-200">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500">Deck Size (sq ft)</label>
              <input
                type="number"
                value={form.deckSize || ''}
                onChange={(e) => setForm({...form, deckSize: Number(e.target.value)})}
                className="w-full p-2 border rounded-lg text-sm"
                placeholder="200"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500">Height (ft)</label>
              <input
                type="number"
                value={form.height || ''}
                onChange={(e) => setForm({...form, height: Number(e.target.value)})}
                className="w-full p-2 border rounded-lg text-sm"
                placeholder="8"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500">Material</label>
              <select
                value={form.material}
                onChange={(e) => setForm({...form, material: e.target.value})}
                className="w-full p-2 border rounded-lg text-sm"
              >
                {deckMaterials.map((m) => <option key={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500">Complexity</label>
              <select
                value={form.complexity}
                onChange={(e) => setForm({...form, complexity: e.target.value})}
                className="w-full p-2 border rounded-lg text-sm"
              >
                {complexities.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Features */}
        <div className="bg-white rounded-lg shadow-lg p-4 mb-4 border border-amber-200">
          <h3 className="font-semibold text-sm mb-2">🛠️ Features</h3>
          <div className="grid grid-cols-2 gap-1">
            <label className="flex items-center text-xs"><input type="checkbox" checked={form.includesRails} onChange={(e) => setForm({...form, includesRails: e.target.checked})} className="mr-1" /> Railing</label>
            <label className="flex items-center text-xs"><input type="checkbox" checked={form.includesStairs} onChange={(e) => setForm({...form, includesStairs: e.target.checked})} className="mr-1" /> Stairs</label>
            <label className="flex items-center text-xs"><input type="checkbox" checked={form.includesLighting} onChange={(e) => setForm({...form, includesLighting: e.target.checked})} className="mr-1" /> Lighting</label>
            <label className="flex items-center text-xs"><input type="checkbox" checked={form.includesBuiltInSeating} onChange={(e) => setForm({...form, includesBuiltInSeating: e.target.checked})} className="mr-1" /> Seating</label>
            <label className="flex items-center text-xs"><input type="checkbox" checked={form.includesPlanterBoxes} onChange={(e) => setForm({...form, includesPlanterBoxes: e.target.checked})} className="mr-1" /> Planters</label>
            <label className="flex items-center text-xs"><input type="checkbox" checked={form.includesPergola} onChange={(e) => setForm({...form, includesPergola: e.target.checked})} className="mr-1" /> Pergola</label>
            <label className="flex items-center text-xs"><input type="checkbox" checked={form.hasHotTub} onChange={(e) => setForm({...form, hasHotTub: e.target.checked})} className="mr-1" /> Hot Tub Base</label>
            <label className="flex items-center text-xs"><input type="checkbox" checked={form.includesScreening} onChange={(e) => setForm({...form, includesScreening: e.target.checked})} className="mr-1" /> Screening</label>
          </div>
        </div>

        <button
          onClick={calculateEstimate}
          disabled={loading}
          className="w-full bg-gradient-to-r from-amber-600 to-orange-600 text-white py-3 rounded-lg font-semibold disabled:opacity-50"
        >
          {loading ? '⏳ Calculating...' : '🪵 Auto Estimate Deck'}
        </button>

        {estimate && (
          <div className="mt-4 space-y-4 animate-fadeIn">
            <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-lg shadow-lg p-4 border border-amber-200">
              <div className="grid grid-cols-3 gap-2">
                <div className="text-center">
                  <p className="text-xs text-gray-500">Grand Total</p>
                  <p className="text-2xl font-bold text-amber-600">Unknown</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-500">Per Sq Ft</p>
                  <p className="text-xl font-bold text-orange-600">Unknown</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-500">Total Sq Ft</p>
                  <p className="text-xl font-bold text-green-600">{estimate.summary.sqFt}</p>
                </div>
              </div>
            </div>

            {/* Breakdown */}
            <div className="bg-white rounded-lg shadow-lg p-4 border border-amber-200">
              <h3 className="font-semibold text-sm mb-2">📊 Breakdown</h3>
              <div className="space-y-1">
                <div className="flex justify-between text-sm border-b py-1">
                  <span>Decking</span>
                  <span>Unknown</span>
                </div>
                <div className="flex justify-between text-sm border-b py-1">
                  <span>Framing</span>
                  <span>Unknown</span>
                </div>
                {estimate.breakdown.railing.included && (
                  <div className="flex justify-between text-sm border-b py-1">
                    <span>Railing</span>
                    <span>Unknown</span>
                  </div>
                )}
                {estimate.breakdown.stairs.included && (
                  <div className="flex justify-between text-sm border-b py-1">
                    <span>Stairs ({estimate.breakdown.stairs.count})</span>
                    <span>Unknown</span>
                  </div>
                )}
                {estimate.breakdown.lighting.included && (
                  <div className="flex justify-between text-sm border-b py-1">
                    <span>Lighting</span>
                    <span>Unknown</span>
                  </div>
                )}
                {estimate.breakdown.seating.included && (
                  <div className="flex justify-between text-sm border-b py-1">
                    <span>Seating</span>
                    <span>Unknown</span>
                  </div>
                )}
                {estimate.breakdown.planters.included && (
                  <div className="flex justify-between text-sm border-b py-1">
                    <span>Planters</span>
                    <span>Unknown</span>
                  </div>
                )}
                {estimate.breakdown.pergola.included && (
                  <div className="flex justify-between text-sm border-b py-1">
                    <span>Pergola</span>
                    <span>Unknown</span>
                  </div>
                )}
                {estimate.breakdown.hotTub.included && (
                  <div className="flex justify-between text-sm border-b py-1">
                    <span>Hot Tub Base</span>
                    <span>Unknown</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-bold pt-2">
                  <span>Total Materials</span>
                  <span>Unknown</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Labor ({estimate.labor.hours.toFixed(0)} hrs rate Unknown)</span>
                  <span>Unknown</span>
                </div>
                <div className="flex justify-between text-sm border-t pt-2 font-bold text-lg">
                  <span>Grand Total</span>
                  <span className="text-amber-600">Unknown</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="grid grid-cols-2 gap-2">
              <button className="bg-amber-600 text-white py-2 rounded-lg text-sm font-semibold">
                📄 Generate Report
              </button>
              <button className="bg-orange-600 text-white py-2 rounded-lg text-sm font-semibold">
                ✉️ Send Estimate
              </button>
            </div>
          </div>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t flex justify-around py-2 px-4">
        <button onClick={() => router.push('/')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">🏠</span>
          <span className="text-xs">Home</span>
        </button>
        <button onClick={() => router.push('/deck')} className="flex flex-col items-center text-amber-600">
          <span className="text-xl">🪵</span>
          <span className="text-xs">Deck</span>
        </button>
        <button onClick={() => router.push('/repair')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">🔧</span>
          <span className="text-xs">Repair</span>
        </button>
        <button onClick={() => router.push('/exterior')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">🏠</span>
          <span className="text-xs">Exterior</span>
        </button>
        <button onClick={() => router.push('/settings')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">⚙️</span>
          <span className="text-xs">Settings</span>
        </button>
      </nav>
    </div>
  )
}
