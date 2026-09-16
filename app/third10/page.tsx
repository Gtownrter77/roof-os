'use client'

import { useRouter } from 'next/navigation'

const STEPS = [
  { n: 21, title: 'Photo albums', href: '/albums' },
  { n: 22, title: 'Markup (later)', href: '/albums' },
  { n: 23, title: 'Share stub', href: '/share' },
  { n: 24, title: 'Invite helper', href: '/team' },
  { n: 25, title: 'Crew labels', href: '/crew' },
  { n: 26, title: 'Passport', href: '/leads' },
  { n: 27, title: 'Supplements', href: '/supplement' },
  { n: 28, title: 'Year offer', href: '/offer' },
  { n: 29, title: 'NWS desk', href: '/map' },
  { n: 30, title: 'Tiles later', href: '/credits' },
]

export default function Third10Page() {
  const router = useRouter()
  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-24">
      <button onClick={() => router.push('/next10')} className="text-blue-600 text-sm mb-3">Next 10</button>
      <h1 className="text-2xl font-bold">Third 10</h1>
      <p className="text-sm text-gray-600 mb-4">Company layer. Still drafts until you send.</p>
      {STEPS.map((step) => (
        <button key={step.n} onClick={() => router.push(step.href)} className="w-full text-left bg-white rounded-lg shadow p-4 mb-2">
          <p className="font-semibold">{step.n}. {step.title}</p>
        </button>
      ))}
    </div>
  )
}
