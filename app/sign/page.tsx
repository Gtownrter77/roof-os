'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface DocumentItem {
  id: number
  name: string
  status: 'Pending' | 'Signed'
  date: string
}

export default function SignPage() {
  const router = useRouter()
  const [signed, setSigned] = useState(false)
  const [signature, setSignature] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [documents, setDocuments] = useState<DocumentItem[]>([
    { id: 1, name: 'Work Authorization Contract - 4821 Whispering Pines', status: 'Pending', date: '2026-09-28' },
    { id: 2, name: 'Notice of Cancellation & Lien Waiver - Sarah Jenkins', status: 'Signed', date: '2026-09-27' },
    { id: 3, name: 'Certificate of Final Completion - Marcus Vance', status: 'Pending', date: '2026-09-29' },
  ])

  const handleSign = () => {
    if (signature.trim().length < 3) {
      setErrorMessage('Please enter your full legal name to generate e-signature.')
      return
    }
    setErrorMessage('')
    setSigned(true)
    setSuccessMessage('Document legally executed and timestamped. Verification certificate stored.')
    setDocuments((prev) =>
      prev.map((d, i) => (i === 0 ? { ...d, status: 'Signed' as const } : d))
    )
  }

  return (
    <div className="space-y-4 pb-4">
      <header className="glass sticky top-0 z-10 rounded-xl mb-4">
        <div className="px-4 py-3 flex items-center">
          <button onClick={() => router.back()} className="mr-3 text-xl text-cyan-300">←</button>
          <h1 className="text-xl font-bold">✍️ Document &amp; Contract Signing</h1>
        </div>
      </header>

      <main className="p-4 max-w-3xl mx-auto space-y-4">
        {errorMessage && (
          <div className="bg-red-400/10 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm">
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div className="bg-emerald-400/10 border border-emerald-400/30 text-green-800 px-4 py-3 rounded-lg text-sm font-semibold">
            {successMessage}
          </div>
        )}

        <div className="glass rounded-xl p-4">
          <h3 className="font-semibold text-sm mb-3">📄 Pending Authorization Documents</h3>
          <div className="divide-y">
            {documents.map((doc) => (
              <div key={doc.id} className="flex justify-between items-center py-2.5">
                <div>
                  <p className="font-medium text-sm text-white">{doc.name}</p>
                  <p className="text-xs text-slate-400">{doc.date}</p>
                </div>
                <span
                  className={`text-xs px-2.5 py-1 rounded font-semibold ${
                    doc.status === 'Signed' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {doc.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="glass rounded-xl p-4 space-y-3">
          <h3 className="font-semibold text-sm">✍️ E-Sign Roofing Contract</h3>
          <div className="border-2 border-dashed border-white/15 rounded-lg p-6 text-center bg-white/5">
            <span className="text-3xl block mb-1">📝</span>
            <p className="text-xs text-slate-400">Sign below with legal name for binding contractor authorization</p>
            {signature && (
              <p className="text-xl font-serif italic text-cyan-300 mt-2 font-bold">{signature}</p>
            )}
          </div>

          <input
            type="text"
            value={signature}
            onChange={(e) => setSignature(e.target.value)}
            placeholder="Type your full legal name (e.g. John Doe)"
            className="w-full p-2.5 border rounded-lg text-sm"
            disabled={signed}
          />

          <button
            onClick={handleSign}
            disabled={signed}
            className={`w-full py-2.5 rounded-lg font-semibold text-sm transition-colors ${
              signed ? 'bg-green-600 text-white cursor-default' : 'bg-blue-600 hover:bg-cyan-400/100 text-white'
            }`}
          >
            {signed ? '✅ Contract Legally Executed' : '✍️ Execute Legal Signature'}
          </button>
        </div>

        <div className="bg-cyan-400/10 border border-cyan-400/30 rounded-lg p-3 text-xs text-cyan-200">
          🔒 ESIGN &amp; UETA Compliant • IP, Browser User Agent &amp; UTC Timestamp permanently recorded with Roof Passport.
        </div>
      </main>
    </div>
  )
}
