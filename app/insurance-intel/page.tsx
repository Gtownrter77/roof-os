'use client'

import { useState } from 'react'

export default function InsuranceIntelPage() {
  const [address, setAddress] = useState('')
  const [message, setMessage] = useState('')

  return (
    <main className="min-h-screen bg-gray-50 p-4">
      <h1 className="text-2xl font-bold mb-4">Insurance Intel</h1>
      <section className="bg-white rounded-lg shadow p-6">
        <label className="block text-sm font-medium">
          Property address
          <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Enter property address" className="w-full p-3 border rounded mt-1" />
        </label>
        <button
          onClick={() => setMessage(address.trim() ? 'Live insurance and permit sources are not connected on this screen.' : 'Enter an address first.')}
          className="mt-4 bg-blue-600 text-white px-4 py-2 rounded"
        >
          Check
        </button>
        {message && <p className="mt-4 text-sm text-gray-600">{message}</p>}
        <p className="mt-4 text-xs text-gray-500">
          No unverified state-law, permit, case-law, penalty, phone, or building-department claims are presented as current data.
        </p>
      </section>
    </main>
  )
}
