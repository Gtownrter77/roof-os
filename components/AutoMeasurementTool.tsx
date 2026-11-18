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
    setStatus('Saving the private photo, then connecting to Ollama on this same device…')
    try {
      await onDetect()
      setStatus('System measurement presented. Verify the numbers.')
    } catch (err) {
      setStatus('Local AI did not complete. Manual tracing is available.')
      setError(err instanceof Error ? err.message : 'Local Ollama roof analysis could not be completed.')
      onManualFallback()
    }
  }

  return (
    <section className="glass mt-4 rounded-xl p-4">
      <h2 className="font-semibold">Roof Detection</h2>
      <p className="text-sm text-slate-400">
        Automatic detection uses Ollama on this device. The system generates the planes, edges, pitch, area, squares, and bundles, then presents them. The tech verifies the result. The photo stays in private inspection storage and is not sent to a hosted AI service.
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
          Trace roof manually
        </button>
      </div>
      {!hasImage && <p className="mt-2 text-xs text-amber-300">Load an actual JPEG, PNG, or WebP image before detection.</p>}
      <p className="mt-2 text-sm text-emerald-400" role="status">{status}</p>
      {error && <p className="mt-2 text-sm text-red-300" role="alert">{error}</p>}
    </section>
  )
}
