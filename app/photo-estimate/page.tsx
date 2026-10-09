'use client'

import React, { useState } from 'react'
import { CandidateAddress, PipelineReport } from '../../lib/ai/photo-pipeline-engine'

export default function AutomatedPhotoPipelinePage() {
  const [step, setStep] = useState<'upload' | 'confirm_address' | 'review_report' | 'sent'>('upload')
  const [loading, setLoading] = useState(false)
  const [candidates, setCandidates] = useState<CandidateAddress[]>([])
  const [selectedAddress, setSelectedAddress] = useState<CandidateAddress | null>(null)
  const [includeDetached, setIncludeDetached] = useState(true)
  const [profitMargin, setProfitMargin] = useState(35) // 35% company hold margin
  const [report, setReport] = useState<PipelineReport | null>(null)
  const [dispatchInfo, setDispatchInfo] = useState<{ email: string; phone: string; timeSec: number; auditHash: string } | null>(null)
  const [showItemizedDrawer, setShowItemizedDrawer] = useState(false)

  // Step 1: Upload Photo -> Filter Addresses
  const handlePhotoUpload = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/photo-estimate/pipeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'disambiguate', photoUri: 'house-photo.jpg' })
      })
      const data = await res.json()
      if (data.success) {
        setCandidates(data.candidates)
        setSelectedAddress(data.candidates[0])
        setStep('confirm_address')
      }
    } catch (err) {
      alert('Error analyzing photo geolocation')
    } finally {
      setLoading(false)
    }
  }

  // Step 2: Confirm Address & Options -> Run Tri-Fork Pipeline
  const handleConfirmAddressAndRun = async () => {
    if (!selectedAddress) return
    setLoading(true)
    try {
      const res = await fetch('/api/photo-estimate/pipeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'execute_trifork',
          confirmedAddress: selectedAddress,
          includeDetachedBuildings: includeDetached,
          profitMarginPercent: profitMargin,
          includeDumpster: true,
          dumpsterFee: 550,
          laborRatePerSquare: 85
        })
      })
      const data = await res.json()
      if (data.success) {
        setReport(data.report)
        setStep('review_report')
      }
    } catch (err) {
      alert('Error running tri-fork estimate pipeline')
    } finally {
      setLoading(false)
    }
  }

  // Step 3: Tech Authorizes & Dispatches Report to Customer
  const handleAuthorizeAndSend = async () => {
    if (!report) return
    setLoading(true)
    try {
      const customerEmail = 'homeowner@evergreen.com'
      const customerPhone = '+1 (555) 382-9102'

      const res = await fetch('/api/photo-estimate/pipeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'authorize_and_send',
          report,
          techUserId: 'tech-john-doe',
          customerEmail,
          customerPhone
        })
      })
      const data = await res.json()
      if (data.success) {
        setDispatchInfo({
          email: customerEmail,
          phone: customerPhone,
          timeSec: data.dispatchResult.executionTimeSeconds,
          auditHash: data.dispatchResult.auditSignatureHash
        })
        setStep('sent')
      }
    } catch (err) {
      alert('Error dispatching final report')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 font-sans">
      <div className="max-w-4xl mx-auto space-y-8">

        {/* Header Banner */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-2xl flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="bg-blue-600 text-white text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">
                10-Minute Pipeline (Hardened)
              </span>
              <span className="text-slate-400 text-sm">Automated Photo-to-Customer Report Engine</span>
            </div>
            <h1 className="text-2xl font-bold mt-2 text-white">Roof-OS Automated Inspection & Estimate Pipeline</h1>
          </div>
          <div className="text-right">
            <div className="text-xs text-slate-400">Target SLA</div>
            <div className="text-lg font-mono font-semibold text-emerald-400">&lt; 10:00 Mins</div>
          </div>
        </div>

        {/* STEP 1: UPLOAD PHOTO */}
        {step === 'upload' && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center space-y-6">
            <div className="w-16 h-16 bg-blue-600/20 text-blue-400 rounded-full flex items-center justify-center mx-auto text-2xl">
              📸
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">Capture or Upload House Inspection Photo</h2>
              <p className="text-slate-400 text-sm mt-1">
                Open-source EXIF/OCR stack will filter geolocations down to 3-6 candidate addresses for field human verification.
              </p>
            </div>

            <button
              onClick={handlePhotoUpload}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-500 text-white font-medium px-8 py-3.5 rounded-lg transition-all shadow-lg hover:shadow-blue-500/20 disabled:opacity-50"
            >
              {loading ? 'Processing EXIF & Address Disambiguation...' : 'Take Photo & Filter Addresses'}
            </button>
          </div>
        )}

        {/* STEP 2: CONFIRM ADDRESS & PROFIT MARGIN */}
        {step === 'confirm_address' && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-white">Field Human Address Confirmation</h2>
              <p className="text-slate-400 text-sm">Select the matched target address below (3-6 candidates found):</p>
            </div>

            <div className="space-y-3">
              {candidates.map((item) => (
                <div
                  key={item.id}
                  onClick={() => setSelectedAddress(item)}
                  className={`p-4 rounded-lg border cursor-pointer flex items-center justify-between transition-all ${
                    selectedAddress?.id === item.id
                      ? 'border-blue-500 bg-blue-950/40 text-white'
                      : 'border-slate-800 bg-slate-900/50 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div>
                    <div className="font-medium text-base">{item.address}</div>
                    <div className="text-xs text-slate-400">{item.city}, {item.state} {item.zip}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    {item.hasDetachedBuildings && (
                      <span className="bg-amber-950/80 text-amber-300 text-xs px-2 py-0.5 rounded border border-amber-800">
                        Detached Structure
                      </span>
                    )}
                    <span className="text-xs font-mono bg-slate-800 px-2 py-1 rounded">
                      Match: {Math.round(item.confidenceScore * 100)}% ({item.sourceMethod})
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* OPTIONS & SLIDERS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-950/60 p-4 rounded-lg border border-slate-800">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300 flex items-center justify-between">
                  <span>Detached Buildings Aerial Segment</span>
                  <input
                    type="checkbox"
                    checked={includeDetached}
                    onChange={(e) => setIncludeDetached(e.target.checked)}
                    className="w-4 h-4 accent-blue-600 rounded"
                  />
                </label>
                <p className="text-xs text-slate-500">Includes detached garages or sheds in SAM aerial vectorizer.</p>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm font-medium">
                  <span className="text-slate-300">Company Hold Profit Margin</span>
                  <span className="text-emerald-400 font-mono font-bold">{profitMargin}%</span>
                </div>
                <input
                  type="range"
                  min="15"
                  max="55"
                  step="1"
                  value={profitMargin}
                  onChange={(e) => setProfitMargin(Number(e.target.value))}
                  className="w-full accent-emerald-500 cursor-pointer"
                />
              </div>
            </div>

            <button
              onClick={handleConfirmAddressAndRun}
              disabled={loading || !selectedAddress}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-3.5 rounded-lg transition-all shadow-lg hover:shadow-emerald-500/20 disabled:opacity-50"
            >
              {loading ? 'Executing Tri-Fork Parallel Pipeline (SAM, NOAA, Codes)...' : 'Confirm Address & Dispatch Tri-Fork Pipeline'}
            </button>
          </div>
        )}

        {/* STEP 3: REVIEW REPORT (TRI-FORK COMPLETE) */}
        {step === 'review_report' && report && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <span className="bg-emerald-950 text-emerald-400 text-xs px-2.5 py-1 rounded-full border border-emerald-800 font-medium">
                  Tri-Fork Processing Complete
                </span>
                <h2 className="text-xl font-bold text-white mt-2">{report.confirmedAddress}</h2>
              </div>
              <div className="text-right">
                <div className="text-xs text-slate-400">Total Generated Estimate</div>
                <div className="text-2xl font-bold text-emerald-400 font-mono">
                  ${report.estimate.totalEstimateAmount.toLocaleString()}
                </div>
              </div>
            </div>

            {/* TRI-FORK RESULTS GRID */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

              {/* Fork 1: Estimate & SAM Measurements */}
              <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 space-y-3">
                <div className="text-xs font-bold text-blue-400 uppercase tracking-wider">1. Aerial SAM & Live Estimate</div>
                <div className="text-sm space-y-1 text-slate-300">
                  <div className="flex justify-between"><span>Squares:</span> <span className="font-mono text-white">{report.measurements.totalSquares} SQ</span></div>
                  <div className="flex justify-between"><span>Model:</span> <span className="font-mono text-xs bg-slate-800 px-1.5 py-0.5 rounded">{report.measurements.segmentationModelUsed}</span></div>
                  <div className="flex justify-between"><span>Materials (HD Live):</span> <span className="font-mono">${report.estimate.materialsSubtotal.toLocaleString()}</span></div>
                  <div className="flex justify-between"><span>Dumpster & Labor:</span> <span className="font-mono">${(report.estimate.dumpsterFee + report.estimate.laborSubtotal).toLocaleString()}</span></div>
                  <div className="flex justify-between text-emerald-400 font-semibold border-t border-slate-800 pt-1"><span>Profit ({report.estimate.profitMarginPercent}%):</span> <span className="font-mono">${report.estimate.grossProfitAmount.toLocaleString()}</span></div>
                </div>
                <button
                  onClick={() => setShowItemizedDrawer(!showItemizedDrawer)}
                  className="text-xs text-blue-400 hover:underline mt-1 block"
                >
                  {showItemizedDrawer ? 'Hide Itemized Materials' : 'View Itemized Home Depot Materials'}
                </button>
              </div>

              {/* Fork 2: 10-Yr NOAA Storm History */}
              <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 space-y-3">
                <div className="text-xs font-bold text-amber-400 uppercase tracking-wider">2. NOAA 10-Yr Storm Dates</div>
                <div className="space-y-1.5">
                  {report.stormHistory10Yr.slice(0, 3).map((st, i) => (
                    <div key={i} className="text-xs bg-slate-900 p-2 rounded border border-slate-800 flex justify-between">
                      <span className="font-medium text-slate-200">{st.date}</span>
                      <span className="text-amber-400 font-mono">{st.magnitude}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Fork 3: Building Codes */}
              <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 space-y-3">
                <div className="text-xs font-bold text-purple-400 uppercase tracking-wider">3. Statutory Building Codes</div>
                <div className="space-y-1.5">
                  {report.buildingCodes.map((code, i) => (
                    <div key={i} className="text-xs bg-slate-900 p-2 rounded border border-slate-800">
                      <div className="font-bold text-purple-300">{code.codeCitation}</div>
                      <div className="text-slate-400 text-[11px] truncate">{code.title}</div>
                    </div>
                  ))}
                </div>
              </div>

            </div>

            {/* ITEMIZED DRAWER */}
            {showItemizedDrawer && report.estimate.itemizedLineItems && (
              <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 space-y-2 text-xs">
                <div className="font-bold text-slate-200 text-sm mb-2">Itemized Home Depot Live Materials</div>
                {report.estimate.itemizedLineItems.map((item, idx) => (
                  <div key={idx} className="flex justify-between p-2 bg-slate-900 rounded border border-slate-800">
                    <div>
                      <span className="font-mono text-blue-400">{item.itemCode}</span> - {item.description}
                    </div>
                    <div className="font-mono text-slate-200">
                      {item.quantity} {item.unit} @ ${item.unitPrice} = ${item.lineTotal.toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* TECH AUTHORIZATION ACTION */}
            <div className="bg-blue-950/40 border border-blue-800/60 p-4 rounded-lg flex items-center justify-between">
              <div>
                <div className="font-semibold text-white">Technician Authorization Required</div>
                <div className="text-xs text-slate-300">Clicking confirm will immediately send the finalized report to customer via Email & SMS.</div>
              </div>
              <button
                onClick={handleAuthorizeAndSend}
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-500 text-white font-medium px-6 py-2.5 rounded-lg transition-all shadow-md hover:shadow-blue-500/20"
              >
                {loading ? 'Authorizing & Delivering...' : 'Confirm & Send to Customer'}
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: DISPATCH SUCCESS */}
        {step === 'sent' && dispatchInfo && (
          <div className="bg-slate-900 border border-emerald-800/80 rounded-xl p-8 text-center space-y-6">
            <div className="w-16 h-16 bg-emerald-600/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto text-3xl">
              ✓
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Report Successfully Delivered to Customer!</h2>
              <p className="text-slate-300 text-sm mt-2">
                Sent to Email <strong className="text-white">{dispatchInfo.email}</strong> and SMS <strong className="text-white">{dispatchInfo.phone}</strong>.
              </p>
            </div>

            <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 text-left text-xs space-y-2 font-mono">
              <div className="text-slate-400">Total Execution SLA Benchmark:</div>
              <div className="text-emerald-400 text-base font-bold">{dispatchInfo.timeSec} Seconds (Target: &lt; 600s / 10 Mins)</div>
              <div className="text-slate-500 truncate">SHA-256 Audit Signature: {dispatchInfo.auditHash}</div>
            </div>

            <div>
              <button
                onClick={() => {
                  setStep('upload')
                  setReport(null)
                  setDispatchInfo(null)
                  setShowItemizedDrawer(false)
                }}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium px-6 py-2.5 rounded-lg transition-all"
              >
                Start New Photo Pipeline
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
