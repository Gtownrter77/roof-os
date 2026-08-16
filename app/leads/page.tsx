export default function LeadsPage() {
  const leads = [
    { name: 'John Doe', address: '123 Main St', status: 'New' },
    { name: 'Jane Smith', address: '456 Oak Ave', status: 'Assigned' },
    { name: 'Bob Johnson', address: '789 Pine Rd', status: 'Qualified' },
  ]
  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <h1 className="text-2xl font-bold mb-4">👤 Leads</h1>
      {leads.map((lead, i) => (
        <div key={i} className="bg-white rounded-lg shadow p-4 mb-3">
          <p className="font-semibold">{lead.name}</p>
          <p className="text-sm text-gray-500">{lead.address}</p>
          <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">{lead.status}</span>
        </div>
      ))}
    </div>
  )
}
