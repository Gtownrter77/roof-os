'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function NotificationsPage() {
  const router = useRouter()
  const [notifications, setNotifications] = useState([
    { id: 1, title: '⚠️ SLA Breach', message: 'Lead John Doe - No response in 4 hours', time: '2 min ago', type: 'danger', read: false },
    { id: 2, title: '📷 New Photos Added', message: 'Inspection 123 Main St - 3 new photos', time: '15 min ago', type: 'info', read: false },
    { id: 3, title: '✅ Report Approved', message: 'Report for 456 Oak Ave approved', time: '1 hour ago', type: 'success', read: false },
    { id: 4, title: '🌩️ Weather Alert', message: 'Severe Thunderstorm Warning active', time: '2 hours ago', type: 'warning', read: true },
    { id: 5, title: '📞 New Lead', message: 'Sarah Wilson called - Interest in roof inspection', time: '3 hours ago', type: 'info', read: true },
    { id: 6, title: '🔍 Inspection Completed', message: '789 Pine Rd inspection completed', time: '5 hours ago', type: 'success', read: true },
  ])

  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    setUnreadCount(notifications.filter(n => !n.read).length)
  }, [notifications])

  const markAsRead = (id: number) => {
    setNotifications(notifications.map(n => 
      n.id === id ? { ...n, read: true } : n
    ))
  }

  const markAllAsRead = () => {
    setNotifications(notifications.map(n => ({ ...n, read: true })))
  }

  const deleteNotification = (id: number) => {
    setNotifications(notifications.filter(n => n.id !== id))
  }

  const getBadgeColor = (type: string) => {
    const colors: Record<string, string> = {
      'danger': 'bg-red-100 text-red-800',
      'warning': 'bg-yellow-100 text-yellow-800',
      'success': 'bg-green-100 text-green-800',
      'info': 'bg-blue-100 text-blue-800',
    }
    return colors[type] || 'bg-gray-100 text-gray-800'
  }

  const getIcon = (type: string) => {
    const icons: Record<string, string> = {
      'danger': '🔴',
      'warning': '🟡',
      'success': '✅',
      'info': '🔵',
    }
    return icons[type] || '📌'
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-blue-600 text-white shadow-lg sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center">
          <button onClick={() => router.back()} className="text-white mr-3 text-xl">←</button>
          <h1 className="text-xl font-bold">🔔 Notifications</h1>
          {unreadCount > 0 && (
            <span className="ml-2 bg-red-500 text-white text-xs px-2 py-0.5 rounded-full animate-pulse">
              {unreadCount}
            </span>
          )}
        </div>
      </header>

      <main className="p-4">
        <div className="flex justify-between items-center mb-4">
          <p className="text-sm text-gray-500">
            {unreadCount} unread • {notifications.length} total
          </p>
          {unreadCount > 0 && (
            <button 
              onClick={markAllAsRead}
              className="text-blue-600 text-sm font-medium"
            >
              Mark all read
            </button>
          )}
        </div>

        {notifications.map((notif) => (
          <div 
            key={notif.id} 
            className={`bg-white rounded-lg shadow p-4 mb-3 border-l-4 ${
              notif.read ? 'border-gray-300' : 'border-blue-500'
            } transition-all duration-300`}
          >
            <div className="flex items-start space-x-3">
              <span className="text-2xl">{getIcon(notif.type)}</span>
              <div className="flex-1">
                <div className="flex justify-between items-start">
                  <p className={`font-semibold text-sm ${notif.read ? 'text-gray-500' : ''}`}>
                    {notif.title}
                  </p>
                  <span className={`text-xs px-2 py-0.5 rounded ${getBadgeColor(notif.type)}`}>
                    {notif.type}
                  </span>
                </div>
                <p className={`text-sm mt-1 ${notif.read ? 'text-gray-400' : 'text-gray-600'}`}>
                  {notif.message}
                </p>
                <div className="flex justify-between items-center mt-2">
                  <p className="text-xs text-gray-400">{notif.time}</p>
                  <div className="flex space-x-2">
                    {!notif.read && (
                      <button 
                        onClick={() => markAsRead(notif.id)}
                        className="text-xs text-blue-600"
                      >
                        Mark read
                      </button>
                    )}
                    <button 
                      onClick={() => deleteNotification(notif.id)}
                      className="text-xs text-red-600"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t flex justify-around py-2 px-4">
        <button onClick={() => router.push('/')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">🏠</span>
          <span className="text-xs">Home</span>
        </button>
        <button onClick={() => router.push('/leads')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">👤</span>
          <span className="text-xs">Leads</span>
        </button>
        <button onClick={() => router.push('/ai')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">🤖</span>
          <span className="text-xs">AI</span>
        </button>
        <button onClick={() => router.push('/notifications')} className="flex flex-col items-center text-blue-600">
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
