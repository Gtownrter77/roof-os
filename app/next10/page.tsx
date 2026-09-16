'use client'

import { useRouter } from 'next/navigation'

const STEPS = [
  { n: 11, title: 'Field app shell', href: '/start', hint: 'Expo app lives in apps/field. Store build needs Expo login.' },
  { n: 12, title: 'Offline queue (spec)', href: '/camera', hint: 'Photos still need signal. Queue is next code, not tonight.' },
  { n: 13, title: 'Map + NWS + our files', href: '/map', hint: 'Candidates next to our leads. Not a hit list.' },
  { n: 14, title: 'Alert layer stub', href: '/canvass', hint: 'NWS headlines. Not a hail swath product yet.' },
  { n: 15, title: 'Our customers first', href: '/canvass', hint: 'Knock the files we already have before new doors.' },
  { n: 16, title: 'Route engine', href: '/credits', hint: 'OSRM later. Not wired.' },
  { n: 17, title: 'Draft squares', href: '/estimate', hint: 'You type squares. OSM assist later.' },
  { n: 18, title: 'Draft estimate', href: '/estimate', hint: 'From your book when one is active.' },
  { n: 19, title: 'Human send', href: '/estimate', hint: 'No email button that auto-fires.' },
  { n: 20, title: 'Credit the builders', href: '/credits', hint: 'Name the open source.' },
]

export default function Next10Page() {
  const router = useRouter()
  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-24">
      <button onClick={() => router.push('/start')} className="text-blue-600 text-sm mb-3">First 10</button>
      <h1 className="text-2xl font-bold">Next 10</h1>
      <p className="text-sm text-gray-600 mb-4">After one real file works. Drafts only.</p>
      {STEPS.map((step) => (
        <button key={step.n} onClick={() => router.push(step.href)} className="w-full text-left bg-white rounded-lg shadow p-4 mb-2">
          <p className="font-semibold">{step.n}. {step.title}</p>
          <p className="text-sm text-gray-500">{step.hint}</p>
        </button>
      ))}
    </div>
  )
}
