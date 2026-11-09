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
      setStatus('Local AI suggestions saved. Review every plane, edge, and object before calibration.')
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
        Automatic detection uses Ollama running on this same device at localhost:11434 with the qwen3-vl:8b vision model. The photo is saved to private inspection storage first, then sent directly from this browser to local Ollama; it is not sent to a hosted AI service. This setup does not include an Ollama server on Android by default, so Android users should use manual tracing unless they have separately installed and configured a compatible local service. AI suggestions are not verified measurements: review the geometry and calibrate scale and pitch before using quantities.
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
