'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '../../../lib/supabase/client'
import { safeNextPath } from '../../../lib/safe-next'

type Factor = {
  id: string
  friendly_name?: string | null
  factor_type: string
  status: string
}

export default function MfaPage() {
  const router = useRouter()
  const search = useSearchParams()
  const supabase = createClient()
  const next = safeNextPath(search.get('next'), typeof window === 'undefined' ? 'https://invalid.local' : window.location.origin)
  const [factor, setFactor] = useState<Factor | null>(null)
  const [challengeId, setChallengeId] = useState('')
  const [qrCode, setQrCode] = useState('')
  const [secret, setSecret] = useState('')
  const [code, setCode] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function prepare() {
      setLoading(true)
      setError('')
      const { data: userData, error: userError } = await supabase.auth.getUser()
      if (userError || !userData.user) {
        router.replace('/auth/login')
        return
      }

      const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors()
      if (factorsError) {
        setError('Unable to load multi-factor authentication settings.')
        setLoading(false)
        return
      }

      const verified = factors.totp.find((item) => item.status === 'verified') as Factor | undefined
      if (verified) {
        if (!cancelled) {
          setFactor(verified)
          await createChallenge(verified.id)
        }
        return
      }

      const { data: enrollment, error: enrollmentError } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'ROOF/OS Authenticator',
      })

      if (enrollmentError || !enrollment?.id) {
        setError(enrollmentError?.message || 'Unable to start authenticator enrollment.')
        setLoading(false)
        return
      }

      if (cancelled) return
      setFactor({ id: enrollment.id, friendly_name: enrollment.friendly_name, factor_type: enrollment.type, status: enrollment.status })
      setQrCode(enrollment.totp.qr_code)
      setSecret(enrollment.totp.secret)
      await createChallenge(enrollment.id)
    }

    async function createChallenge(factorId: string) {
      const { data, error: challengeError } = await supabase.auth.mfa.challenge({ factorId })
      if (challengeError || !data?.id) {
        setError(challengeError?.message || 'Unable to start the authenticator challenge.')
      } else {
        setChallengeId(data.id)
      }
      setLoading(false)
    }

    void prepare()
    return () => {
      cancelled = true
    }
  }, [next, router, supabase])

  async function verify() {
    if (!factor || !challengeId || !/^\d{6}$/.test(code)) {
      setError('Enter the 6-digit authenticator code.')
      return
    }

    setWorking(true)
    setError('')
    setMessage('')

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId: factor.id,
      challengeId,
      code,
    })

    if (verifyError) {
      setError('That authenticator code was not accepted. Check the code and try again.')
      setWorking(false)
      return
    }

    setMessage('Multi-factor authentication verified.')
    router.replace(next)
    router.refresh()
  }

  if (loading) return <main className="min-h-screen flex items-center justify-center p-4"><p className="text-sm text-gray-600">Preparing secure sign-in…</p></main>

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <section className="w-full max-w-md bg-white rounded-2xl shadow-lg p-6">
        <h1 className="text-xl font-bold">Multi-factor authentication</h1>
        <p className="text-sm text-gray-600 mt-2">
          ROOF/OS requires an authenticator factor for workspace owners and administrators.
        </p>

        {qrCode && (
          <div className="mt-5">
            <p className="text-sm font-medium mb-2">Scan this QR code with an authenticator app.</p>
            <img src={qrCode} alt="ROOF/OS authenticator enrollment QR code" className="w-56 h-56 border rounded-lg bg-white p-2" />
            <p className="text-xs text-gray-600 mt-3">If scanning is unavailable, enter this setup key manually:</p>
            <code className="block mt-1 p-2 bg-gray-100 rounded text-xs break-all">{secret}</code>
          </div>
        )}

        <label className="block text-sm font-medium text-gray-700 mt-5 mb-1" htmlFor="mfa-code">6-digit authenticator code</label>
        <input
          id="mfa-code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
          className="w-full p-3 border rounded-lg tracking-[0.4em] text-center"
          placeholder="000000"
        />

        {message && <p className="text-sm text-green-700 mt-3" role="status">{message}</p>}
        {error && <p className="text-sm text-red-600 mt-3" role="alert">{error}</p>}

        <button
          type="button"
          onClick={() => void verify()}
          disabled={working || code.length !== 6}
          className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold mt-4 disabled:opacity-60"
        >
          {working ? 'Verifying…' : 'Verify and continue'}
        </button>
      </section>
    </main>
  )
}
