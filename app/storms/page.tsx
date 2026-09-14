 'use client'

import { useRouter } from 'next/navigation'

export default function StormsPage() {
  const router = useRouter()
  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-20">
      <button onClick={() => router.push('/')} className="text-blue-600 text-sm mb-2">← Dashboard</button>
      <h1 className="text-2xl font-bold mb-4">🌩️ Storms</h1>
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
        <p className="font-semibold">⚠️ Severe Thunderstorm Warning</p>
        <p className="text-sm text-yellow-700">Active until 8:00 PM EST</p>
      </div>
      <div className="bg-white rounded-lg shadow p-4">
        <p className="font-semibold">Storm Score: 78</p>
        <p className="text-sm text-gray-500">Weather Relevance: 85</p>
      </div>
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t flex justify-around py-2 px-4"><button onClick={() => router.push('/')} className="text-gray-500 text-sm">🏠 Home</button><button onClick={() => router.push('/weather')} className="text-gray-500 text-sm">🌤️ Weather</button><button onClick={() => router.push('/storms')} className="text-blue-600 text-sm">🌩️ Storms</button><button onClick={() => router.push('/settings')} className="text-gray-500 text-sm">⚙️ Settings</button></nav>
    </div>
  )
}
