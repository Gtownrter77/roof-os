'use client'

const ITEMS = [
  'Open a lead file. It is not a spreadsheet row.',
  'Start inspection from that file.',
  'Fill before / damage / completed albums.',
  'Draft report. Do not send.',
  'Draft estimate from your book. Do not send.',
  'Create the Roof Passport after the job is real.',
]

export default function TrainingPage() {
  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-24">
      <h1 className="text-2xl font-bold">Training</h1>
      <p className="text-sm text-gray-600 mb-4">For the first ten shops. You walk them once.</p>
      {ITEMS.map((item, index) => (
        <div key={item} className="bg-white rounded-lg shadow p-3 mb-2 text-sm">{index + 1}. {item}</div>
      ))}
    </div>
  )
}
