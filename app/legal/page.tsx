'use client'

export default function LegalPage() {
  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-24">
      <h1 className="text-2xl font-bold">Plain terms</h1>
      <div className="bg-white rounded-lg shadow p-4 text-sm space-y-3">
        <p>This is software for a roofing shop. It is not a lawyer, an adjuster, or a certified measurement company.</p>
        <p>Draft numbers stay inside the shop until a human sends them.</p>
        <p>Store prices are a reference. They are not a bid.</p>
        <p>Weather alerts are candidates. They are not proof a house was hit.</p>
        <p>You own your job files. You can export. We do not sell your customer list.</p>
        <p>A lawyer still has to read this before you take money from strangers.</p>
      </div>
    </div>
  )
}
