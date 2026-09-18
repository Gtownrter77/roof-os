'use client'

export default function SharePage() {
  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-24">
      <h1 className="text-2xl font-bold">Share</h1>
      <p className="text-sm text-gray-600 mb-4">Time-limited signed URLs will live here. Public buckets will not.</p>
      <div className="bg-white rounded-lg shadow p-4 text-sm">Not issued yet. When they are, they expire and the shop can revoke them.</div>
    </div>
  )
}
