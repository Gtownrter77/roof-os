'use client'

const CREDIT = [
  { name: 'Next.js', use: 'Office app' },
  { name: 'Expo / React Native', use: 'Field shell' },
  { name: 'Supabase', use: 'Auth, Postgres, Storage, RLS' },
  { name: 'PostgreSQL', use: 'The file cabinet' },
  { name: 'National Weather Service', use: 'Alert candidates, not a claim' },
  { name: 'OpenStreetMap', use: 'Geocode and footprint assist' },
  { name: 'Leaflet', use: 'Maps we will put pins on' },
  { name: 'Pipecat / LiveKit', use: 'Voice later, if we ever answer a phone' },
  { name: 'OSRM / Valhalla', use: 'Canvasser routes later' },
]

export default function CreditsPage() {
  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-24">
      <h1 className="text-2xl font-bold mb-2">Built on other people\u2019s work</h1>
      <p className="text-sm text-gray-600 mb-4">We name them. We do not sell their code as ours.</p>
      {CREDIT.map((item) => (
        <div key={item.name} className="bg-white rounded-lg shadow p-3 mb-2">
          <p className="font-semibold">{item.name}</p>
          <p className="text-sm text-gray-500">{item.use}</p>
        </div>
      ))}
    </div>
  )
}
