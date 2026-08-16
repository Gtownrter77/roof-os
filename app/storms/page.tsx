export default function StormsPage() {
  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <h1 className="text-2xl font-bold mb-4">🌩️ Storms</h1>
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
        <p className="font-semibold">⚠️ Severe Thunderstorm Warning</p>
        <p className="text-sm text-yellow-700">Active until 8:00 PM EST</p>
      </div>
      <div className="bg-white rounded-lg shadow p-4">
        <p className="font-semibold">Storm Score: 78</p>
        <p className="text-sm text-gray-500">Weather Relevance: 85</p>
      </div>
    </div>
  )
}
