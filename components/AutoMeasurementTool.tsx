'use client'

import React, { useState } from 'react'

type AutoMeasurementToolProps = {
  hasImage: boolean
  working?: boolean
  onDetect: () => Promise<void> | void
  onManualFallback: () => void
}

export default function AutoMeasurementTool({ hasImage, working = false, onDetect, onManualFallback }: AutoMeasurementToolProps) {
  const [status, setStatus] = useState('Idle')
  const [error, setError] = useState('')

  async function runAutoDetect() {
    if (!hasImage) {
      setError('Load an actual roof image first.')
      setStatus('Waiting for image')
      return
    }
    setError('')
    setStatus('Sending the private roof photo to Google Gemini…')
    try {
      await onDetect()
      setStatus('AI suggestions saved. Review every plane, edge, and object before calibration.')
    } catch (err) {
      setStatus('Roof AI did not complete. Use manual tracing or the OpenStreetMap footprint.')
      setError(err instanceof Error ? err.message : 'Google Gemini roof analysis could not be completed.')
      onManualFallback()
    }
  }

  return (
    <section className="glass mt-4 rounded-xl p-4">
      <h2 className="font-semibold">Auto-Measurement Tool</h2>
      <p className="text-sm text-slate-400">
        When you choose Detect roof, the image is saved in private inspection storage and sent securely from the server to Google Gemini for image-coordinate suggestions. AI does not calculate verified dimensions; a person must review the shapes and calibrate scale and pitch.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void runAutoDetect()}
          disabled={working || !hasImage}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {working ? 'Working…' : 'Detect roof with AI'}
        </button>
        <button
          type="button"
          onClick={onManualFallback}
          disabled={working}
          className="rounded-lg border border-white/20 px-4 py-2 text-sm font-semibold text-slate-100 disabled:opacity-50"
        >
          Use manual tracing
        </button>
      </div>
      {!hasImage && <p className="mt-2 text-xs text-amber-300">Load an actual JPEG, PNG, or WebP image before detection.</p>}
      <p className="mt-2 text-sm text-emerald-400" role="status">{status}</p>
      {error && <p className="mt-2 text-sm text-red-300" role="alert">{error}</p>}
    </section>
  )
}
