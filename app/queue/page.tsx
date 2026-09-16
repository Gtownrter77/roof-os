'use client'

export default function QueuePage() {
  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-24">
      <h1 className="text-2xl font-bold">Offline queue</h1>
      <p className="text-sm text-gray-600 mb-4">Field phones die in valleys. The file cannot.</p>
      <div className="bg-white rounded-lg shadow p-4 text-sm space-y-2">
        <p>Save the photo on the phone first.</p>
        <p>Tag the inspection id.</p>
        <p>Upload when the bar comes back.</p>
        <p>Same photo twice must not create two rows. Idempotency key.</p>
        <p>Path: Expo SQLite or TinyBase. Not built tonight.</p>
      </div>
    </div>
  )
}
