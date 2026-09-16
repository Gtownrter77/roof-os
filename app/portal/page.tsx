'use client'

export default function PortalPage() {
  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-24">
      <h1 className="text-2xl font-bold">Homeowner view</h1>
      <p className="text-sm text-gray-600 mb-4">Read-only preview. They will see what you approved. Not drafts. Not your rates.</p>
      <div className="bg-white rounded-lg shadow p-4 text-sm space-y-2">
        <p>Photos you marked completed.</p>
        <p>Passport system and color after you publish.</p>
        <p>Warranty status after you register.</p>
        <p className="text-amber-800">This page is a shell. No public link is live.</p>
      </div>
    </div>
  )
}
