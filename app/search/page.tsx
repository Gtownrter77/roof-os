'use client'

import { useState } from 'react'

export default function SearchPage() {
  const [query, setQuery] = useState('')
  return (
    <main className="min-h-screen bg-gray-50 p-4">
      <h1 className="text-2xl font-bold mb-4">Search</h1>
      <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search leads, inspections, reports..." className="w-full p-3 border rounded-lg" />
      <section className="bg-white rounded-lg shadow p-6 mt-4">
        <h2 className="font-semibold">Live search</h2>
        <p className="text-sm text-gray-600 mt-2">{query.trim() ? 'Live search is not connected yet.' : 'Enter a search term.'}</p>
      </section>
    </main>
  )
}
