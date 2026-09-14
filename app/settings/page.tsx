'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function SettingsPage() {
  const router = useRouter()
  const [settings, setSettings] = useState({
    notifications: true,
    darkMode: false,
    autoRefresh: true,
    responseTime: 15,
    timezone: 'America/New_York',
    state: 'GA',
    companyName: '',
    phone: '',
  })
  const [saved, setSaved] = useState(false)

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-blue-600 text-white shadow-lg sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center">
          <button onClick={() => router.back()} className="text-white mr-3 text-xl">←</button>
          <h1 className="text-xl font-bold">⚙️ Settings</h1>
        </div>
      </header>

      <main className="p-4">
        <div className="space-y-4">
          {/* General Settings */}
          <div className="bg-white rounded-lg shadow p-4">
            <h2 className="font-semibold text-sm mb-3">General</h2>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm">Notifications</span>
                <button 
                  onClick={() => setSettings({...settings, notifications: !settings.notifications})}
                  className={`px-4 py-1 rounded text-sm ${settings.notifications ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'}`}
                >
                  {settings.notifications ? 'On' : 'Off'}
                </button>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Dark Mode</span>
                <button 
                  onClick={() => setSettings({...settings, darkMode: !settings.darkMode})}
                  className={`px-4 py-1 rounded text-sm ${settings.darkMode ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'}`}
                >
                  {settings.darkMode ? 'On' : 'Off'}
                </button>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Auto Refresh</span>
                <button 
                  onClick={() => setSettings({...settings, autoRefresh: !settings.autoRefresh})}
                  className={`px-4 py-1 rounded text-sm ${settings.autoRefresh ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'}`}
                >
                  {settings.autoRefresh ? 'On' : 'Off'}
                </button>
              </div>
            </div>
          </div>

          {/* SLA Settings */}
          <div className="bg-white rounded-lg shadow p-4">
            <h2 className="font-semibold text-sm mb-3">SLA Targets</h2>
            <div className="space-y-3">
              <div>
                <label className="text-sm">Response Time (minutes)</label>
                <input 
                  type="number" 
                  value={settings.responseTime}
                  onChange={(e) => setSettings({...settings, responseTime: parseInt(e.target.value)})}
                  className="w-full mt-1 p-2 border rounded-lg"
                />
              </div>
            </div>
          </div>

          {/* Location Settings */}
          <div className="bg-white rounded-lg shadow p-4">
            <h2 className="font-semibold text-sm mb-3">Location</h2>
            <div className="space-y-3">
              <div>
                <label className="text-sm">State</label>
                <select 
                  value={settings.state}
                  onChange={(e) => setSettings({...settings, state: e.target.value})}
                  className="w-full mt-1 p-2 border rounded-lg"
                >
                  <option value="GA">Georgia</option>
                  <option value="AL">Alabama</option>
                  <option value="SC">South Carolina</option>
                  <option value="NC">North Carolina</option>
                  <option value="FL">Florida</option>
                  <option value="TN">Tennessee</option>
                </select>
              </div>
              <div>
                <label className="text-sm">Time Zone</label>
                <select 
                  value={settings.timezone}
                  onChange={(e) => setSettings({...settings, timezone: e.target.value})}
                  className="w-full mt-1 p-2 border rounded-lg"
                >
                  <option value="America/New_York">Eastern</option>
                  <option value="America/Chicago">Central</option>
                  <option value="America/Denver">Mountain</option>
                  <option value="America/Los_Angeles">Pacific</option>
                </select>
              </div>
            </div>
          </div>

          {/* Company Settings */}
          <div className="bg-white rounded-lg shadow p-4">
            <h2 className="font-semibold text-sm mb-3">Company</h2>
            <div className="space-y-3">
              <div>
                <label className="text-sm">Company Name</label>
                <input type="text" value={settings.companyName} onChange={(e) => setSettings({...settings, companyName: e.target.value})} className="w-full mt-1 p-2 border rounded-lg" placeholder="Your Roofing Co." />
              </div>
              <div>
                <label className="text-sm">Phone</label>
                <input type="tel" value={settings.phone} onChange={(e) => setSettings({...settings, phone: e.target.value})} className="w-full mt-1 p-2 border rounded-lg" placeholder="(555) 123-4567" />
              </div>
            </div>
          </div>

          <button onClick={() => { setSaved(true); window.setTimeout(() => setSaved(false), 2500) }} className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold">
            {saved ? '✅ Settings saved' : '💾 Save Settings'}
          </button>
        </div>
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
        <button onClick={() => router.push('/export')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">📤</span>
          <span className="text-xs">Export</span>
        </button>
        <button onClick={() => router.push('/notifications')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">🔔</span>
          <span className="text-xs">Alerts</span>
        </button>
        <button onClick={() => router.push('/settings')} className="flex flex-col items-center text-blue-600">
          <span className="text-xl">⚙️</span>
          <span className="text-xs">Settings</span>
        </button>
      </nav>
    </div>
  )
}
