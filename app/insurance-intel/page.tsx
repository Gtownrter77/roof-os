'use client'
import { useRouter } from 'next/navigation'
export default function InsuranceIntelPage() {
  const router = useRouter()
  return <div className="min-h-screen bg-gray-50 p-4"><button onClick={() => router.back()}>Back</button><p className="bg-white rounded-lg shadow p-4 mt-4 text-sm">No permit office or carrier was queried. Permit and insurance status are Unknown.</p></div>
}
