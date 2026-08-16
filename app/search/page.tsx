'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function SearchPage() {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<any[]>([])

  const data = [
    { id: 1, type: 'Lead', name: 'John Doe', detail: '123 Main St, Atlanta, GA', status: 'New' },
    { id: 2, type: 'Lead', name: 'Jane Smith', detail: '456 Oak Ave, Marietta, GA', status: 'Assigned' },
    { id: 3, type: 'Lead', name: 'Bob Johnson', detail: '789 Pine Rd, Decatur, GA', status: 'Qualified' },
    { id: 4, type: 'Inspection', name: '123 Main St', detail: 'In Progress - 3 photos', status: 'Active' },
    { id: 5, type: 'Inspection', name: '456 Oak Ave', detail: 'Completed - 5 photos', status: 'Done' },
    { id: 6, type: 'Report', name: '123 Main St Report', detail: 'Pending Review', status: 'Draft' },
    { id: 7, type: 'Report', name: '456 Oak Ave Report', detail: 'Approved', status: 'Final' },
  ]

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (query.length < 2) {
      setResults([])
      return
    }
    const filtered = data.filter(item => 
      item.name.toLowerCase().includes(query.toLowerCase()) ||
      item.detail.toLowerCase().includes(query.toLowerCase())
    )
    setResults(filtered)
  }

  const getTypeIcon = (type: string) => {
    const icons: Record<string, string> = {
      'Lead': '👤',
      'Inspection': '🔍',
      'Report': '📄'
    }
    return icons[type] || '📌'
  }

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      'Lead': 'bg-blue-100 text-blue-800',
      'Inspection': 'bg-green-100 text-green-800',
      'Report': 'bg-purple-100 text-purple-800'
    }
    return colors[type] || 'bg-gray-100 text-gray-800'
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-blue-600 text-white shadow-lg sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center">
          <button onClick={() => router.back()} className="text-white mr-3 text-xl">←</button>
          <h1 className="text-xl font-bold">🔍 Search</h1>
        </div>
      </header>

      <main className="p-4">
        <form onSubmit={handleSearch} className="mb-4">
          <div className="flex gap-2">
            <input 
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search leads, inspections, reports..."
              className="flex-1 p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
            <button type="submit" className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold">
              Search
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-1">{data.length} items indexed</p>
        </form>

        {query.length > 0 && results.length === 0 && (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <div className="text-4xl mb-2">🔍</div>
            <p className="text-gray-400">No results found for "{query}"</p>
          </div>
        )}

        <div className="space-y-2">
          {results.map((result) => (
            <div key={result.id} className="bg-white rounded-lg shadow p-4">
              <div className="flex items-start space-x-3">
                <span className="text-2xl">{getTypeIcon(result.type)}</span>
                <div className="flex-1">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold">{result.name}</p>
                      <p className="text-sm text-gray-500">{result.detail}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded ${getTypeColor(result.type)}`}>
                      {result.type}
                    </span>
                  </div>
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                      {result.status}
                    </span>
                    <button className="text-blue-600 text-xs font-medium">View →</button>
                  </div>
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
        <button onClick={() => router.push('/search')} className="flex flex-col items-center text-blue-600">
          <span className="text-xl">🔍</span>
          <span className="text-xs">Search</span>
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
