'use client'

export default function ExportPage() {
  const exportCsv = () => {
    const blob = new Blob(['Name,Address,Status,Date\n'], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'roof-os-export.csv'
    link.click()
    URL.revokeObjectURL(url)
  }
  return (
    <main className="min-h-screen bg-gray-50 p-4">
      <h1 className="text-2xl font-bold mb-4">Export</h1>
      <section className="bg-white rounded-lg shadow p-6">
        <p className="text-sm text-gray-600">Live export is not connected. No fabricated records are included.</p>
        <button onClick={exportCsv} className="mt-4 bg-blue-600 text-white px-4 py-2 rounded">Export empty CSV</button>
      </section>
    </main>
  )
}
