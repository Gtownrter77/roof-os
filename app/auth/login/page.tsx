'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()

  const [email, setEmail] = useState('')
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    document.cookie = 'auth=demo-session; Path=/; SameSite=Lax'
    router.push('/')
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm bg-white rounded-2xl shadow-lg p-6">
        <div className="text-4xl mb-3 text-center">⚡</div>
        <h1 className="text-xl font-bold text-center">Welcome to ROOF/OS</h1>
        <p className="text-sm text-gray-500 text-center mt-1 mb-6">Sign in to your roofing command center.</p>
        <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="email">Email</label>
        <input id="email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="w-full p-3 border rounded-lg mb-4" placeholder="you@company.com" />
        <button type="submit" className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold">Sign in</button>
        <button type="button" onClick={() => router.push('/auth/signup')} className="w-full text-blue-600 text-sm mt-4">Create an account</button>
      </form>
    </div>
  )
}
