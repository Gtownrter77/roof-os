'use client'

const ITEMS = [
  'Photos attached to an inspection, not floating.',
  'Address on the lead.',
  'Draft watermark on estimates.',
  'No public storage bucket.',
  'Invite does not pretend email was sent.',
]

export default function QaPage() {
  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-24">
      <h1 className="text-2xl font-bold">QA punch</h1>
      {ITEMS.map((item) => <div key={item} className="bg-white rounded-lg shadow p-3 mb-2 text-sm">{item}</div>)}
    </div>
  )
}
