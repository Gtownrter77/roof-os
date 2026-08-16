'use client'

import { useRouter } from 'next/navigation'

export default function AnalyticsPage() {
  const router = useRouter()

  const metrics = [
    { label: 'Total Leads', value: '156', change: '+12%', color: 'text-blue-600' },
    { label: 'Conversion Rate', value: '34%', change: '+5%', color: 'text-green-600' },
    { label: 'Avg Response Time', value: '12m', change: '-3m', color: 'text-green-600' },
    { label: 'Revenue', value: '$48.2K', change: '+8%', color: 'text-blue-600' },
    { label: 'Inspection Completion', value: '89%', change: '+4%', color: 'text-green-600' },
    { label: 'SLA Compliance', value: '92%', change: '+2%', color: 'text-green-600' },
  ]

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-blue-600 text-white shadow-lg sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center">
          <button onClick={() => router.back()} className="text-white mr-3 text-xl">←</button>
          <h1 className="text-xl font-bold">📊 Analytics</h1>
        </div>
      </header>

      <main className="p-4">
        <div className="grid grid-cols-2 gap-3 mb-4">
          {metrics.map((metric, i) => (
            <div key={i} className="bg-white rounded-lg shadow p-4">
              <p className="text-xs text-gray-500">{metric.label}</p>
              <p className={`text-xl font-bold ${metric.color}`}>{metric.value}</p>
              <p className={`text-xs ${metric.change.startsWith('+') ? 'text-green-600' : 'text-red-600'}`}>
                {metric.change}
              </p>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="font-semibold text-sm mb-3">Performance Summary</h3>
          <div className="space-y-2">
            <div>
              <div className="flex justify-between text-xs">
                <span>Lead Response</span>
                <span>85%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-blue-600 h-2 rounded-full" style={{ width: '85%' }}></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs">
                <span>Inspection Quality</span>
                <span>78%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-green-600 h-2 rounded-full" style={{ width: '78%' }}></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs">
                <span>Report Accuracy</span>
                <span>92%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-purple-600 h-2 rounded-full" style={{ width: '92%' }}></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs">
                <span>Customer Satisfaction</span>
                <span>88%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-yellow-600 h-2 rounded-full" style={{ width: '88%' }}></div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t flex justify-around py-2 px-4">
        <button onClick={() => router.push('/')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">🏠</span>
          <span className="text-xs">Home</span>
        </button>
        <button onClick={() => router.push('/calendar')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">📅</span>
          <span className="text-xs">Calendar</span>
        </button>
        <button onClick={() => router.push('/analytics')} className="flex flex-col items-center text-blue-600">
          <span className="text-xl">📊</span>
          <span className="text-xs">Analytics</span>
        </button>
        <button onClick={() => router.push('/notifications')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">🔔</span>
          <span className="text-xs">Alerts</span>
        </button>
        <button onClick={() => router.push('/weather')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">🌤️</span>
          <span className="text-xs">Weather</span>
        </button>
      </nav>
    </div>
  )
}
