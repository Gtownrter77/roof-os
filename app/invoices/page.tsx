'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function InvoicesPage() {
  const router = useRouter()
  const [invoices] = useState([
    { id: 'INV-001', customer: 'John Doe', amount: '$1,250.00', status: 'Paid', date: '2024-01-15' },
    { id: 'INV-002', customer: 'Jane Smith', amount: '$850.00', status: 'Pending', date: '2024-01-14' },
    { id: 'INV-003', customer: 'Bob Johnson', amount: '$2,100.00', status: 'Overdue', date: '2024-01-10' },
    { id: 'INV-004', customer: 'Sarah Wilson', amount: '$1,500.00', status: 'Draft', date: '2024-01-16' },
  ])

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'Paid': 'bg-green-100 text-green-800',
      'Pending': 'bg-yellow-100 text-yellow-800',
      'Overdue': 'bg-red-100 text-red-800',
      'Draft': 'bg-gray-100 text-gray-800',
    }
    return colors[status] || 'bg-gray-100 text-gray-800'
  }

  const totalInvoiced = invoices.reduce((sum, inv) => {
    const amount = parseFloat(inv.amount.replace(/[$,]/g, ''))
    return sum + (inv.status === 'Paid' ? amount : 0)
  }, 0)

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-blue-600 text-white shadow-lg sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center">
          <button onClick={() => router.back()} className="text-white mr-3 text-xl">←</button>
          <h1 className="text-xl font-bold">📊 Invoices</h1>
        </div>
      </header>

      <main className="p-4">
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <p className="text-xs text-gray-500">Total Invoiced</p>
            <p className="text-xl font-bold text-blue-600">${totalInvoiced.toFixed(2)}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <p className="text-xs text-gray-500">Pending</p>
            <p className="text-xl font-bold text-yellow-600">
              {invoices.filter(i => i.status === 'Pending').length}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow">
          <div className="p-3 border-b flex justify-between items-center">
            <p className="text-sm font-medium">Recent Invoices</p>
            <button className="bg-blue-600 text-white text-xs px-3 py-1 rounded">
              + New
            </button>
          </div>
          {invoices.map((invoice) => (
            <div key={invoice.id} className="p-3 border-b last:border-0 flex justify-between items-center">
              <div>
                <p className="font-medium text-sm">{invoice.id}</p>
                <p className="text-xs text-gray-500">{invoice.customer}</p>
                <p className="text-xs text-gray-400">{invoice.date}</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-sm">{invoice.amount}</p>
                <span className={`text-xs px-2 py-0.5 rounded ${getStatusColor(invoice.status)}`}>
                  {invoice.status}
                </span>
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
        <button onClick={() => router.push('/invoices')} className="flex flex-col items-center text-blue-600">
          <span className="text-xl">📊</span>
          <span className="text-xs">Invoices</span>
        </button>
        <button onClick={() => router.push('/sign')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">✍️</span>
          <span className="text-xs">Sign</span>
        </button>
        <button onClick={() => router.push('/chat')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">💬</span>
          <span className="text-xs">Chat</span>
        </button>
        <button onClick={() => router.push('/settings')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">⚙️</span>
          <span className="text-xs">Settings</span>
        </button>
      </nav>
    </div>
  )
}
