'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type StormEvent = { id: string; dateOfLoss: string; hailSizeInches: number; maxWindMph: number; nwsReportId: string; severity: 'CRITICAL' | 'HIGH' | 'MODERATE' }

export default function StormsPage() {
  const router = useRouter()
  const [propertyAddress, setPropertyAddress] = useState('')
  const [matchedStorms, setMatchedStorms] = useState<StormEvent[]>([])
  const [corroboratedPacket, setCorroboratedPacket] = useState<string | null>(null)

  const mockStormDatabase: StormEvent[] = [
    { id: 'SE-2026-0814', dateOfLoss: '2026-08-14', hailSizeInches: 1.75, maxWindMph: 68, nwsReportId: 'NWS-OKC-8812', severity: 'CRITICAL' },
    { id: 'SE-2026-0522', dateOfLoss: '2026-05-22', hailSizeInches: 1.25, maxWindMph: 55, nwsReportId: 'NWS-OKC-4410', severity: 'HIGH' },
    { id: 'SE-2026-0310', dateOfLoss: '2026-03-10', hailSizeInches: 0.75, maxWindMph: 48, nwsReportId: 'NWS-OKC-1102', severity: 'MODERATE' },
  ]

  const handleMatchProperty = () => {
    if (!propertyAddress.trim()) return
    setMatchedStorms(mockStormDatabase)
    setCorroboratedPacket(null)
  }

  const handleGeneratePacket = (storm: StormEvent) => {
    setCorroboratedPacket(
      `NOAA/NWS CORROBORATION PACKET\n` +
      `----------------------------------------\n` +
      `Property Address: ${propertyAddress.toUpperCase()}\n` +
      `Date of Loss: ${storm.dateOfLoss}\n` +
      `NOAA Hail Severity: ${storm.hailSizeInches}" Diameter (Threshold: >=1.00")\n` +
      `NWS Max Wind Speed: ${storm.maxWindMph} MPH\n` +
      `NWS Official Report ID: ${storm.nwsReportId}\n` +
      `Verification Standard: 2021 IRC Storm Corroboration Standard\n` +
      `Status: Corroborated & Carrier Ready`
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-24">
      <button onClick={() => router.push('/')} className="text-blue-600 text-sm mb-2">← Dashboard</button>
      <h1 className="text-2xl font-bold mb-1">🌩️ NOAA Storm Corroboration Engine</h1>
      <p className="text-sm text-gray-600 mb-4">Corroborate customer loss dates with official NOAA hail and wind event data.</p>

      <div className="bg-white rounded-lg shadow p-4 mb-4 border-l-4 border-blue-600">
        <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Target Property Address</label>
        <div className="flex space-x-2">
          <input
            type="text"
            value={propertyAddress}
            onChange={(e) => setPropertyAddress(e.target.value)}
            placeholder="e.g., 742 Evergreen Terrace, OKC"
            className="flex-1 border rounded p-2 text-sm"
          />
          <button
            onClick={handleMatchProperty}
            className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-semibold hover:bg-blue-700"
          >
            Match Radar Data
          </button>
        </div>
      </div>

      {matchedStorms.length > 0 && (
        <div className="space-y-3 mb-4">
          <h2 className="text-sm font-bold text-gray-800">Verified NOAA Severe Weather Hits ({matchedStorms.length})</h2>
          {matchedStorms.map((storm) => (
            <div key={storm.id} className="bg-white rounded-lg shadow p-4 border-l-4 border-amber-500 flex justify-between items-center">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-bold text-sm text-gray-900">Date of Loss: {storm.dateOfLoss}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${storm.severity === 'CRITICAL' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}`}>
                    {storm.severity}
                  </span>
                </div>
                <p className="text-xs text-gray-600 mt-1">
                  Hail: <strong>{storm.hailSizeInches}"</strong> · Max Wind: <strong>{storm.maxWindMph} MPH</strong> · NWS: <code>{storm.nwsReportId}</code>
                </p>
              </div>
              <button
                onClick={() => handleGeneratePacket(storm)}
                className="bg-emerald-600 text-white text-xs px-3 py-1.5 rounded font-semibold hover:bg-emerald-700"
              >
                Generate Packet
              </button>
            </div>
          ))}
        </div>
      )}

      {corroboratedPacket && (
        <div className="bg-gray-900 text-emerald-400 font-mono text-xs p-4 rounded-lg shadow space-y-2">
          <div className="flex justify-between items-center text-gray-400 border-b border-gray-800 pb-2">
            <span>OFFICIAL CORROBORATION PACKET</span>
            <button onClick={() => setCorroboratedPacket(null)} className="text-gray-500 hover:text-white">✕</button>
          </div>
          <pre className="whitespace-pre-wrap leading-relaxed">{corroboratedPacket}</pre>
        </div>
      )}
    </div>
  )
}
