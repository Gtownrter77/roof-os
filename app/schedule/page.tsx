'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function SchedulePage() {
  const router = useRouter()
  const [schedules] = useState([
    { id: 1, name: 'Daily Report', frequency: 'Daily', time: '9:00 AM', status: 'Active', lastRun: 'Today' },
    { id: 2, name: 'Weekly Analytics', frequency: 'Weekly', time: 'Monday 8:00 AM', status: 'Active', lastRun: 'Jan 13' },
    { id: 3, name: 'Monthly Summary', frequency: 'Monthly', time: '1st of month', status: 'Paused', lastRun: 'Dec 31' },
    { id: 4, name: 'Storm Alert', frequency: 'Real-time', time: 'Immediate', status: 'Active', lastRun: '2 min ago' },
  ])

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-blue-600 text-white shadow-lg sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center">
          <button onClick={() => router.back()} className="text-white mr-3 text-xl">←</button>
          <h1 className="text-xl font-bold">⏰ Scheduled Reports</h1>
        </div>
      </header>

      <main className="p-4">
        <div className="flex justify-between items-center mb-4">
          <p className="text-sm text-gray-500">{schedules.length} schedules</p>
          <button className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm">
            + New Schedule
          </button>
        </div>

        <div className="space-y-3">
          {schedules.map((schedule) => (
            <div key={schedule.id} className="bg-white rounded-lg shadow p-4">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-semibold text-sm">{schedule.name}</p>
                  <p className="text-xs text-gray-500">{schedule.frequency} • {schedule.time}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded ${
                  schedule.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {schedule.status}
                </span>
              </div>
              <div className="flex justify-between items-center mt-2">
                <p className="text-xs text-gray-400">Last run: {schedule.lastRun}</p>
                <button className="text-blue-600 text-xs font-medium">View →</button>
              </div>
            </div>
          ))}
        </div>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t flex justify-around py-2 px-4">
        <button onClick={() => router.push('/')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">🏠</span>
          <span className="text-xs">Home</span>
        </button>
        <button onClick={() => router.push('/schedule')} className="flex flex-col items-center text-blue-600">
          <span className="text-xl">⏰</span>
          <span className="text-xs">Schedule</span>
        </button>
        <button onClick={() => router.push('/invoices')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">📊</span>
          <span className="text-xs">Invoices</span>
        </button>
        <button onClick={() => router.push('/sign')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">✍️</span>
          <span className="text-xs">Sign</span>
        </button>
        <button onClick={() => router.push('/settings')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">⚙️</span>
          <span className="text-xs">Settings</span>
        </button>
      </nav>
    </div>
  )
}
