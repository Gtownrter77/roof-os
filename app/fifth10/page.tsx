'use client'

import { useRouter } from 'next/navigation'

const STEPS = [
  { n: 41, title: 'How money moves', href: '/billing' },
  { n: 42, title: 'Year prices', href: '/offer' },
  { n: 43, title: 'Webhook later', href: '/billing' },
  { n: 44, title: 'Export stub', href: '/export' },
  { n: 45, title: 'Close account', href: '/billing' },
  { n: 46, title: 'Plain terms', href: '/legal' },
  { n: 47, title: 'Backups later', href: '/billing' },
  { n: 48, title: 'Domain later', href: '/billing' },
  { n: 49, title: 'Storage cap later', href: '/billing' },
  { n: 50, title: 'Status later', href: '/billing' },
]

export default function Fifth10Page() {
  const router = useRouter()
  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-24">
      <button onClick={() => router.push('/fourth10')} className="text-blue-600 text-sm mb-3">Fourth 10</button>
      <h1 className="text-2xl font-bold">Fifth 10</h1>
      <p className="text-sm text-gray-600 mb-4">Stay alive as a product. Card never sits in our database.</p>
      {STEPS.map((step) => (
        <button key={step.n} onClick={() => router.push(step.href)} className="w-full text-left bg-white rounded-lg shadow p-4 mb-2">
          <p className="font-semibold">{step.n}. {step.title}</p>
        </button>
      ))}
    </div>
  )
}
