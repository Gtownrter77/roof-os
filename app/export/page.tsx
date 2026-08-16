'use client'

import { useRouter } from 'next/navigation'

export default function ExportPage() {
  const router = useRouter()

  const exportData = (type: string) => {
    const data = [
      ['Name', 'Address', 'Status', 'Date'],
      ['John Doe', '123 Main St', 'New', '2024-01-15'],
      ['Jane Smith', '456 Oak Ave', 'Assigned', '2024-01-14'],
      ['Bob Johnson', '789 Pine Rd', 'Qualified', '2024-01-13'],
    ]
    
    let csv = data.map(row => row.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `roof-os-${type}-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-blue-600 text-white shadow-lg sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center">
          <button onClick={() => router.back()} className="text-white mr-3 text-xl">←</button>
          <h1 className="text-xl font-bold">📤 Export / Import</h1>
        </div>
      </header>

      <main className="p-4">
        {/* Export Section */}
        <div className="bg-white rounded-lg shadow p-4 mb-4">
          <h2 className="font-semibold text-sm mb-3">📤 Export Data</h2>
          <div className="space-y-2">
            <button 
              onClick={() => exportData('leads')}
              className="w-full bg-blue-50 text-blue-600 py-2 rounded-lg text-sm flex items-center justify-center"
            >
              📊 Export Leads (CSV)
            </button>
            <button 
              onClick={() => exportData('inspections')}
              className="w-full bg-green-50 text-green-600 py-2 rounded-lg text-sm flex items-center justify-center"
            >
              🔍 Export Inspections (CSV)
            </button>
            <button 
              onClick={() => exportData('reports')}
              className="w-full bg-purple-50 text-purple-600 py-2 rounded-lg text-sm flex items-center justify-center"
            >
              📄 Export Reports (CSV)
            </button>
            <button 
              onClick={() => alert('📄 PDF Export: Would generate PDF report')}
              className="w-full bg-red-50 text-red-600 py-2 rounded-lg text-sm flex items-center justify-center"
            >
              📄 Export as PDF
            </button>
          </div>
        </div>

        {/* Import Section */}
        <div className="bg-white rounded-lg shadow p-4 mb-4">
          <h2 className="font-semibold text-sm mb-3">📥 Import Data</h2>
          <div className="space-y-2">
            <label className="w-full bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-4 text-center cursor-pointer">
              <span className="text-2xl block">📁</span>
              <span className="text-sm text-gray-500">Click to upload CSV file</span>
              <input type="file" accept=".csv" className="hidden" />
            </label>
            <p className="text-xs text-gray-400 text-center">Supports: .csv files</p>
          </div>
        </div>

        {/* Backup Section */}
        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="font-semibold text-sm mb-3">💾 Backup & Restore</h2>
          <div className="space-y-2">
            <button className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm">
              💾 Create Backup
            </button>
            <button className="w-full bg-gray-200 text-gray-700 py-2 rounded-lg text-sm">
              🔄 Restore from Backup
            </button>
          </div>
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
        <button onClick={() => router.push('/export')} className="flex flex-col items-center text-blue-600">
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
