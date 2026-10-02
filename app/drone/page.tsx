'use client'
import { useRouter } from 'next/navigation'
export default function DronePage() {
  const router = useRouter()
  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-blue-600 text-white shadow-lg sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center">
          <button onClick={() => router.back()} className="text-white mr-3">Back</button>
          <h1 className="text-xl font-bold">Drone</h1>
        </div>
      </header>
      <main className="p-4"><p className="bg-white rounded-lg shadow p-4 text-sm">No drone is connected. Scan and measurement are Unknown.</p></main>
    </div>
  )
}
