'use client'

import { useRouter } from 'next/navigation'

export default function SignPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-blue-600 text-white shadow-lg sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center">
          <button onClick={() => router.back()} className="text-white mr-3 text-xl">←</button>
          <h1 className="text-xl font-bold">✍️ Document Signing</h1>
        </div>
      </header>

      <main className="p-4 max-w-3xl mx-auto space-y-4">
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-900 rounded-lg p-4">
          <h2 className="font-semibold">Digital signature workflow is not connected.</h2>
          <p className="text-sm mt-2">
            This screen does not create a legal signature, execute a contract, store a certificate,
            or claim ESIGN/UETA compliance. No fabricated documents or signed records are shown.
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="font-semibold text-sm">Required before customer use</h2>
          <ul className="text-sm text-gray-600 mt-2 space-y-1 list-disc pl-5">
            <li>Load the actual workspace document and its immutable version.</li>
            <li>Capture the signer identity and consent against the real document.</li>
            <li>Persist the signature evidence and audit event server-side.</li>
            <li>Verify the completed document before presenting it as executed.</li>
          </ul>
        </div>

        <button
          type="button"
          disabled
          className="w-full bg-gray-300 text-gray-600 py-3 rounded-lg font-semibold cursor-not-allowed"
        >
          Signature unavailable until the persisted signing workflow is implemented
        </button>
      </main>
    </div>
  )
}
