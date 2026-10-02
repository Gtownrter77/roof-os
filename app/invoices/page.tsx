'use client'

export default function InvoicesPage() {
  return (
    <main className="min-h-screen bg-gray-50 p-4">
      <h1 className="text-2xl font-bold mb-4">Invoices</h1>
      <section className="bg-white rounded-lg shadow p-6">
        <h2 className="font-semibold">No invoices loaded</h2>
        <p className="text-sm text-gray-600 mt-2">Live invoice data is not connected on this screen yet.</p>
      </section>
    </main>
  )
}
