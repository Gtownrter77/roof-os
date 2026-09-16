'use client'

import { useRouter } from 'next/navigation'

const STEPS = [
  { n: 1, title: 'Sign in', href: '/auth/login', hint: 'Magic link to your work email' },
  { n: 2, title: 'Add a real lead', href: '/leads/new', hint: 'Name, address, phone, first note' },
  { n: 3, title: 'Open the file and set status', href: '/leads', hint: 'It is a record, not a row' },
  { n: 4, title: 'Schedule the inspection', href: '/leads', hint: 'From the lead, onto the calendar' },
  { n: 5, title: 'Take photos', href: '/camera', hint: 'They attach to an inspection session' },
  { n: 6, title: 'Confirm the session', href: '/inspections', hint: 'No fake addresses' },
  { n: 7, title: 'Draft a report', href: '/reports', hint: 'You review. You send.' },
  { n: 8, title: 'Save your rates', href: '/settings', hint: 'Your book, not a carrier list' },
  { n: 9, title: 'Add a task', href: '/tasks', hint: 'Hang it on the lead' },
  { n: 10, title: 'Brief + Passport', href: '/brief', hint: 'Passport saves after migration 020' },
]

export default function StartPage() {
  const router = useRouter()
  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-24">
      <h1 className="text-2xl font-bold">First 10</h1>
      <p className="text-sm text-gray-600 mb-4">Do these in order on one real address. The machine drafts. You send.</p>
      {STEPS.map((step) => (
        <button key={step.n} onClick={() => router.push(step.href)} className="w-full text-left bg-white rounded-lg shadow p-4 mb-2">
          <p className="font-semibold">{step.n}. {step.title}</p>
          <p className="text-sm text-gray-500">{step.hint}</p>
        </button>
      ))}
      <button onClick={() => router.push('/credits')} className="mt-4 text-sm text-blue-600">Open source we build on</button>
    </div>
  )
}
