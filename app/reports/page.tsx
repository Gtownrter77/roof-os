export default function ReportsPage() {
  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <h1 className="text-2xl font-bold mb-4">📄 Reports</h1>
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
        <p className="text-sm text-yellow-800">⚠️ 5 reports pending review</p>
      </div>
      <div className="bg-white rounded-lg shadow p-4">
        <p className="font-semibold">123 Main St</p>
        <p className="text-sm text-gray-500">Status: Pending Review</p>
      </div>
    </div>
  )
}
