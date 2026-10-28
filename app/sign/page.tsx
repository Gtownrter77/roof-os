'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { smartBack } from '../../lib/smart-back'

export default function SignPage() {
  const router = useRouter()

  return (
    <div className="space-y-4 pb-4">
      <header className="glass rounded-xl mb-4">
        <div className="px-4 py-3 flex items-center">
          <button onClick={() => smartBack(router)} aria-label="Go back" className="mr-3 text-xl text-cyan-300">←</button>
          <h1 className="text-xl font-bold">Document &amp; Contract Signing</h1>
        </div>
      </header>

      <main className="p-4 max-w-3xl mx-auto space-y-4">
        <section className="glass rounded-xl p-5 space-y-3" role="status">
          <h2 className="font-semibold text-white">Electronic signing is not available in ROOF/OS yet</h2>
          <p className="text-sm text-slate-300">
            This screen does not execute a contract, capture consent, issue a signing certificate,
            or store a verified electronic signature. No agreement is signed or saved by visiting this page.
          </p>
          <p className="text-sm text-slate-300">
            Until an authenticated signing provider and tamper-evident audit trail are connected,
            use your approved contract-signing process outside ROOF/OS. Store executed agreements
            in your approved document system and verify their status before advancing the job.
          </p>
          <Link href="/leads" className="inline-flex bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-semibold">
            Open Leads
          </Link>
        </section>
      </main>
    </div>
  )
}
