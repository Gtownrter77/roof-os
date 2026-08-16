'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function ProfilePage() {
  const router = useRouter()
  const [profile, setProfile] = useState({
    name: 'Admin User',
    email: 'admin@roof-os.com',
    role: 'Owner',
    phone: '(555) 123-4567',
    company: 'ROOF/OS Demo',
    avatar: '👤'
  })

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-blue-600 text-white shadow-lg sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center">
          <button onClick={() => router.back()} className="text-white mr-3 text-xl">←</button>
          <h1 className="text-xl font-bold">👤 Profile</h1>
        </div>
      </header>

      <main className="p-4">
        {/* Avatar */}
        <div className="bg-white rounded-lg shadow p-6 text-center">
          <div className="text-6xl mb-2">{profile.avatar}</div>
          <h2 className="text-xl font-bold">{profile.name}</h2>
          <p className="text-sm text-gray-500">{profile.role}</p>
        </div>

        {/* Profile Info */}
        <div className="bg-white rounded-lg shadow p-4 mt-4">
          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-500">Full Name</label>
              <p className="text-sm font-medium">{profile.name}</p>
            </div>
            <div>
              <label className="text-xs text-gray-500">Email</label>
              <p className="text-sm font-medium">{profile.email}</p>
            </div>
            <div>
              <label className="text-xs text-gray-500">Phone</label>
              <p className="text-sm font-medium">{profile.phone}</p>
            </div>
            <div>
              <label className="text-xs text-gray-500">Company</label>
              <p className="text-sm font-medium">{profile.company}</p>
            </div>
            <div>
              <label className="text-xs text-gray-500">Role</label>
              <span className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
                {profile.role}
              </span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-2 mt-4">
          <button className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold">
            ✏️ Edit Profile
          </button>
          <button className="w-full bg-gray-200 text-gray-700 py-3 rounded-lg font-semibold">
            🔒 Change Password
          </button>
          <button className="w-full bg-red-50 text-red-600 py-3 rounded-lg font-semibold">
            🚪 Logout
          </button>
        </div>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t flex justify-around py-2 px-4">
        <button onClick={() => router.push('/')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">🏠</span>
          <span className="text-xs">Home</span>
        </button>
        <button onClick={() => router.push('/profile')} className="flex flex-col items-center text-blue-600">
          <span className="text-xl">👤</span>
          <span className="text-xs">Profile</span>
        </button>
        <button onClick={() => router.push('/export')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">📤</span>
          <span className="text-xs">Export</span>
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
