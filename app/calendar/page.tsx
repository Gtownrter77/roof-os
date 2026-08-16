'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function CalendarPage() {
  const router = useRouter()
  const [selectedDate] = useState(new Date())
  const [appointments] = useState([
    { id: 1, title: 'Inspection - 123 Main St', time: '9:00 AM', type: 'inspection' },
    { id: 2, title: 'Lead Meeting - Jane Smith', time: '11:30 AM', type: 'meeting' },
    { id: 3, title: 'Inspection - 789 Pine Rd', time: '2:00 PM', type: 'inspection' },
    { id: 4, title: 'Report Review - Bob Johnson', time: '4:00 PM', type: 'review' },
  ])

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      'inspection': 'bg-blue-100 text-blue-800',
      'meeting': 'bg-green-100 text-green-800',
      'review': 'bg-purple-100 text-purple-800',
    }
    return colors[type] || 'bg-gray-100 text-gray-800'
  }

  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const currentMonth = selectedDate.toLocaleString('default', { month: 'long', year: 'numeric' })

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-blue-600 text-white shadow-lg sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center">
          <button onClick={() => router.back()} className="text-white mr-3 text-xl">←</button>
          <h1 className="text-xl font-bold">📅 Calendar</h1>
        </div>
      </header>

      <main className="p-4">
        {/* Month Header */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">{currentMonth}</h2>
          <div className="flex space-x-2">
            <button className="bg-white px-3 py-1 rounded shadow">←</button>
            <button className="bg-white px-3 py-1 rounded shadow">→</button>
          </div>
        </div>

        {/* Day Grid */}
        <div className="bg-white rounded-lg shadow p-4 mb-4">
          <div className="grid grid-cols-7 gap-1">
            {days.map((day) => (
              <div key={day} className="text-center text-xs font-semibold text-gray-500 py-1">
                {day}
              </div>
            ))}
            {Array(30).fill(0).map((_, i) => (
              <div key={i} className="text-center py-1 text-sm hover:bg-blue-50 rounded cursor-pointer">
                {i + 1}
              </div>
            ))}
          </div>
        </div>

        {/* Today's Appointments */}
        <h3 className="font-semibold text-sm text-gray-500 mb-3">Today's Schedule</h3>
        {appointments.map((apt) => (
          <div key={apt.id} className="bg-white rounded-lg shadow p-3 mb-2 flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center space-x-2">
                <span className="text-sm font-medium">{apt.title}</span>
                <span className={`text-xs px-2 py-0.5 rounded ${getTypeColor(apt.type)}`}>
                  {apt.type}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-1">{apt.time}</p>
            </div>
            <button className="bg-blue-600 text-white text-xs px-3 py-1 rounded">View</button>
          </div>
        ))}

        <button className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold mt-4">
          + Add Appointment
        </button>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t flex justify-around py-2 px-4">
        <button onClick={() => router.push('/')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">🏠</span>
          <span className="text-xs">Home</span>
        </button>
        <button onClick={() => router.push('/calendar')} className="flex flex-col items-center text-blue-600">
          <span className="text-xl">📅</span>
          <span className="text-xs">Calendar</span>
        </button>
        <button onClick={() => router.push('/inspections')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">🔍</span>
          <span className="text-xs">Inspect</span>
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
