'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function ReportsPage() {
  const router = useRouter()
  const [address, setAddress] = useState('')
  const [roofSquares, setRoofSquares] = useState('')
  const [gutterLf, setGutterLf] = useState('')
  const [photoCount, setPhotoCount] = useState('0')
  const [report, setReport] = useState<any>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function generateReport() {
    setLoading(true); setError(''); setReport(null)
    try {
      const response = await fetch('/api/reports/inspection', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ address, roofSquares: Number(roofSquares), gutterLf: Number(gutterLf), photoCount: Number(photoCount) }) })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error ?? 'Could not generate report.')
      setReport(payload.report)
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not generate report.') }
    finally { setLoading(false) }
  }

  return <div className="min-h-screen bg-gray-50 p-4 pb-20"><button onClick={() => router.push('/')} className="text-blue-600 text-sm mb-2">← Dashboard</button><h1 className="text-2xl font-bold mb-2">Inspection report</h1><p className="text-sm text-gray-600 mb-4">Generate a structured report from photos, location, quantities, GIS geometry, and storm evidence. Pricing stays review-gated.</p><div className="bg-white rounded-lg shadow p-4 mb-4 space-y-3"><label className="block text-sm font-medium">Property address<input value={address} onChange={e => setAddress(e.target.value)} className="mt-1 w-full border rounded p-2" placeholder="123 Main St, Atlanta, GA" /></label><div className="grid grid-cols-3 gap-2"><label className="text-sm">Roof SQ<input value={roofSquares} onChange={e => setRoofSquares(e.target.value)} className="mt-1 w-full border rounded p-2" inputMode="decimal" /></label><label className="text-sm">Gutter LF<input value={gutterLf} onChange={e => setGutterLf(e.target.value)} className="mt-1 w-full border rounded p-2" inputMode="decimal" /></label><label className="text-sm">Photos<input value={photoCount} onChange={e => setPhotoCount(e.target.value)} className="mt-1 w-full border rounded p-2" inputMode="numeric" /></label></div><button disabled={loading} onClick={generateReport} className="w-full rounded bg-blue-600 text-white py-3 font-semibold disabled:opacity-50">{loading ? 'Generating…' : 'Generate inspection report'}</button></div>{error && <div className="bg-red-50 border border-red-200 text-red-800 rounded p-3 mb-4 text-sm">{error}</div>}{report && <div className="space-y-4"><div className="bg-white rounded-lg shadow p-4"><div className="flex justify-between"><h2 className="font-bold">{report.title}</h2><span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">{report.status}</span></div><p className="text-sm mt-2">{report.address}</p><p className="text-sm text-gray-600">Generated {new Date(report.generatedAt).toLocaleString()}</p></div><div className="bg-white rounded-lg shadow p-4"><h2 className="font-semibold mb-2">Evidence summary</h2><ul className="text-sm space-y-1"><li>Photos: {report.evidence.photoCount}</li><li>GIS footprint: {report.evidence.footprintSqFt ? `${report.evidence.footprintSqFt.toLocaleString()} sq ft (low confidence)` : 'Not found'}</li><li>NOAA/NWS candidate events: {report.evidence.stormCandidateCount}</li><li>Measurement source: {report.evidence.measurementSource}</li></ul></div><div className="bg-white rounded-lg shadow p-4"><h2 className="font-semibold mb-2">Draft replacement quantities</h2><div className="text-sm space-y-1"><p>Roof replacement: {report.quantities.roofSquares} SQ — <strong>unpriced</strong></p><p>Gutter replacement: {report.quantities.gutterLf} LF — <strong>unpriced</strong></p></div></div><div className="bg-white rounded-lg shadow p-4"><h2 className="font-semibold mb-2">Approved local tax</h2>{report.pricing?.status === 'active' ? <div className="text-sm space-y-1"><p><strong>{report.pricing.localTaxRate}%</strong> combined local tax</p><p className="text-gray-600">Source: {report.pricing.taxSource}</p><p className="text-xs text-gray-500">Active price book effective {new Date(report.pricing.effectiveAt).toLocaleString()}</p></div> : <p className="text-sm text-amber-800">No active owner-managed price book is available. Draft tax rates are intentionally excluded.</p>}</div><div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-900"><strong>Review required:</strong> This report is not a certified measurement, verified date-of-loss determination, tax advice, or carrier-ready estimate. Confirm the tax jurisdiction, attach an approved price book, and complete human measurement/storm review before external use.</div></div>}<nav className="fixed bottom-0 left-0 right-0 bg-white border-t flex justify-around py-2 px-4"><button onClick={() => router.push('/')} className="text-gray-500 text-sm">Home</button><button onClick={() => router.push('/leads')} className="text-gray-500 text-sm">Leads</button><button onClick={() => router.push('/reports')} className="text-blue-600 text-sm">Reports</button><button onClick={() => router.push('/settings')} className="text-gray-500 text-sm">Settings</button></nav></div>
}
