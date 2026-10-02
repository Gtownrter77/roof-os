'use client'

import { useState } from 'react'

export default function ChatPage() {
  const [message, setMessage] = useState('')
  return (
    <main className="min-h-screen bg-gray-50 p-4">
      <h1 className="text-2xl font-bold mb-4">Team Chat</h1>
      <section className="bg-white rounded-lg shadow p-6">
        <p className="text-sm text-gray-600">Live chat persistence is not connected yet. No fabricated messages are shown.</p>
        <form onSubmit={(e) => { e.preventDefault(); setMessage('') }} className="mt-4 flex gap-2">
          <input value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Type a message..." className="flex-1 p-3 border rounded-lg" />
          <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded">Send</button>
        </form>
      </section>
    </main>
  )
}
