'use client'

import { useState } from 'react'

export default function AIPage() {
  const [message, setMessage] = useState('')

  return (
    <main className="min-h-screen bg-gray-50 p-4">
      <h1 className="text-2xl font-bold mb-4">AI Report Generator</h1>
      <section className="bg-white rounded-lg shadow p-6">
        <h2 className="font-semibold">AI report generation is not connected</h2>
        <p className="text-sm text-gray-600 mt-2">
          No fabricated inspection findings, addresses, dates, inspectors, or AI results are shown.
          Live AI output must come from an approved provider and remain subject to technician review.
        </p>
        <p className="text-sm text-gray-600 mt-4">{message}</p>
        <button onClick={() => setMessage('No AI provider is connected on this screen.')} className="mt-2 bg-gray-800 text-white px-4 py-2 rounded">
          Check AI connection
        </button>
      </section>
    </main>
  )
}
