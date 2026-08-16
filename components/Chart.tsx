'use client'

import { useState } from 'react'

interface ChartProps {
  data: number[]
  labels: string[]
  title: string
}

export default function Chart({ data, labels, title }: ChartProps) {
  const max = Math.max(...data)
  
  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h3 className="font-semibold text-sm mb-4">{title}</h3>
      <div className="flex items-end h-48 space-x-2">
        {data.map((value, index) => (
          <div key={index} className="flex-1 flex flex-col items-center">
            <div 
              className="w-full bg-blue-500 rounded-t transition-all duration-500 hover:bg-blue-600"
              style={{ height: `${(value / max) * 100}%`, minHeight: '4px' }}
            />
            <span className="text-xs text-gray-500 mt-1">{labels[index]}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
