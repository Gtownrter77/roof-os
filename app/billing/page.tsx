'use client'

export default function BillingPage() {
  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-24">
      <h1 className="text-2xl font-bold">Billing</h1>
      <p className="text-sm text-gray-600 mb-4">Stripe is the cashier. We never see the full card number.</p>
      <div className="bg-white rounded-lg shadow p-4 text-sm space-y-3">
        <p>1. Shop picks $349 / $599 / $999 a year on the offer page.</p>
        <p>2. We send them to Stripe Checkout. Stripe takes the card.</p>
        <p>3. Stripe tells us “paid” with a webhook. We flip their workspace to active.</p>
        <p>4. Next year Stripe tries the card again. If it fails, we pause. We do not keep charging in the dark.</p>
        <p>5. They cancel. Stripe stops. We keep their file downloadable for a grace window.</p>
      </div>
      <p className="text-xs text-amber-800 mt-4">Not wired. No Stripe secret is in this repo. Do not paste keys into GitHub.</p>
    </div>
  )
}
