'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function RepairPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [estimate, setEstimate] = useState<any>(null)

  const [form, setForm] = useState({
    stormDamage: false,
    hailDamage: false,
    windDamage: false,
    waterDamage: false,
    fireDamage: false,
    termiteDamage: false,
    rotDamage: false,
    structuralDamage: false,
    foundationDamage: false,
    electricalDamage: false,
    plumbingDamage: false,
    moldDamage: false,
    pestDamage: false,
    roofRepair: false,
    sidingRepair: false,
    windowRepair: false,
    doorRepair: false,
    gutterRepair: false,
    deckRepair: false,
    floorRepair: false,
    drywallRepair: false,
    paintRepair: false,
    trimRepair: false,
    chimneyRepair: false,
    drivewayRepair: false,
    landscapingRepair: false,
    structuralRepair: false,
    electricalRepair: false,
    plumbingRepair: false,
    hvacRepair: false,
    insulationRepair: false,
    foundationRepair: false,
    emergencyService: false,
    permitRequired: false,
    inspectionRequired: false,
    asap: false,
  })

  const damageMultipliers: Record<string, number> = {
    stormDamage: 1.3,
    hailDamage: 1.2,
    windDamage: 1.25,
    waterDamage: 1.4,
    fireDamage: 2.0,
    termiteDamage: 1.8,
    rotDamage: 1.5,
    structuralDamage: 2.5,
    foundationDamage: 3.0,
    electricalDamage: 1.5,
    plumbingDamage: 1.5,
    moldDamage: 1.7,
    pestDamage: 1.4,
  }

  const calculateEstimate = () => {
    setLoading(false)
    return
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-gradient-to-r from-red-600 to-orange-600 text-white shadow-lg sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center">
          <button onClick={() => router.back()} className="text-white mr-3 text-xl">←</button>
          <h1 className="text-xl font-bold">🔧 Repair Estimate Engine</h1>
          <span className="ml-2 bg-yellow-500 text-white text-xs px-2 py-0.5 rounded-full animate-pulse">PRO</span>
        </div>
      </header>

      <main className="p-4"><p className="text-sm bg-white rounded-lg shadow p-4 mb-4">Price is Unknown. This screen does not write a dollar figure.</p>
        {/* Damage Types */}
        <div className="bg-white rounded-lg shadow-lg p-4 mb-4 border border-red-200">
          <h3 className="font-semibold text-sm mb-2 flex items-center">
            <span className="text-xl mr-2">💥</span> Damage Types
          </h3>
          <div className="grid grid-cols-3 gap-1">
            <label className="flex items-center text-xs"><input type="checkbox" checked={form.stormDamage} onChange={(e) => setForm({...form, stormDamage: e.target.checked})} className="mr-1" /> Storm</label>
            <label className="flex items-center text-xs"><input type="checkbox" checked={form.hailDamage} onChange={(e) => setForm({...form, hailDamage: e.target.checked})} className="mr-1" /> Hail</label>
            <label className="flex items-center text-xs"><input type="checkbox" checked={form.windDamage} onChange={(e) => setForm({...form, windDamage: e.target.checked})} className="mr-1" /> Wind</label>
            <label className="flex items-center text-xs"><input type="checkbox" checked={form.waterDamage} onChange={(e) => setForm({...form, waterDamage: e.target.checked})} className="mr-1" /> Water</label>
            <label className="flex items-center text-xs"><input type="checkbox" checked={form.fireDamage} onChange={(e) => setForm({...form, fireDamage: e.target.checked})} className="mr-1" /> Fire</label>
            <label className="flex items-center text-xs"><input type="checkbox" checked={form.termiteDamage} onChange={(e) => setForm({...form, termiteDamage: e.target.checked})} className="mr-1" /> Termite</label>
            <label className="flex items-center text-xs"><input type="checkbox" checked={form.rotDamage} onChange={(e) => setForm({...form, rotDamage: e.target.checked})} className="mr-1" /> Rot</label>
            <label className="flex items-center text-xs"><input type="checkbox" checked={form.structuralDamage} onChange={(e) => setForm({...form, structuralDamage: e.target.checked})} className="mr-1" /> Structural</label>
            <label className="flex items-center text-xs"><input type="checkbox" checked={form.foundationDamage} onChange={(e) => setForm({...form, foundationDamage: e.target.checked})} className="mr-1" /> Foundation</label>
          </div>
        </div>

        {/* Repair Types */}
        <div className="bg-white rounded-lg shadow-lg p-4 mb-4 border border-orange-200">
          <h3 className="font-semibold text-sm mb-2 flex items-center">
            <span className="text-xl mr-2">🔧</span> Repair Types
          </h3>
          <div className="grid grid-cols-3 gap-1">
            <label className="flex items-center text-xs"><input type="checkbox" checked={form.roofRepair} onChange={(e) => setForm({...form, roofRepair: e.target.checked})} className="mr-1" /> Roof</label>
            <label className="flex items-center text-xs"><input type="checkbox" checked={form.sidingRepair} onChange={(e) => setForm({...form, sidingRepair: e.target.checked})} className="mr-1" /> Siding</label>
            <label className="flex items-center text-xs"><input type="checkbox" checked={form.windowRepair} onChange={(e) => setForm({...form, windowRepair: e.target.checked})} className="mr-1" /> Windows</label>
            <label className="flex items-center text-xs"><input type="checkbox" checked={form.doorRepair} onChange={(e) => setForm({...form, doorRepair: e.target.checked})} className="mr-1" /> Doors</label>
            <label className="flex items-center text-xs"><input type="checkbox" checked={form.gutterRepair} onChange={(e) => setForm({...form, gutterRepair: e.target.checked})} className="mr-1" /> Gutters</label>
            <label className="flex items-center text-xs"><input type="checkbox" checked={form.deckRepair} onChange={(e) => setForm({...form, deckRepair: e.target.checked})} className="mr-1" /> Deck</label>
            <label className="flex items-center text-xs"><input type="checkbox" checked={form.floorRepair} onChange={(e) => setForm({...form, floorRepair: e.target.checked})} className="mr-1" /> Floor</label>
            <label className="flex items-center text-xs"><input type="checkbox" checked={form.drywallRepair} onChange={(e) => setForm({...form, drywallRepair: e.target.checked})} className="mr-1" /> Drywall</label>
            <label className="flex items-center text-xs"><input type="checkbox" checked={form.paintRepair} onChange={(e) => setForm({...form, paintRepair: e.target.checked})} className="mr-1" /> Paint</label>
            <label className="flex items-center text-xs"><input type="checkbox" checked={form.trimRepair} onChange={(e) => setForm({...form, trimRepair: e.target.checked})} className="mr-1" /> Trim</label>
            <label className="flex items-center text-xs"><input type="checkbox" checked={form.chimneyRepair} onChange={(e) => setForm({...form, chimneyRepair: e.target.checked})} className="mr-1" /> Chimney</label>
            <label className="flex items-center text-xs"><input type="checkbox" checked={form.structuralRepair} onChange={(e) => setForm({...form, structuralRepair: e.target.checked})} className="mr-1" /> Structural</label>
          </div>
        </div>

        {/* Services */}
        <div className="bg-white rounded-lg shadow-lg p-4 mb-4 border border-yellow-200">
          <h3 className="font-semibold text-sm mb-2 flex items-center">
            <span className="text-xl mr-2">⚡</span> Services
          </h3>
          <div className="grid grid-cols-2 gap-2">
            <label className="flex items-center text-sm"><input type="checkbox" checked={form.emergencyService} onChange={(e) => setForm({...form, emergencyService: e.target.checked})} className="mr-2" /> 🚨 Emergency Service</label>
            <label className="flex items-center text-sm"><input type="checkbox" checked={form.asap} onChange={(e) => setForm({...form, asap: e.target.checked})} className="mr-2" /> ⚡ ASAP Priority</label>
            <label className="flex items-center text-sm"><input type="checkbox" checked={form.permitRequired} onChange={(e) => setForm({...form, permitRequired: e.target.checked})} className="mr-2" /> 📋 Permit Required</label>
            <label className="flex items-center text-sm"><input type="checkbox" checked={form.inspectionRequired} onChange={(e) => setForm({...form, inspectionRequired: e.target.checked})} className="mr-2" /> 🔍 Inspection Required</label>
          </div>
        </div>

        <button
          onClick={calculateEstimate}
          disabled={loading}
          className="w-full bg-gradient-to-r from-red-600 to-orange-600 text-white py-3 rounded-lg font-semibold disabled:opacity-50"
        >
          {loading ? '⏳ Calculating...' : '🔧 Generate Repair Estimate'}
        </button>

        {estimate && (
          <div className="mt-4 space-y-4 animate-fadeIn">
            <div className="bg-white rounded-lg shadow-lg p-4 border-2 border-red-500">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-xs text-gray-500">Damage Severity</p>
                  <p className="text-xl font-bold text-red-600">{estimate.summary.severity.toUpperCase()}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500">Total Estimate</p>
                  <p className="text-2xl font-bold text-red-600">Unknown</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-lg p-4 border border-gray-200">
              <h3 className="font-semibold text-sm mb-2">📊 Estimate Details</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-gray-500">Base Estimate:</span> Unknown</div>
                <div><span className="text-gray-500">Damage Multiplier:</span> {estimate.summary.damageMultiplier.toFixed(2)}x</div>
                <div><span className="text-gray-500">Materials:</span> Unknown</div>
                <div><span className="text-gray-500">Labor:</span> Unknown</div>
                <div><span className="text-gray-500">Labor Rate:</span> Unknown</div>
                <div><span className="text-gray-500">Labor Hours:</span> {estimate.summary.laborHours.toFixed(0)} hrs</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button className="bg-red-600 text-white py-2 rounded-lg text-sm font-semibold">
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
        <button onClick={() => router.push('/repair')} className="flex flex-col items-center text-red-600">
          <span className="text-xl">🔧</span>
          <span className="text-xs">Repair</span>
        </button>
        <button onClick={() => router.push('/deck')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">🪵</span>
          <span className="text-xs">Deck</span>
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
