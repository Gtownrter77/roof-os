'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type NotificationItem = {
  id: number
  title: string
  message: string
  time: string
  type: 'danger' | 'warning' | 'success' | 'info'
  read: boolean
}

export default function NotificationsPage() {
  const router = useRouter()
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const unreadCount = notifications.filter((notification) => !notification.read).length

  const markAsRead = (id: number) => {
    setNotifications((current) => current.map((notification) =>
      notification.id === id ? { ...notification, read: true } : notification
    ))
  }

  const markAllAsRead = () => {
    setNotifications((current) => current.map((notification) => ({ ...notification, read: true })))
  }

  const deleteNotification = (id: number) => {
    setNotifications((current) => current.filter((notification) => notification.id !== id))
  }

  const getBadgeColor = (type: NotificationItem['type']) => {
    const colors: Record<NotificationItem['type'], string> = {
      danger: 'bg-red-100 text-red-800',
      warning: 'bg-yellow-100 text-yellow-800',
      success: 'bg-green-100 text-green-800',
      info: 'bg-blue-100 text-blue-800',
    }
    return colors[type]
  }

  const getIcon = (type: NotificationItem['type']) => {
    const icons: Record<NotificationItem['type'], string> = {
      danger: '🔴',
      warning: '🟡',
      success: '✅',
      info: '🔵',
    }
    return icons[type]
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-blue-600 text-white shadow-lg sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center">
          <button onClick={() => router.back()} className="text-white mr-3 text-xl">←</button>
          <h1 className="text-xl font-bold">Notifications</h1>
          {unreadCount > 0 && (
            <span className="ml-2 bg-red-500 text-white text-xs px-2 py-0.5 rounded-full animate-pulse">
              {unreadCount}
            </span>
          )}
        </div>
      </header>

      <main className="p-4">
        <p className="text-sm bg-white rounded-lg shadow p-4 mb-4">
          This screen is not connected to a persisted notification inbox. Sample alerts were removed so they cannot be mistaken for real events.
        </p>
        <div className="flex justify-between items-center mb-4">
          <p className="text-sm text-gray-500">{unreadCount} unread · {notifications.length} total</p>
          {unreadCount > 0 && (
            <button onClick={markAllAsRead} className="text-blue-600 text-sm font-medium">
              Mark all read
            </button>
          )}
        </div>

        {notifications.length === 0 ? (
          <section className="bg-white rounded-lg shadow p-5 text-sm text-gray-600">
            No saved notifications. Live notifications are not implemented on this screen yet.
          </section>
        ) : notifications.map((notification) => (
          <div
            key={notification.id}
            className={`bg-white rounded-lg shadow p-4 mb-3 border-l-4 ${notification.read ? 'border-gray-300' : 'border-blue-500'} transition-all duration-300`}
          >
            <div className="flex items-start space-x-3">
              <span className="text-2xl">{getIcon(notification.type)}</span>
              <div className="flex-1">
                <div className="flex justify-between items-start">
                  <p className={`font-semibold text-sm ${notification.read ? 'text-gray-500' : ''}`}>{notification.title}</p>
                  <span className={`text-xs px-2 py-0.5 rounded ${getBadgeColor(notification.type)}`}>{notification.type}</span>
                </div>
                <p className={`text-sm mt-1 ${notification.read ? 'text-gray-400' : 'text-gray-600'}`}>{notification.message}</p>
                <div className="flex justify-between items-center mt-2">
                  <p className="text-xs text-gray-400">{notification.time}</p>
                  <div className="flex space-x-2">
                    {!notification.read && (
                      <button onClick={() => markAsRead(notification.id)} className="text-xs text-blue-600">Mark read</button>
                    )}
                    <button onClick={() => deleteNotification(notification.id)} className="text-xs text-red-600">Delete</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t flex justify-around py-2 px-4">
        <button onClick={() => router.push('/')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">🏠</span><span className="text-xs">Home</span>
        </button>
        <button onClick={() => router.push('/leads')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">👤</span><span className="text-xs">Leads</span>
        </button>
        <button onClick={() => router.push('/ai')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">🤖</span><span className="text-xs">AI</span>
        </button>
        <button onClick={() => router.push('/notifications')} className="flex flex-col items-center text-blue-600">
          <span className="text-xl">🔔</span><span className="text-xs">Alerts</span>
        </button>
        <button onClick={() => router.push('/settings')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">⚙️</span><span className="text-xs">Settings</span>
        </button>
      </nav>
    </div>
  )
}
