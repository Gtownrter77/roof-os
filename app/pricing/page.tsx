'use client'

import { useRouter } from 'next/navigation'

export default function PricingPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-blue-700 text-white shadow-lg sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center">
          <button onClick={() => router.back()} className="mr-3 text-xl" aria-label="Back">←</button>
          <h1 className="text-xl font-bold">Pricing</h1>
        </div>
      </header>

      <main className="p-4 max-w-2xl mx-auto space-y-4">
        <section className="bg-white rounded-lg shadow p-5">
          <h2 className="text-lg font-semibold">Pricing sources</h2>
          <p className="text-sm text-gray-600 mt-2">
            No invented material, labor, tax, permit, overhead, profit, or retailer values are displayed here.
            ROOF/OS must use an approved owner price book or a sourced retailer reference before producing estimate amounts.
          </p>
        </section>

        <section className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <h3 className="font-semibold text-amber-900">Retailer reference pricing</h3>
          <p className="text-sm text-amber-900 mt-1">
            A live retailer feed is not verified on this screen. Do not treat this page as a live Home Depot, Lowe's,
            carrier, or Xactimate price source.
          </p>
        </section>

        <button onClick={() => router.push('/pricing-config')} className="w-full bg-blue-700 text-white py-3 rounded-lg font-semibold">
          Open Owner Price Book Configuration
        </button>

        <button onClick={() => router.push('/estimate')} className="w-full bg-white border border-slate-300 text-slate-800 py-3 rounded-lg font-semibold">
          Open Estimate Workflow
        </button>

        <section className="bg-white rounded-lg shadow p-4 text-sm text-gray-600">
          <strong>Release rule:</strong> an estimate must not silently fall back to hardcoded prices.
          Missing or unverified pricing stays unresolved until an authorized source is supplied and reviewed.
        </section>
      </main>
    </div>
  )
}
