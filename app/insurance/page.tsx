'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function InsurancePage() {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [selectedState, setSelectedState] = useState('All')
  const [callLog, setCallLog] = useState<any[]>([])

  const insuranceCompanies = [
    { 
      id: 1, 
      name: 'Allstate', 
      claims: '1-800-255-7828', 
      status: 'Available',
      states: ['All'],
      website: 'allstate.com',
      processingTime: '2-4 days'
    },
    { 
      id: 2, 
      name: 'State Farm', 
      claims: '1-800-732-5246', 
      status: 'Available',
      states: ['All'],
      website: 'statefarm.com',
      processingTime: '2-3 days'
    },
    { 
      id: 3, 
      name: 'Progressive', 
      claims: '1-800-274-4499', 
      status: 'Available',
      states: ['All'],
      website: 'progressive.com',
      processingTime: '3-5 days'
    },
    { 
      id: 4, 
      name: 'Liberty Mutual', 
      claims: '1-800-225-2467', 
      status: 'Available',
      states: ['All'],
      website: 'libertymutual.com',
      processingTime: '2-5 days'
    },
    { 
      id: 5, 
      name: 'Farmers', 
      claims: '1-800-435-7764', 
      status: 'Available',
      states: ['All'],
      website: 'farmers.com',
      processingTime: '3-7 days'
    },
    { 
      id: 6, 
      name: 'GEICO', 
      claims: '1-800-841-3000', 
      status: 'Available',
      states: ['All'],
      website: 'geico.com',
      processingTime: '2-3 days'
    },
    { 
      id: 7, 
      name: 'Travelers', 
      claims: '1-800-252-4633', 
      status: 'Available',
      states: ['All'],
      website: 'travelers.com',
      processingTime: '3-5 days'
    },
    { 
      id: 8, 
      name: 'Nationwide', 
      claims: '1-800-421-3535', 
      status: 'Available',
      states: ['All'],
      website: 'nationwide.com',
      processingTime: '2-4 days'
    },
    { 
      id: 9, 
      name: 'American Family', 
      claims: '1-800-692-6326', 
      status: 'Available',
      states: ['All'],
      website: 'amfam.com',
      processingTime: '3-5 days'
    },
    { 
      id: 10, 
      name: 'USAA', 
      claims: '1-800-531-8111', 
      status: 'Available',
      states: ['All'],
      website: 'usaa.com',
      processingTime: '1-3 days'
    },
    { 
      id: 11, 
      name: 'The Hartford', 
      claims: '1-800-243-5860', 
      status: 'Available',
      states: ['All'],
      website: 'thehartford.com',
      processingTime: '3-6 days'
    },
    { 
      id: 12, 
      name: 'Chubb', 
      claims: '1-800-252-4678', 
      status: 'Available',
      states: ['All'],
      website: 'chubb.com',
      processingTime: '2-4 days'
    },
  ]

  const quickDial = (number: string, name: string) => {
    const now = new Date().toLocaleTimeString()
    setCallLog([{ name, number, time: now }, ...callLog])
    
    // Open phone dialer
    if (confirm(`Call ${name} at ${number}?`)) {
      window.location.href = `tel:${number}`
    }
  }

  const filteredCompanies = insuranceCompanies.filter(company => 
    company.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-gradient-to-r from-green-600 to-teal-600 text-white shadow-lg sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center">
          <button onClick={() => router.back()} className="text-white mr-3 text-xl">←</button>
          <h1 className="text-xl font-bold">📞 Insurance Claims</h1>
          <span className="ml-2 bg-green-500 text-white text-xs px-2 py-0.5 rounded-full animate-pulse">24/7</span>
        </div>
      </header>

      <main className="p-4">
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
          <p className="text-sm text-green-800 flex items-center">
            <span className="text-xl mr-2">📋</span>
            Quick dial insurance claims departments
          </p>
        </div>

        {/* Search */}
        <div className="mb-4">
          <input
            type="text"
            placeholder="Search insurance companies..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-green-500"
          />
        </div>

        {/* Insurance List */}
        <div className="space-y-3">
          {filteredCompanies.map((company) => (
            <div key={company.id} className="bg-white rounded-lg shadow-lg p-4 border-l-4 border-green-500">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold text-sm">{company.name}</h3>
                  <p className="text-xs text-gray-500">Claims: {company.claims}</p>
                  <div className="flex gap-2 mt-1">
                    <span className="bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded">✓ Available</span>
                    <span className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded">{company.processingTime}</span>
                  </div>
                </div>
                <button
                  onClick={() => quickDial(company.claims, company.name)}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center"
                >
                  📞 Call
                </button>
              </div>
              <div className="mt-2 flex gap-2">
                <button className="text-xs text-blue-600">📋 File Claim</button>
                <button className="text-xs text-blue-600">📊 Status</button>
                <button className="text-xs text-blue-600">📄 Documents</button>
              </div>
            </div>
          ))}
        </div>

        {/* Quick Dial Grid */}
        <div className="mt-4 bg-white rounded-lg shadow-lg p-4">
          <h3 className="font-semibold text-sm mb-3">⚡ Quick Dial</h3>
          <div className="grid grid-cols-3 gap-2">
            {insuranceCompanies.slice(0, 6).map((company) => (
              <button
                key={company.id}
                onClick={() => quickDial(company.claims, company.name)}
                className="bg-green-50 hover:bg-green-100 p-3 rounded-lg text-center"
              >
                <span className="text-xl block">{company.id <= 3 ? '🏢' : '📞'}</span>
                <span className="text-xs font-medium truncate">{company.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Call Log */}
        {callLog.length > 0 && (
          <div className="mt-4 bg-white rounded-lg shadow-lg p-4">
            <h3 className="font-semibold text-sm mb-3">📜 Recent Calls</h3>
            {callLog.map((call, i) => (
              <div key={i} className="flex justify-between items-center border-b py-2">
                <div>
                  <p className="text-sm font-medium">{call.name}</p>
                  <p className="text-xs text-gray-400">{call.number}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-400">{call.time}</p>
                  <span className="text-xs text-green-600">✓ Connected</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t flex justify-around py-2 px-4">
        <button onClick={() => router.push('/')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">🏠</span>
          <span className="text-xs">Home</span>
        </button>
        <button onClick={() => router.push('/insurance')} className="flex flex-col items-center text-green-600">
          <span className="text-xl">📞</span>
          <span className="text-xs">Insurance</span>
        </button>
        <button onClick={() => router.push('/templates')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">📄</span>
          <span className="text-xs">Templates</span>
        </button>
        <button onClick={() => router.push('/sketch')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">✏️</span>
          <span className="text-xs">Sketch</span>
        </button>
        <button onClick={() => router.push('/settings')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">⚙️</span>
          <span className="text-xs">Settings</span>
        </button>
      </nav>
    </div>
  )
}
