'use client'

interface ChartProps {
  data: number[]
  labels: string[]
  title: string
}

export default function Chart({ data, labels, title }: ChartProps) {
  const safeData = data.map((value) => (Number.isFinite(value) ? Math.max(0, value) : 0))
  const max = Math.max(1, ...safeData)
  
  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h3 className="font-semibold text-sm mb-4">{title}</h3>
      {safeData.length === 0 ? (
        <div className="h-48 flex items-center justify-center text-sm text-gray-500">No chart data available.</div>
      ) : (
      <div className="flex items-end h-48 space-x-2">
        {safeData.map((value, index) => (
          <div key={index} className="flex-1 flex flex-col items-center">
            <div 
              className="w-full bg-blue-500 rounded-t transition-all duration-500 hover:bg-blue-600"
              style={{ height: `${Math.max(4, (value / max) * 100)}%` }}
              aria-label={`${labels[index] ?? 'Value ' + (index + 1)}: ${value}`}
            />
            <span className="text-xs text-gray-500 mt-1 truncate max-w-full">{labels[index] ?? 'Value ' + (index + 1)}</span>
          </div>
        ))}
      </div>
      )}
    </div>
  )
}
