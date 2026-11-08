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
    setStatus('Analyzing in your browser with the local vision service…')
    try {
      await onDetect()
      setStatus('Local suggestions saved. Review every plane, edge, and object before calibration.')
    } catch (err) {
      setStatus('Local vision did not complete. No hosted AI fallback was used.')
      setError(err instanceof Error ? err.message : 'Could not reach the local vision service.')
    }
  }

  return (
    <section className="glass mt-4 rounded-xl p-4">
      <h2 className="font-semibold">Auto-Measurement Tool</h2>
      <p className="text-sm text-slate-400">
        Roof detection runs directly from this browser to the local OpenAI-compatible vision service at localhost:20128. It suggests image-coordinate geometry only; scale and pitch must be measured by a person.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void runAutoDetect()}
          disabled={working || !hasImage}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {working ? 'Working…' : 'Detect roof with local AI'}
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
