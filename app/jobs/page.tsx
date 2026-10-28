'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { describeProductionJobStatus } from '../../lib/jobs/production'

type Job = {
  id: string
  job_number: string
  customer_name: string
  property_address: string
  status: string
  accepted_total: number
  accepted_at: string
  scope_item_count: number
}

function money(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value)
}

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const controller = new AbortController()
    const load = async () => {
      try {
        const response = await fetch('/api/production-jobs', { signal: controller.signal })
        const result = await response.json().catch(() => ({}))
        if (controller.signal.aborted) return
        if (!response.ok) {
          setMessage(result.error ?? 'Could not load production jobs.')
          return
        }
        setJobs(result.jobs ?? [])
      } catch {
        if (!controller.signal.aborted) setMessage('Could not load production jobs.')
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    void load()
    return () => controller.abort()
  }, [])

  return (
    <main className="mx-auto max-w-4xl space-y-4 p-6">
      <header className="flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-bold">🏗️ Production jobs</h1>
        <Link href="/estimate" className="ml-auto text-xs text-cyan-300">Estimates →</Link>
      </header>
      <p className="text-sm text-slate-400">
        Jobs appear here after an accepted estimate is handed off. The customer, amount, and scope are the values recorded at acceptance.
      </p>
      {message && <p role="alert" className="rounded border border-red-500 p-3 text-sm text-red-200">{message}</p>}
      {loading && <p className="text-sm text-slate-400">Loading jobs…</p>}
      {!loading && jobs.length === 0 && !message && (
        <p className="rounded-xl border border-white/10 bg-slate-900 p-4 text-sm text-slate-400">
          No production jobs yet. Open an approved estimate with a recorded customer acceptance to create one.
        </p>
      )}
      <ul className="space-y-2">
        {jobs.map((job) => (
          <li key={job.id}>
            <Link href={`/jobs/${job.id}`} className="block rounded-xl border border-white/10 bg-slate-900 p-4 hover:border-cyan-400/60">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-mono text-sm text-cyan-200">{job.job_number}</span>
                <span className="rounded bg-emerald-400/15 px-2 py-0.5 text-xs font-semibold text-emerald-200">{describeProductionJobStatus(job.status)}</span>
              </div>
              <p className="mt-1 font-semibold">{job.customer_name}</p>
              <p className="text-sm text-slate-400">{job.property_address}</p>
              <p className="mt-1 text-xs text-slate-500">
                {money(job.accepted_total)} accepted {new Date(job.accepted_at).toLocaleDateString()} · {job.scope_item_count} approved scope line{job.scope_item_count === 1 ? '' : 's'}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  )
}
