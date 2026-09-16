'use client'

import { useRouter } from 'next/navigation'

const STEPS = [
  { n: 31, title: 'Homeowner portal stub', href: '/portal' },
  { n: 32, title: 'Materials', href: '/materials' },
  { n: 33, title: 'Calendar', href: '/calendar' },
  { n: 34, title: 'Tiles later', href: '/credits' },
  { n: 35, title: 'NWS desk', href: '/map' },
  { n: 36, title: 'Push later', href: '/crew' },
  { n: 37, title: 'Year prices', href: '/offer' },
  { n: 38, title: 'Lead activity', href: '/leads' },
  { n: 39, title: 'Offer page', href: '/offer' },
  { n: 40, title: 'YouTube list', href: '/fourth10' },
]

export default function Fourth10Page() {
  const router = useRouter()
  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-24">
      <button onClick={() => router.push('/third10')} className="text-blue-600 text-sm mb-3">Third 10</button>
      <h1 className="text-2xl font-bold">Fourth 10</h1>
      <p className="text-sm text-gray-600 mb-4">Money and the homeowner. Still no silent send.</p>
      {STEPS.map((step) => (
        <button key={step.n} onClick={() => router.push(step.href)} className="w-full text-left bg-white rounded-lg shadow p-4 mb-2">
          <p className="font-semibold">{step.n}. {step.title}</p>
        </button>
      ))}
    </div>
  )
}
