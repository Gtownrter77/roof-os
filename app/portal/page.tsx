'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function PortalPage() {
  const router = useRouter()
  const [customers] = useState([
    { id: 1, name: 'John Doe', phone: '(555) 123-4567', email: 'john@example.com', status: 'Active', jobs: 2 },
    { id: 2, name: 'Jane Smith', phone: '(555) 234-5678', email: 'jane@example.com', status: 'Active', jobs: 1 },
    { id: 3, name: 'Bob Johnson', phone: '(555) 345-6789', email: 'bob@example.com', status: 'Inactive', jobs: 0 },
    { id: 4, name: 'Sarah Wilson', phone: '(555) 456-7890', email: 'sarah@example.com', status: 'Active', jobs: 3 },
  ])

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-blue-600 text-white shadow-lg sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center">
          <button onClick={() => router.back()} className="text-white mr-3 text-xl">←</button>
          <h1 className="text-xl font-bold">👥 Customer Portal</h1>
        </div>
      </header>

      <main className="p-4">
        <div className="flex justify-between items-center mb-4">
          <p className="text-sm text-gray-500">{customers.length} total customers</p>
          <button className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm">
            + Add Customer
          </button>
        </div>

        <div className="space-y-3">
          {customers.map((customer) => (
            <div key={customer.id} className="bg-white rounded-lg shadow p-4">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-semibold">{customer.name}</p>
                  <p className="text-sm text-gray-500">{customer.email}</p>
                  <p className="text-sm text-gray-500">{customer.phone}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded ${
                  customer.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                }`}>
                  {customer.status}
                </span>
              </div>
              <div className="flex justify-between items-center mt-3">
                <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded">
                  {customer.jobs} jobs
                </span>
                <div className="flex space-x-2">
                  <button className="text-blue-600 text-xs font-medium">View</button>
                  <button className="text-green-600 text-xs font-medium">Message</button>
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
        <button onClick={() => router.push('/portal')} className="flex flex-col items-center text-blue-600">
          <span className="text-xl">👥</span>
          <span className="text-xs">Customers</span>
        </button>
        <button onClick={() => router.push('/ai')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">🤖</span>
          <span className="text-xs">AI</span>
        </button>
        <button onClick={() => router.push('/voice')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">🎤</span>
          <span className="text-xs">Voice</span>
        </button>
        <button onClick={() => router.push('/settings')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">⚙️</span>
          <span className="text-xs">Settings</span>
        </button>
      </nav>
    </div>
  )
}
