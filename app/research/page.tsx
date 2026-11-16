'use client'

import { useState } from 'react'
type Finding = { title: string; url: string; excerpt: string }
export default function ResearchPage() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Finding[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  async function search(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (loading) return
    setLoading(true); setResults([]); setError('')
    try {
      const response = await fetch('/api/research/parallel', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query }), cache: 'no-store',
      })
      const data = await response.json() as { results?: Finding[]; error?: string }
      if (!response.ok) throw new Error(data.error || 'Research unavailable.')
      setResults(Array.isArray(data.results) ? data.results : [])
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Research unavailable.')
    } finally { setLoading(false) }
  }
  return (
    <main className="mx-auto max-w-4xl space-y-6 p-6 text-slate-100">
      <div>
        <h1 className="text-3xl font-bold">Research & Intelligence</h1>
        <p className="mt-2 text-sm text-slate-300">Optional Parallel anonymous search. No Parallel API key, credit card, paid calls, or replacement of existing sources.</p>
      </div>
      <form onSubmit={search} className="space-y-3 rounded-xl border border-slate-600 bg-slate-900 p-4">
        <label htmlFor="research-query" className="block font-medium">Research a public topic</label>
        <textarea id="research-query" value={query} onChange={(event) => setQuery(event.target.value)}
          minLength={4} maxLength={180} required rows={3}
          placeholder="Example: GAF Timberline HDZ installation instructions"
          className="w-full rounded-md border border-slate-600 bg-slate-950 p-3" />
        <p className="text-xs text-amber-200">Do not enter customer names, private addresses, case files, or confidential claim data. Sources are suggestions, not verified damage or pricing.</p>
        <button type="submit" disabled={loading || query.trim().length < 4}
          className="rounded-lg bg-cyan-700 px-4 py-2 font-semibold text-white disabled:opacity-50">
          {loading ? 'Searching…' : 'Search free research'}
        </button>
      </form>
      {error && <section role="alert" className="rounded-lg border border-amber-500 p-4">
        <p>{error}</p><p className="mt-2">Your existing <a className="underline" href="/weather">storm research</a> and <a className="underline" href="/measure">property tools</a> remain available.</p>
      </section>}
      {results.length > 0 && <section aria-label="Research sources" className="space-y-4">
        <h2 className="text-xl font-semibold">Sources found ({results.length})</h2>
        {results.map((result, index) => <article key={result.url + index} className="rounded-xl border border-slate-700 p-4">
          <a href={result.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-cyan-300 underline">{result.title}</a>
          <p className="mt-2 whitespace-pre-wrap text-sm text-slate-300">{result.excerpt}</p>
          <p className="mt-2 break-all text-xs text-slate-400">{result.url}</p>
        </article>)}
        <p className="text-sm text-amber-200">Review primary sources before using information for measurements, estimates, codes or insurance supplements.</p>
      </section>}
    </main>
  )
}
