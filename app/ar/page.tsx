'use client'
import { useRouter } from 'next/navigation'
export default function ArPage() {
  const router = useRouter()
  return <div className="min-h-screen bg-gray-50 p-4"><button onClick={() => router.back()}>Back</button><p className="bg-white rounded-lg shadow p-4 mt-4 text-sm">No camera measurement is connected. Result is Unknown.</p></div>
}
