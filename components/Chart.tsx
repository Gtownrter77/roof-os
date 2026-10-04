'use client'

interface ChartProps {
  data: number[]
  labels: string[]
  title: string
}

export default function Chart({ data, labels, title }: ChartProps) {
  const safeData = data.map((value) => Number.isFinite(value) && value >= 0 ? value : 0)
  const max = Math.max(...safeData, 0)

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h3 className="font-semibold text-sm mb-4">{title}</h3>
      {safeData.length === 0 ? (
        <p className="text-sm text-gray-500">No chart data available.</p>
      ) : (
        <div className="flex items-end h-48 space-x-2">
          {safeData.map((value, index) => {
            const percentage = max > 0 ? (value / max) * 100 : 0
            const label = labels[index] ?? ''
            return (
              <div key={index} className="flex-1 flex min-w-0 flex-col items-center">
                <div
                  className="w-full bg-blue-500 rounded-t transition-all duration-500 hover:bg-blue-600"
                  style={{ height: percentage + '%', minHeight: value > 0 ? '4px' : '0' }}
                  aria-label={label ? label + ': ' + value : 'Value: ' + value}
                />
                <span className="text-xs text-gray-500 mt-1 truncate max-w-full">{label}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
