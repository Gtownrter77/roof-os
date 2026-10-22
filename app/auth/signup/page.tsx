'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../../lib/supabase/client'

export default function SignupPage() {
  const router = useRouter()
  const supabase = createClient()
  const [company, setCompany] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoading(true); setMessage(''); setError('')
    const { error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { company_name: company.trim() }, emailRedirectTo: `${window.location.origin}/auth/callback` },
    })
    if (signUpError) setError(signUpError.message)
    else setMessage('Check your email to confirm the new workspace. After that, sign in with the password you chose.')
    setLoading(false)
  }

  return (
    <div className="ops-bg flex min-h-screen items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm glass rounded-2xl p-6">
        <div className="text-4xl mb-3 text-center">⚡</div>
        <h1 className="text-xl font-bold text-center">Create your ROOF/OS workspace</h1>
        <p className="text-sm text-slate-400 text-center mt-1 mb-6">Choose a password so you can sign in without waiting for email links.</p>
        <label className="block text-sm font-medium text-slate-200 mb-1" htmlFor="company">Company name</label>
        <input id="company" type="text" required value={company} onChange={(event) => setCompany(event.target.value)} className="ops-input mb-4" placeholder="Your Roofing Company" />
        <label className="block text-sm font-medium text-slate-200 mb-1" htmlFor="email">Work email</label>
        <input id="email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="ops-input mb-4" placeholder="you@company.com" />
        <label className="block text-sm font-medium text-slate-200 mb-1" htmlFor="password">Password</label>
        <input id="password" type="password" required minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} className="ops-input mb-4" placeholder="At least 8 characters" />
        {message && <p className="text-sm text-emerald-300 mb-3" role="status">{message}</p>}
        {error && <p className="text-sm text-red-300 mb-3" role="alert">{error}</p>}
        <button type="submit" disabled={loading} className="ops-btn-primary w-full py-3 disabled:opacity-60">{loading ? 'Creating workspace…' : 'Create workspace'}</button>
        <button type="button" onClick={() => router.push('/auth/login')} className="mt-4 w-full text-sm text-cyan-300">Already have an account?</button>
      </form>
    </div>
  )
}
