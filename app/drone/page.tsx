'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase/client'

type CaptureForm = {
  assetUrl: string
  sourceType: 'drone_photo' | 'drone_video' | 'orthomosaic' | 'oam_imagery' | 'arcgis_imagery'
  capturedAt: string
  latitude: string
  longitude: string
  altitudeM: string
  headingDeg: string
  cameraMake: string
  cameraModel: string
  provider: string
  notes: string
}

const initialForm: CaptureForm = {
  assetUrl: '',
  sourceType: 'drone_photo',
  capturedAt: '',
  latitude: '',
  longitude: '',
  altitudeM: '',
  headingDeg: '',
  cameraMake: '',
  cameraModel: '',
  provider: '',
  notes: '',
}

export default function DronePage() {
  const router = useRouter()
  const supabase = createClient()
  const [form, setForm] = useState<CaptureForm>(initialForm)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const update = <K extends keyof CaptureForm>(key: K, value: CaptureForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }))
  }

  const recordCapture = async () => {
    setSaving(true)
    setMessage('')
    setError('')

    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: workspaceId } = await supabase.rpc('current_workspace_id')
      if (!user || !workspaceId) {
        setError('Sign in with an active workspace before recording aerial evidence.')
        return
      }

      if (!/^https:\/\//i.test(form.assetUrl.trim())) {
        setError('Enter the HTTPS URL of the actual aerial asset. ROOF/OS does not invent or simulate drone media.')
        return
      }

      const numeric = (value: string) => value.trim() === '' ? undefined : Number(value)
      const response = await fetch('/api/measurements/drone', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          assetUrl: form.assetUrl.trim(),
          sourceType: form.sourceType,
          capturedAt: form.capturedAt ? new Date(form.capturedAt).toISOString() : undefined,
          latitude: numeric(form.latitude),
          longitude: numeric(form.longitude),
          altitudeM: numeric(form.altitudeM),
          headingDeg: numeric(form.headingDeg),
          cameraMake: form.cameraMake.trim() || undefined,
          cameraModel: form.cameraModel.trim() || undefined,
          provider: form.provider.trim() || undefined,
          notes: form.notes.trim() || undefined,
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        setError(data.error ?? 'Could not record aerial capture.')
        return
      }

      setMessage(`Aerial evidence recorded as unverified capture ${data.capture?.id?.slice(0, 8) ?? ''}. Human review is still required.`)
      setForm(initialForm)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error while recording aerial evidence.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-blue-700 text-white shadow sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center">
          <button onClick={() => router.back()} className="mr-3 text-xl" aria-label="Back">←</button>
          <h1 className="text-xl font-bold">Aerial Evidence</h1>
        </div>
      </header>

      <main className="p-4 max-w-2xl mx-auto space-y-4">
        <section className="bg-white rounded-lg shadow p-4">
          <h2 className="font-semibold">Record real aerial evidence</h2>
          <p className="text-sm text-gray-600 mt-1">
            This screen records an existing aerial asset in the workspace ledger. It does not connect to a drone,
            generate telemetry, fabricate imagery, or run a simulated scan.
          </p>
        </section>

        {error && <p className="bg-red-50 border border-red-200 text-red-800 p-3 rounded-lg text-sm" role="alert">{error}</p>}
        {message && <p className="bg-green-50 border border-green-200 text-green-800 p-3 rounded-lg text-sm" role="status">{message}</p>}

        <section className="bg-white rounded-lg shadow p-4 space-y-3">
          <label className="block text-sm font-medium">
            Actual aerial asset HTTPS URL *
            <input value={form.assetUrl} onChange={(e) => update('assetUrl', e.target.value)} className="mt-1 w-full p-2 border rounded-lg" placeholder="https://..." />
          </label>

          <label className="block text-sm font-medium">
            Source type
            <select value={form.sourceType} onChange={(e) => update('sourceType', e.target.value as CaptureForm['sourceType'])} className="mt-1 w-full p-2 border rounded-lg">
              <option value="drone_photo">Drone photo</option>
              <option value="drone_video">Drone video</option>
              <option value="orthomosaic">Orthomosaic</option>
              <option value="oam_imagery">OAM imagery</option>
              <option value="arcgis_imagery">ArcGIS imagery</option>
            </select>
          </label>

          <label className="block text-sm font-medium">
            Captured at
            <input type="datetime-local" value={form.capturedAt} onChange={(e) => update('capturedAt', e.target.value)} className="mt-1 w-full p-2 border rounded-lg" />
          </label>

          <div className="grid grid-cols-2 gap-3">
            {([
              ['latitude', 'Latitude'],
              ['longitude', 'Longitude'],
              ['altitudeM', 'Altitude (m)'],
              ['headingDeg', 'Heading (degrees)'],
            ] as const).map(([key, label]) => (
              <label key={key} className="text-sm font-medium">
                {label}
                <input type="number" step="any" value={form[key]} onChange={(e) => update(key, e.target.value)} className="mt-1 w-full p-2 border rounded-lg" />
              </label>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm font-medium">
              Camera make
              <input value={form.cameraMake} onChange={(e) => update('cameraMake', e.target.value)} className="mt-1 w-full p-2 border rounded-lg" />
            </label>
            <label className="text-sm font-medium">
              Camera model
              <input value={form.cameraModel} onChange={(e) => update('cameraModel', e.target.value)} className="mt-1 w-full p-2 border rounded-lg" />
            </label>
          </div>

          <label className="block text-sm font-medium">
            Provider / source
            <input value={form.provider} onChange={(e) => update('provider', e.target.value)} className="mt-1 w-full p-2 border rounded-lg" />
          </label>

          <label className="block text-sm font-medium">
            Notes
            <textarea value={form.notes} onChange={(e) => update('notes', e.target.value)} maxLength={5000} rows={4} className="mt-1 w-full p-2 border rounded-lg" />
          </label>

          <button onClick={() => void recordCapture()} disabled={saving} className="w-full bg-blue-700 text-white py-3 rounded-lg font-semibold disabled:opacity-50">
            {saving ? 'Recording…' : 'Record Aerial Evidence'}
          </button>
        </section>

        <section className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-900">
          <strong>Verification status:</strong> every recorded capture remains <em>unverified</em> until telemetry,
          coverage, date, and measurements are reviewed by an authorized person.
        </section>
      </main>
    </div>
  )
}
