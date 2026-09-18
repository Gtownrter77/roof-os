'use client'

const PLANS = [
  { name: 'Starter', price: '$349 / year', includes: 'Office file, photos, draft report, one workspace' },
  { name: 'Shop', price: '$599 / year', includes: 'Passport, warranty desk, canvass list, team invite record' },
  { name: 'Crew', price: '$999 / year', includes: 'Everything in Shop plus more field seats when the app is store-ready' },
]

export default function OfferPage() {
  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-24">
      <h1 className="text-2xl font-bold">Year offer</h1>
      <p className="text-sm text-gray-600 mb-4">For the first ten shops. Cancel in year one. No certified measure. No carrier book.</p>
      {PLANS.map((plan) => (
        <div key={plan.name} className="bg-white rounded-lg shadow p-4 mb-3">
          <p className="font-semibold">{plan.name}</p>
          <p className="text-xl font-bold mt-1">{plan.price}</p>
          <p className="text-sm text-gray-600 mt-2">{plan.includes}</p>
        </div>
      ))}
      <p className="text-xs text-gray-500">You approve every number that leaves the shop.</p>
    </div>
  )
}
