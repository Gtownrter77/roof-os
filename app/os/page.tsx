'use client'

import { useRouter } from 'next/navigation'

const BATCHES = [
  { label: '1–10 Live file', href: '/start' },
  { label: '11–20 Street + draft', href: '/next10' },
  { label: '21–30 Company layer', href: '/third10' },
  { label: '31–40 Homeowner + money story', href: '/fourth10' },
  { label: '41–50 Stay alive', href: '/fifth10' },
  { label: '51–60 Harden the floor', href: '/sixth10' },
]

export default function OsPage() {
  const router = useRouter()
  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-24">
      <h1 className="text-2xl font-bold">The whole path</h1>
      <p className="text-sm text-gray-600 mb-4">The machine drafts. You send.</p>
      {BATCHES.map((batch) => (
        <button key={batch.href} onClick={() => router.push(batch.href)} className="w-full text-left bg-white rounded-lg shadow p-4 mb-2 font-semibold">{batch.label}</button>
      ))}
      <button onClick={() => router.push('/credits')} className="mt-2 text-sm text-blue-600">Open source we build on</button>
    </div>
  )
}
