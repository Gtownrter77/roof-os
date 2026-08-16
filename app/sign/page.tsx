'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function SignPage() {
  const router = useRouter()
  const [signed, setSigned] = useState(false)
  const [signature, setSignature] = useState('')
  const [documents] = useState([
    { id: 1, name: 'Inspection Report - 123 Main St', status: 'Pending', date: '2024-01-15' },
    { id: 2, name: 'Contract - Jane Smith', status: 'Signed', date: '2024-01-14' },
    { id: 3, name: 'Release Form - 789 Pine Rd', status: 'Pending', date: '2024-01-13' },
  ])

  const handleSign = () => {
    if (signature.length < 3) {
      alert('Please enter your full name')
      return
    }
    setSigned(true)
    setTimeout(() => {
      alert('✅ Document signed successfully!')
      router.back()
    }, 1000)
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-blue-600 text-white shadow-lg sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center">
          <button onClick={() => router.back()} className="text-white mr-3 text-xl">←</button>
          <h1 className="text-xl font-bold">✍️ Document Signing</h1>
        </div>
      </header>

      <main className="p-4">
        <div className="bg-white rounded-lg shadow p-4 mb-4">
          <h3 className="font-semibold text-sm mb-3">📄 Pending Documents</h3>
          {documents.filter(d => d.status === 'Pending').length === 0 ? (
            <p className="text-sm text-gray-400 text-center">No pending documents</p>
          ) : (
            documents.filter(d => d.status === 'Pending').map((doc) => (
              <div key={doc.id} className="flex justify-between items-center py-2 border-b last:border-0">
                <div>
                  <p className="font-medium text-sm">{doc.name}</p>
                  <p className="text-xs text-gray-400">{doc.date}</p>
                </div>
                <button className="bg-blue-600 text-white text-xs px-3 py-1 rounded">
                  Sign Now
                </button>
              </div>
            ))
          )}
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="font-semibold text-sm mb-3">✍️ Sign Document</h3>
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center mb-4">
            <span className="text-4xl block mb-2">📝</span>
            <p className="text-gray-500">Type your full name to sign</p>
          </div>

          <input
            type="text"
            value={signature}
            onChange={(e) => setSignature(e.target.value)}
            placeholder="Type your full name"
            className="w-full p-3 border rounded-lg mb-3"
            disabled={signed}
          />

          <button
            onClick={handleSign}
            disabled={signed}
            className={`w-full py-3 rounded-lg font-semibold ${
              signed ? 'bg-green-600 text-white' : 'bg-blue-600 text-white'
            }`}
          >
            {signed ? '✅ Signed' : '✍️ Sign Document'}
          </button>
        </div>

        <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-3">
          <p className="text-sm text-green-800">🔒 All signatures are legally binding</p>
        </div>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t flex justify-around py-2 px-4">
        <button onClick={() => router.push('/')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">🏠</span>
          <span className="text-xs">Home</span>
        </button>
        <button onClick={() => router.push('/sign')} className="flex flex-col items-center text-blue-600">
          <span className="text-xl">✍️</span>
          <span className="text-xs">Sign</span>
        </button>
        <button onClick={() => router.push('/chat')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">💬</span>
          <span className="text-xs">Chat</span>
        </button>
        <button onClick={() => router.push('/notifications')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">🔔</span>
          <span className="text-xs">Alerts</span>
        </button>
        <button onClick={() => router.push('/settings')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">⚙️</span>
          <span className="text-xs">Settings</span>
        </button>
      </nav>
    </div>
  )
}
