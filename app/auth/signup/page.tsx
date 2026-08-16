'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function SignupPage() {
  const router = useRouter()

  useEffect(() => {
    // Auto-redirect to dashboard
    router.push('/')
  }, [router])

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="text-center">
        <div className="text-4xl mb-4">⚡</div>
        <p className="text-gray-500">Redirecting to dashboard...</p>
      </div>
    </div>
  )
}
