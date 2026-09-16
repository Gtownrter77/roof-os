'use client'

import { useRouter } from 'next/navigation'

const STEPS = [
  { n: 51, title: 'Closeout gate', href: '/closeout' },
  { n: 52, title: 'Staging rules', href: '/sixth10' },
  { n: 53, title: 'Tiles later', href: '/credits' },
  { n: 54, title: 'NWS desk', href: '/map' },
  { n: 55, title: 'Queue spec', href: '/queue' },
  { n: 56, title: 'Training', href: '/training' },
  { n: 57, title: 'QA punch', href: '/qa' },
  { n: 58, title: 'Incident', href: '/incident' },
  { n: 59, title: 'Preview PRs', href: '/sixth10' },
  { n: 60, title: 'Owner brief', href: '/brief' },
]

export default function Sixth10Page() {
  const router = useRouter()
  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-24">
      <button onClick={() => router.push('/fifth10')} className="text-blue-600 text-sm mb-3">Fifth 10</button>
      <h1 className="text-2xl font-bold">Sixth 10</h1>
      <p className="text-sm text-gray-600 mb-4">Harden the floor. Still no silent send.</p>
      {STEPS.map((step) => (
        <button key={step.n} onClick={() => router.push(step.href)} className="w-full text-left bg-white rounded-lg shadow p-4 mb-2">
          <p className="font-semibold">{step.n}. {step.title}</p>
        </button>
      ))}
    </div>
  )
}
