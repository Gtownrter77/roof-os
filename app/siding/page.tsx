'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  calculateSidingMeasurement,
  type SidingMeasurementResult,
  type SidingWall,
} from '../../lib/siding-measurements'

type WallState = SidingWall & {
  verified: boolean
  aiRows: string
  aiExposureIn: string
}

const initialWalls: WallState[] = [
  { name: 'Front', widthFt: 0, stories: 1, rows: 0, exposureIn: 0, verified: false, aiRows: '', aiExposureIn: '' },
  { name: 'Back', widthFt: 0, stories: 1, rows: 0, exposureIn: 0, verified: false, aiRows: '', aiExposureIn: '' },
  { name: 'Left side', widthFt: 0, stories: 1, rows: 0, exposureIn: 0, verified: false, aiRows: '', aiExposureIn: '' },
  { name: 'Right side', widthFt: 0, stories: 1, rows: 0, exposureIn: 0, verified: false, aiRows: '', aiExposureIn: '' },
]

function numberValue(value: string): number {
  return value === '' ? 0 : Number(value)
}

export default function SidingPage() {
  const router = useRouter()
  const [walls, setWalls] = useState<WallState[]>(initialWalls)
  const [wasteFactor, setWasteFactor] = useState('10')
  const [result, setResult] = useState<SidingMeasurementResult | null>(null)
  const [error, setError] = useState('')

  const verifiedCount = useMemo(() => walls.filter((wall) => wall.verified).length, [walls])

  function updateWall(index: number, patch: Partial<WallState>) {
    setWalls((current) => current.map((wall, i) => i === index ? { ...wall, ...patch } : wall))
    setResult(null)
    setError('')
  }

  function calculate() {
    setError('')
    setResult(null)

    const verifiedWalls = walls.filter((wall) => wall.verified)
    if (!verifiedWalls.length) {
      setError('Verify at least one wall section before calculating.')
      return
    }

    try {
      const measurement = calculateSidingMeasurement(
        verifiedWalls.map(({ name, widthFt, stories, rows, exposureIn }) => ({
          name,
          widthFt,
          stories,
          rows,
          exposureIn,
        })),
        numberValue(wasteFactor),
      )
      setResult(measurement)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Siding calculation failed.')
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 pb-24">
      <header className="sticky top-0 z-10 border-b bg-white shadow-sm">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <button onClick={() => router.back()} className="text-slate-600">←</button>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">ROOF/OS Exterior Measurement</p>
            <h1 className="text-xl font-bold text-slate-900">Siding Measurement</h1>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl space-y-4 p-4">
        <section className="rounded-xl border border-blue-200 bg-blue-50 p-4">
          <h2 className="font-semibold text-slate-900">Field rule</h2>
          <p className="mt-1 text-sm text-slate-700">
            AI may observe the photo. The technician verifies the exposure, course count, width, and stories.
            Only verified measurements become calculation inputs.
          </p>
          <div className="mt-3 rounded-lg bg-white p-3 text-sm">
            <strong>Height = rows × exposure ÷ 12</strong>
            <span className="mx-2">→</span>
            <strong>Gross SF = width × height × stories</strong>
            <span className="mx-2">→</span>
            <strong>Material SF = gross SF × (1 + waste)</strong>
          </div>
        </section>

        <section className="rounded-xl border bg-white p-4 shadow-sm">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-semibold">Wall sections</h2>
              <p className="text-xs text-slate-500">
                {verifiedCount} of {walls.length} sections technician verified
              </p>
            </div>
            <label className="text-sm">
              Waste factor %
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={wasteFactor}
                onChange={(event) => setWasteFactor(event.target.value)}
                className="ml-2 w-24 rounded border p-2"
              />
            </label>
          </div>

          <div className="space-y-4">
            {walls.map((wall, index) => (
              <article key={wall.name} className="rounded-lg border p-3">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="font-semibold">{wall.name}</h3>
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <input
                      type="checkbox"
                      checked={wall.verified}
                      onChange={(event) => updateWall(index, { verified: event.target.checked })}
                    />
                    Technician verified
                  </label>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  <label className="text-xs text-slate-600">
                    AI observed rows
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={wall.aiRows}
                      onChange={(event) => updateWall(index, { aiRows: event.target.value })}
                      className="mt-1 w-full rounded border p-2"
                      placeholder="Observation only"
                    />
                  </label>
                  <label className="text-xs text-slate-600">
                    AI observed exposure (in)
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={wall.aiExposureIn}
                      onChange={(event) => updateWall(index, { aiExposureIn: event.target.value })}
                      className="mt-1 w-full rounded border p-2"
                      placeholder="Observation only"
                    />
                  </label>
                  <label className="text-xs font-medium text-slate-700">
                    Verified rows
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={wall.rows || ''}
                      onChange={(event) => updateWall(index, { rows: numberValue(event.target.value) })}
                      className="mt-1 w-full rounded border p-2"
                    />
                  </label>
                  <label className="text-xs font-medium text-slate-700">
                    Verified exposure (in)
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={wall.exposureIn || ''}
                      onChange={(event) => updateWall(index, { exposureIn: numberValue(event.target.value) })}
                      className="mt-1 w-full rounded border p-2"
                    />
                  </label>
                  <label className="text-xs font-medium text-slate-700">
                    Verified width (ft)
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={wall.widthFt || ''}
                      onChange={(event) => updateWall(index, { widthFt: numberValue(event.target.value) })}
                      className="mt-1 w-full rounded border p-2"
                    />
                  </label>
                </div>

                <div className="mt-3">
                  <label className="text-xs font-medium text-slate-700">
                    Stories
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={wall.stories}
                      onChange={(event) => updateWall(index, { stories: numberValue(event.target.value) })}
                      className="mt-1 w-28 rounded border p-2"
                    />
                  </label>
                </div>

                {wall.verified && wall.rows > 0 && wall.exposureIn > 0 && (
                  <p className="mt-3 rounded bg-emerald-50 p-2 text-xs text-emerald-800">
                    Verified siding height: {((wall.rows * wall.exposureIn) / 12).toFixed(2)} ft before stories.
                  </p>
                )}
              </article>
            ))}
          </div>

          {error && <p className="mt-4 rounded bg-red-50 p-3 text-sm text-red-800" role="alert">{error}</p>}

          <button
            onClick={calculate}
            className="mt-4 w-full rounded-lg bg-blue-700 px-4 py-3 font-semibold text-white hover:bg-blue-800"
          >
            Calculate Verified Siding Quantity
          </button>
        </section>

        {result && (
          <section className="rounded-xl border border-emerald-200 bg-white p-4 shadow-sm">
            <div className="mb-4">
              <h2 className="font-semibold">Verified quantity</h2>
              <p className="text-xs text-slate-500">
                Openings are not subtracted. The configured waste factor is applied to gross measured siding.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs text-slate-500">Gross siding</p>
                <p className="text-2xl font-bold">{result.grossSqFt.toFixed(1)} SF</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs text-slate-500">Waste factor</p>
                <p className="text-2xl font-bold">{(result.wasteFactor * 100).toFixed(1)}%</p>
              </div>
              <div className="rounded-lg bg-emerald-50 p-3">
                <p className="text-xs text-emerald-700">Material quantity</p>
                <p className="text-2xl font-bold text-emerald-800">{result.materialSqFt.toFixed(1)} SF</p>
              </div>
            </div>

            <div className="mt-4 divide-y rounded-lg border">
              {result.sections.map((section) => (
                <div key={section.name} className="grid gap-2 p-3 text-sm sm:grid-cols-4">
                  <strong>{section.name}</strong>
                  <span>{section.rows} rows × {section.exposureIn}"</span>
                  <span>{section.sidingHeightFt.toFixed(2)} ft height</span>
                  <span className="font-semibold">{section.grossSqFt.toFixed(1)} SF</span>
                </div>
              ))}
            </div>

            <p className="mt-4 rounded bg-amber-50 p-3 text-xs text-amber-900">
              Pricing is Unknown until a configured ROOF/OS price book supplies the applicable material and labor rates.
              This calculation does not claim a price or code-compliance result.
            </p>
          </section>
        )}

        <section className="rounded-xl border bg-white p-4 shadow-sm">
          <h2 className="font-semibold">Photo measurement</h2>
          <p className="mt-1 text-sm text-slate-600">
            Use the existing ROOF/OS photo and aerial workflows for actual imagery. Their AI suggestions remain non-authoritative until a technician verifies them.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button onClick={() => router.push('/photo-estimate')} className="rounded border px-3 py-2 text-sm">
              Open photo estimate
            </button>
            <button onClick={() => router.push('/measure')} className="rounded border px-3 py-2 text-sm">
              Open aerial measurement
            </button>
          </div>
        </section>
      </div>
    </main>
  )
}
