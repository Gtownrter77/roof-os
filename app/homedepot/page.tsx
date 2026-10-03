'use client'

import { useRouter } from 'next/navigation'

export default function HomeDepotPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-gradient-to-r from-orange-600 to-orange-500 text-white shadow-lg sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center">
          <button onClick={() => router.back()} className="text-white mr-3 text-xl">←</button>
          <h1 className="text-xl font-bold">🏪 Home Depot Integration</h1>
          <span className="ml-2 bg-yellow-400 text-black text-xs px-2 py-0.5 rounded-full">NOT CONNECTED</span>
        </div>
      </header>

      <main className="p-4">
        <div className="bg-white rounded-lg shadow-lg p-5 mb-4 border border-orange-200">
          <p className="text-sm font-semibold text-gray-900">Live Home Depot catalog access is not configured.</p>
          <p className="text-sm text-gray-600 mt-2">
            ROOF/OS will not display invented products, prices, inventory, SKUs, carts, or completed orders.
            A future retailer integration must source those values from an authorized provider and persist the source,
            market, retrieval time, and approval state.
          </p>
        </div>

        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <h2 className="font-semibold text-sm text-orange-900">Unavailable until integration exists</h2>
          <ul className="mt-2 space-y-1 text-sm text-orange-900">
            <li>• Live product search</li>
            <li>• Current retailer pricing</li>
            <li>• Inventory availability</li>
            <li>• Cart and checkout</li>
            <li>• Order placement and confirmation</li>
          </ul>
        </div>

        <button
          onClick={() => router.push('/pricing')}
          className="w-full mt-4 bg-orange-600 text-white p-3 rounded-lg font-semibold"
        >
          📊 Open Pricing Workflow
        </button>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t flex justify-around py-2 px-4">
        <button onClick={() => router.push('/')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">🏠</span>
          <span className="text-xs">Home</span>
        </button>
        <button onClick={() => router.push('/homedepot')} className="flex flex-col items-center text-orange-600">
          <span className="text-xl">🏪</span>
          <span className="text-xs">HD</span>
        </button>
        <button onClick={() => router.push('/templates')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">📄</span>
          <span className="text-xs">Templates</span>
        </button>
        <button onClick={() => router.push('/upsell')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">💰</span>
          <span className="text-xs">Upsell</span>
        </button>
        <button onClick={() => router.push('/settings')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">⚙️</span>
          <span className="text-xs">Settings</span>
        </button>
      </nav>
    </div>
  )
}
