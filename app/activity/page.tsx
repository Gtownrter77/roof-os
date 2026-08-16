'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function ActivityPage() {
  const router = useRouter()
  const [activities, setActivities] = useState([
    { id: 1, user: 'John Doe', action: 'Created new lead', target: '123 Main St', time: 'Just now', icon: '➕' },
    { id: 2, user: 'Jane Smith', action: 'Completed inspection', target: '456 Oak Ave', time: '2 min ago', icon: '✅' },
    { id: 3, user: 'Bob Johnson', action: 'Approved report', target: '789 Pine Rd', time: '5 min ago', icon: '📄' },
  ])

  useEffect(() => {
    const interval = setInterval(() => {
      const users = ['John', 'Jane', 'Bob', 'Sarah']
      const actions = ['Created lead', 'Updated status', 'Added photo', 'Sent email']
      const icons = ['➕', '📝', '📷', '📧']
      
      const newActivity = {
        id: Date.now(),
        user: users[Math.floor(Math.random() * users.length)],
        action: actions[Math.floor(Math.random() * actions.length)],
        target: `Activity ${Math.floor(Math.random() * 100)}`,
        time: 'Just now',
        icon: icons[Math.floor(Math.random() * icons.length)]
      }
      setActivities(prev => [newActivity, ...prev.slice(0, 9)])
    }, 10000)
    
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-blue-600 text-white shadow-lg sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center">
          <button onClick={() => router.back()} className="text-white mr-3 text-xl">←</button>
          <h1 className="text-xl font-bold">📊 Activity Feed</h1>
        </div>
      </header>

      <main className="p-4">
        <div className="flex justify-between items-center mb-4">
          <p className="text-sm text-gray-500">{activities.length} recent activities</p>
          <span className="text-xs text-green-500">🟢 Live</span>
        </div>

        <div className="space-y-3">
          {activities.map((activity) => (
            <div key={activity.id} className="bg-white rounded-lg shadow p-4">
              <div className="flex items-start space-x-3">
                <span className="text-2xl">{activity.icon}</span>
                <div className="flex-1">
                  <p className="text-sm">
                    <span className="font-semibold">{activity.user}</span>
                    {' '}{activity.action}
                    {' '}
                    <span className="text-blue-600 font-medium">{activity.target}</span>
                  </p>
                  <p className="text-xs text-gray-400 mt-1">{activity.time}</p>
                </div>
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
        <button onClick={() => router.push('/activity')} className="flex flex-col items-center text-blue-600">
          <span className="text-xl">📊</span>
          <span className="text-xs">Activity</span>
        </button>
        <button onClick={() => router.push('/ai')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">🤖</span>
          <span className="text-xs">AI</span>
        </button>
        <button onClick={() => router.push('/notifications')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">🔔</span>
          <span className="text-xs">Alerts</span>
        </button>
        <button onClick={() => router.push('/settings')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">⚙️</span>
          <span className="text-xs">Settings</span>
        </button>
      </nav>
    </div>
  )
}
