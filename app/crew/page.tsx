'use client'

const ROWS = [
  { en: 'Start inspection', es: 'Empezar inspección' },
  { en: 'Take photo', es: 'Tomar foto' },
  { en: 'Job directions', es: 'Cómo llegar' },
  { en: 'Check in', es: 'Registrar entrada' },
  { en: 'Check out', es: 'Registrar salida' },
  { en: 'Need help', es: 'Necesito ayuda' },
]

export default function CrewPage() {
  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-24">
      <h1 className="text-2xl font-bold">Crew mode</h1>
      <p className="text-sm text-gray-600 mb-4">Labels only in this slice. Check-in GPS comes later.</p>
      {ROWS.map((row) => (
        <div key={row.en} className="bg-white rounded-lg shadow p-3 mb-2">
          <p className="font-medium text-sm">{row.en}</p>
          <p className="text-sm text-gray-500">{row.es}</p>
        </div>
      ))}
    </div>
  )
}
