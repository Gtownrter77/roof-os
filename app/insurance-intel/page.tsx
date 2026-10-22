'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { smartBack } from '../../lib/smart-back'

const UNKNOWN = 'Unknown. This screen does not state the law, a deadline, a fee, or a phone number.'

export default function InsuranceIntelPage() {
  const router = useRouter()
  const [address, setAddress] = useState('')
  const [checked, setChecked] = useState<{ address: string; state: string; zip: string } | null>(null)

  function checkAddress() {
    const zipMatch = address.match(/\b(\d{5})\b/)
    const stateMatch = address.match(/\b(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY)\b/)
    setChecked({
      address: address.trim() || 'No address entered',
      state: stateMatch?.[1] ?? 'Unknown',
      zip: zipMatch?.[1] ?? 'Unknown',
    })
  }

  return (
    <div className="space-y-4 pb-4">
      <header className="glass rounded-xl mb-4">
        <div className="px-4 py-3 flex items-center">
          <button type="button" onClick={() => smartBack(router)} className="mr-3 text-xl text-cyan-300" aria-label="Go back">←</button>
          <h1 className="text-xl font-bold">Insurance and permit notes</h1>
        </div>
      </header>
      <main className="p-4 space-y-4">
        <p className="text-sm glass rounded-xl p-4">
          Permit rules, appraisal deadlines, matching, fines, and department phone numbers stay Unknown until you read the statute or the building department. This page does not invent them.
        </p>
        <div className="glass rounded-xl p-4">
          <label className="block text-sm font-medium mb-2" htmlFor="intel-address">Property address</label>
          <div className="flex gap-2">
            <input
              id="intel-address"
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              onKeyDown={(event) => { if (event.key === 'Enter') checkAddress() }}
              placeholder="123 Main St, Atlanta, GA 30301"
              className="flex-1 rounded-lg border border-white/15 bg-black/30 p-2 text-sm"
            />
            <button type="button" onClick={checkAddress} className="rounded-lg bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950">
              Note it
            </button>
          </div>
        </div>
        {checked ? (
          <section className="glass rounded-xl p-4 space-y-2 text-sm">
            <p><span className="text-slate-400">Address. </span>{checked.address}</p>
            <p><span className="text-slate-400">State seen in the text. </span>{checked.state}</p>
            <p><span className="text-slate-400">ZIP seen in the text. </span>{checked.zip}</p>
            <p><span className="text-slate-400">Permit required. </span>Unknown</p>
            <p><span className="text-slate-400">Building department. </span>{UNKNOWN}</p>
            <p><span className="text-slate-400">Appraisal law. </span>{UNKNOWN}</p>
            <p><span className="text-slate-400">Matching. </span>{UNKNOWN}</p>
            <p><span className="text-slate-400">Case. </span>{UNKNOWN}</p>
          </section>
        ) : null}
      </main>
    </div>
  )
}
