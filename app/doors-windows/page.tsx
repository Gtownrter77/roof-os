'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase/client'

export default function DoorsWindowsPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [loading, setLoading] = useState(false)
  const [estimate, setEstimate] = useState<any>(null)
  const [leads, setLeads] = useState<{id:string; name:string|null}[]>([])
  const [leadId, setLeadId] = useState('')
  const [status, setStatus] = useState('Loading saved leads.')
  const [items, setItems] = useState<any[]>([])

  const [form, setForm] = useState({
    windows: {
      count: 0,
      type: 'Double Hung',
      material: 'Vinyl',
      size: '36x54',
      hasGrids: false,
      hasLowE: true,
      hasArgon: true,
      isImpact: false,
    },
    doors: {
      count: 0,
      type: 'Entry Door',
      material: 'Steel',
      size: '36x80',
      hasSidelites: false,
      hasTransom: false,
      isFrench: false,
      isSliding: false,
      isPatio: false,
    },
    garage: {
      count: 0,
      type: 'Sectional',
      material: 'Steel',
      size: '16x7',
      hasWindows: false,
      hasInsulation: true,
      hasOpener: true,
    },
  })

  const windowTypes = ['Double Hung', 'Casement', 'Slider', 'Awning', 'Bay', 'Bow', 'Picture']
  const windowMaterials = ['Vinyl', 'Wood', 'Aluminum', 'Fiberglass', 'Composite', 'Steel']
  const doorTypes = ['Entry Door', 'French Door', 'Sliding Door', 'Patio Door', 'Storm Door', 'Screen Door']
  const doorMaterials = ['Steel', 'Wood', 'Fiberglass', 'Aluminum', 'Glass', 'Iron']
  const garageTypes = ['Sectional', 'Roll-up', 'Tilt-up', 'Side-hinged']
  const garageMaterials = ['Steel', 'Wood', 'Aluminum', 'Fiberglass']

  const windowSizes = ['24x36', '30x48', '32x50', '36x54', '42x60', '48x72']
  const doorSizes = ['30x80', '32x80', '34x80', '36x80', '42x84', '48x96']
  const garageSizes = ['14x7', '16x7', '18x8', '20x8', '24x8', '30x10']


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
    const body = `Door and window measurements saved. Measurements: ${JSON.stringify(form)}. Price Unknown. No dollar figure written.`
    const { error } = await supabase.from('lead_activity').insert({ lead_id: leadId, workspace_id: workspaceId, user_id: user.id, kind: 'note', body })
    setStatus(error ? error.message : 'Saved on the lead. Price remains Unknown.')
    setLoading(false)
  }

  const formatCurrency = (num: number) => {
    return 'Unknown'
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center">
          <button onClick={() => router.back()} className="text-white mr-3 text-xl">←</button>
          <h1 className="text-xl font-bold">🚪 Doors & Windows</h1>
          <span className="ml-2 bg-green-500 text-white text-xs px-2 py-0.5 rounded-full animate-pulse">AUTO</span>
        </div>
      </header>

      <main className="p-4"><p className="text-sm bg-white rounded-lg shadow p-4 mb-4">Price is Unknown. This screen does not write a dollar figure. A human approves every price.</p><label className="block text-sm bg-white rounded-lg shadow p-4 mb-4">Saved lead<select value={leadId} onChange={(event) => setLeadId(event.target.value)} className="mt-1 w-full rounded border p-2"><option value="">Choose a lead</option>{leads.map((lead) => <option key={lead.id} value={lead.id}>{lead.name || lead.id}</option>)}</select><p className="text-xs text-gray-500 mt-2">{status}</p></label>
        {/* Windows Section */}
        <div className="bg-white rounded-lg shadow-lg p-4 mb-4 border border-blue-200">
          <h3 className="font-semibold text-sm mb-3 flex items-center">
            <span className="text-xl mr-2">🪟</span> Windows
          </h3>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-xs text-gray-500">Count</label>
              <input
                type="number"
                value={form.windows.count || ''}
                onChange={(e) => setForm({...form, windows: {...form.windows, count: Number(e.target.value)}})}
                className="w-full p-2 border rounded-lg text-sm"
                placeholder="0"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500">Type</label>
              <select
                value={form.windows.type}
                onChange={(e) => setForm({...form, windows: {...form.windows, type: e.target.value}})}
                className="w-full p-2 border rounded-lg text-sm"
              >
                {windowTypes.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500">Material</label>
              <select
                value={form.windows.material}
                onChange={(e) => setForm({...form, windows: {...form.windows, material: e.target.value}})}
                className="w-full p-2 border rounded-lg text-sm"
              >
                {windowMaterials.map((m) => <option key={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500">Size</label>
              <select
                value={form.windows.size}
                onChange={(e) => setForm({...form, windows: {...form.windows, size: e.target.value}})}
                className="w-full p-2 border rounded-lg text-sm"
              >
                {windowSizes.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="col-span-2 grid grid-cols-2 gap-1">
              <label className="flex items-center text-xs">
                <input
                  type="checkbox"
                  checked={form.windows.hasGrids}
                  onChange={(e) => setForm({...form, windows: {...form.windows, hasGrids: e.target.checked}})}
                  className="mr-1"
                /> Grids
              </label>
              <label className="flex items-center text-xs">
                <input
                  type="checkbox"
                  checked={form.windows.hasLowE}
                  onChange={(e) => setForm({...form, windows: {...form.windows, hasLowE: e.target.checked}})}
                  className="mr-1"
                /> Low-E
              </label>
              <label className="flex items-center text-xs">
                <input
                  type="checkbox"
                  checked={form.windows.hasArgon}
                  onChange={(e) => setForm({...form, windows: {...form.windows, hasArgon: e.target.checked}})}
                  className="mr-1"
                /> Argon
              </label>
              <label className="flex items-center text-xs">
                <input
                  type="checkbox"
                  checked={form.windows.isImpact}
                  onChange={(e) => setForm({...form, windows: {...form.windows, isImpact: e.target.checked}})}
                  className="mr-1"
                /> Impact
              </label>
            </div>
          </div>
        </div>

        {/* Doors Section */}
        <div className="bg-white rounded-lg shadow-lg p-4 mb-4 border border-green-200">
          <h3 className="font-semibold text-sm mb-3 flex items-center">
            <span className="text-xl mr-2">🚪</span> Doors
          </h3>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-xs text-gray-500">Count</label>
              <input
                type="number"
                value={form.doors.count || ''}
                onChange={(e) => setForm({...form, doors: {...form.doors, count: Number(e.target.value)}})}
                className="w-full p-2 border rounded-lg text-sm"
                placeholder="0"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500">Type</label>
              <select
                value={form.doors.type}
                onChange={(e) => setForm({...form, doors: {...form.doors, type: e.target.value}})}
                className="w-full p-2 border rounded-lg text-sm"
              >
                {doorTypes.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500">Material</label>
              <select
                value={form.doors.material}
                onChange={(e) => setForm({...form, doors: {...form.doors, material: e.target.value}})}
                className="w-full p-2 border rounded-lg text-sm"
              >
                {doorMaterials.map((m) => <option key={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500">Size</label>
              <select
                value={form.doors.size}
                onChange={(e) => setForm({...form, doors: {...form.doors, size: e.target.value}})}
                className="w-full p-2 border rounded-lg text-sm"
              >
                {doorSizes.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="col-span-2 grid grid-cols-2 gap-1">
              <label className="flex items-center text-xs">
                <input
                  type="checkbox"
                  checked={form.doors.hasSidelites}
                  onChange={(e) => setForm({...form, doors: {...form.doors, hasSidelites: e.target.checked}})}
                  className="mr-1"
                /> Sidelites
              </label>
              <label className="flex items-center text-xs">
                <input
                  type="checkbox"
                  checked={form.doors.hasTransom}
                  onChange={(e) => setForm({...form, doors: {...form.doors, hasTransom: e.target.checked}})}
                  className="mr-1"
                /> Transom
              </label>
              <label className="flex items-center text-xs">
                <input
                  type="checkbox"
                  checked={form.doors.isFrench}
                  onChange={(e) => setForm({...form, doors: {...form.doors, isFrench: e.target.checked}})}
                  className="mr-1"
                /> French
              </label>
              <label className="flex items-center text-xs">
                <input
                  type="checkbox"
                  checked={form.doors.isSliding}
                  onChange={(e) => setForm({...form, doors: {...form.doors, isSliding: e.target.checked}})}
                  className="mr-1"
                /> Sliding
              </label>
              <label className="flex items-center text-xs col-span-2">
                <input
                  type="checkbox"
                  checked={form.doors.isPatio}
                  onChange={(e) => setForm({...form, doors: {...form.doors, isPatio: e.target.checked}})}
                  className="mr-1"
                /> Patio Door
              </label>
            </div>
          </div>
        </div>

        {/* Garage Doors Section */}
        <div className="bg-white rounded-lg shadow-lg p-4 mb-4 border border-yellow-200">
          <h3 className="font-semibold text-sm mb-3 flex items-center">
            <span className="text-xl mr-2">🏗️</span> Garage Doors
          </h3>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-xs text-gray-500">Count</label>
              <input
                type="number"
                value={form.garage.count || ''}
                onChange={(e) => setForm({...form, garage: {...form.garage, count: Number(e.target.value)}})}
                className="w-full p-2 border rounded-lg text-sm"
                placeholder="0"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500">Type</label>
              <select
                value={form.garage.type}
                onChange={(e) => setForm({...form, garage: {...form.garage, type: e.target.value}})}
                className="w-full p-2 border rounded-lg text-sm"
              >
                {garageTypes.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500">Material</label>
              <select
                value={form.garage.material}
                onChange={(e) => setForm({...form, garage: {...form.garage, material: e.target.value}})}
                className="w-full p-2 border rounded-lg text-sm"
              >
                {garageMaterials.map((m) => <option key={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500">Size</label>
              <select
                value={form.garage.size}
                onChange={(e) => setForm({...form, garage: {...form.garage, size: e.target.value}})}
                className="w-full p-2 border rounded-lg text-sm"
              >
                {garageSizes.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="col-span-2 grid grid-cols-2 gap-1">
              <label className="flex items-center text-xs">
                <input
                  type="checkbox"
                  checked={form.garage.hasWindows}
                  onChange={(e) => setForm({...form, garage: {...form.garage, hasWindows: e.target.checked}})}
                  className="mr-1"
                /> Windows
              </label>
              <label className="flex items-center text-xs">
                <input
                  type="checkbox"
                  checked={form.garage.hasInsulation}
                  onChange={(e) => setForm({...form, garage: {...form.garage, hasInsulation: e.target.checked}})}
                  className="mr-1"
                /> Insulated
              </label>
              <label className="flex items-center text-xs col-span-2">
                <input
                  type="checkbox"
                  checked={form.garage.hasOpener}
                  onChange={(e) => setForm({...form, garage: {...form.garage, hasOpener: e.target.checked}})}
                  className="mr-1"
                /> With Opener
              </label>
            </div>
          </div>
        </div>

        <button
          onClick={calculateEstimate}
          disabled={loading}
          className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 rounded-lg font-semibold disabled:opacity-50"
        >
          {loading ? '⏳ Calculating...' : '🚪 Auto Estimate Doors & Windows'}
        </button>

        {estimate && (
          <div className="mt-4 space-y-4 animate-fadeIn">
            {/* Summary */}
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg shadow-lg p-4 border border-blue-200">
              <div className="grid grid-cols-3 gap-2">
                <div className="text-center">
                  <p className="text-xs text-gray-500">Grand Total</p>
                  <p className="text-2xl font-bold text-blue-600">{formatCurrency(estimate.grandTotal)}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-500">Materials</p>
                  <p className="text-xl font-bold text-purple-600">{formatCurrency(estimate.totalMaterials)}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-500">Labor</p>
                  <p className="text-xl font-bold text-green-600">{formatCurrency(estimate.totalLabor)}</p>
                </div>
              </div>
            </div>

            {/* Windows Detail */}
            {estimate.windows.count > 0 && (
              <div className="bg-white rounded-lg shadow-lg p-4 border-l-4 border-blue-500">
                <h4 className="font-semibold text-sm flex items-center">
                  <span className="text-xl mr-2">🪟</span> Windows ({estimate.windows.count})
                </h4>
                <div className="grid grid-cols-2 gap-2 mt-2 text-sm">
                  <div><span className="text-gray-500">Type:</span> {estimate.windows.type}</div>
                  <div><span className="text-gray-500">Material:</span> {estimate.windows.material}</div>
                  <div><span className="text-gray-500">Size:</span> {estimate.windows.size}</div>
                  <div><span className="text-gray-500">Options:</span> {
                    Object.entries(estimate.windows.options)
                      .filter(([, v]) => v)
                      .map(([k]) => k)
                      .join(', ') || 'None'
                  }</div>
                  <div><span className="text-gray-500">Materials:</span> {formatCurrency(estimate.windows.cost)}</div>
                  <div><span className="text-gray-500">Labor:</span> {formatCurrency(estimate.windows.labor)}</div>
                </div>
              </div>
            )}

            {/* Doors Detail */}
            {estimate.doors.count > 0 && (
              <div className="bg-white rounded-lg shadow-lg p-4 border-l-4 border-green-500">
                <h4 className="font-semibold text-sm flex items-center">
                  <span className="text-xl mr-2">🚪</span> Doors ({estimate.doors.count})
                </h4>
                <div className="grid grid-cols-2 gap-2 mt-2 text-sm">
                  <div><span className="text-gray-500">Type:</span> {estimate.doors.type}</div>
                  <div><span className="text-gray-500">Material:</span> {estimate.doors.material}</div>
                  <div><span className="text-gray-500">Size:</span> {estimate.doors.size}</div>
                  <div><span className="text-gray-500">Options:</span> {
                    Object.entries(estimate.doors.options)
                      .filter(([, v]) => v)
                      .map(([k]) => k)
                      .join(', ') || 'None'
                  }</div>
                  <div><span className="text-gray-500">Materials:</span> {formatCurrency(estimate.doors.cost)}</div>
                  <div><span className="text-gray-500">Labor:</span> {formatCurrency(estimate.doors.labor)}</div>
                </div>
              </div>
            )}

            {/* Garage Detail */}
            {estimate.garage.count > 0 && (
              <div className="bg-white rounded-lg shadow-lg p-4 border-l-4 border-yellow-500">
                <h4 className="font-semibold text-sm flex items-center">
                  <span className="text-xl mr-2">🏗️</span> Garage Doors ({estimate.garage.count})
                </h4>
                <div className="grid grid-cols-2 gap-2 mt-2 text-sm">
                  <div><span className="text-gray-500">Type:</span> {estimate.garage.type}</div>
                  <div><span className="text-gray-500">Material:</span> {estimate.garage.material}</div>
                  <div><span className="text-gray-500">Size:</span> {estimate.garage.size}</div>
                  <div><span className="text-gray-500">Options:</span> {
                    Object.entries(estimate.garage.options)
                      .filter(([, v]) => v)
                      .map(([k]) => k)
                      .join(', ') || 'None'
                  }</div>
                  <div><span className="text-gray-500">Materials:</span> {formatCurrency(estimate.garage.cost)}</div>
                  <div><span className="text-gray-500">Labor:</span> {formatCurrency(estimate.garage.labor)}</div>
                </div>
              </div>
            )}

            {/* Totals */}
            <div className="bg-white rounded-lg shadow-lg p-4 border-2 border-blue-300">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm">Total Materials</span>
                  <span>{formatCurrency(estimate.totalMaterials)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Total Labor</span>
                  <span>{formatCurrency(estimate.totalLabor)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Overhead (15%)</span>
                  <span>{formatCurrency(estimate.overhead)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Profit (10%)</span>
                  <span>{formatCurrency(estimate.profit)}</span>
                </div>
                <div className="border-t pt-2 flex justify-between font-bold text-lg">
                  <span>Grand Total</span>
                  <span className="text-blue-600">{formatCurrency(estimate.grandTotal)}</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="grid grid-cols-2 gap-2">
              <button className="bg-blue-600 text-white py-2 rounded-lg text-sm font-semibold">
                📄 Generate Report
              </button>
              <button className="bg-green-600 text-white py-2 rounded-lg text-sm font-semibold">
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
        <button onClick={() => router.push('/doors-windows')} className="flex flex-col items-center text-blue-600">
          <span className="text-xl">🚪</span>
          <span className="text-xs">Doors</span>
        </button>
        <button onClick={() => router.push('/exterior')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">🏠</span>
          <span className="text-xs">Exterior</span>
        </button>
        <button onClick={() => router.push('/pricing')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">💰</span>
          <span className="text-xs">Pricing</span>
        </button>
        <button onClick={() => router.push('/settings')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">⚙️</span>
          <span className="text-xs">Settings</span>
        </button>
      </nav>
    </div>
  )
}
