import { Suspense } from 'react'
import LeadsClient from './LeadsClient'

export const dynamic = 'force-dynamic'

export default function LeadsPage() {
  return (
    <Suspense
      fallback={
        <main className="space-y-4 p-6 text-sm text-slate-400">Loading leads…</main>
      }
    >
      <LeadsClient />
    </Suspense>
  )
}
