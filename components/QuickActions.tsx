'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function QuickActions() {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)

  const actions = [
    { icon: '📖', label: 'Manual', path: '/manual', color: 'bg-blue-600' },
    { icon: '💰', label: 'Pricing Config', path: '/pricing-config', color: 'bg-teal-600' },
    { icon: '📋', label: 'Insurance Intel', path: '/insurance-intel', color: 'bg-indigo-600' },
    { icon: '🚛', label: 'Logistics', path: '/logistics', color: 'bg-blue-700' },
    { icon: '🏪', label: 'Home Depot', path: '/homedepot', color: 'bg-orange-500' },
    { icon: '🎓', label: 'Training', path: '/ai-train', color: 'bg-green-500' },
    { icon: '📐', label: 'Pitch Gauge', path: '/pitch-gauge', color: 'bg-cyan-500' },
    { icon: '📸', label: 'Photo Verify', path: '/photo-verify', color: 'bg-purple-500' },
  ]

  return (
    <div>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-24 right-4 w-14 h-14 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-full shadow-lg flex items-center justify-center text-2xl z-50 hover:scale-110 transition"
      >
        {isOpen ? '✕' : '📖'}
      </button>

      {isOpen && (
        <div className="fixed bottom-40 right-4 space-y-2 z-50">
          {actions.map((action, i) => (
            <button
              key={i}
              onClick={() => {
                router.push(action.path)
                setIsOpen(false)
              }}
              className={`${action.color} text-white w-12 h-12 rounded-full shadow-lg flex items-center justify-center text-xl hover:scale-110 transition-transform`}
              title={action.label}
            >
              {action.icon}
            </button>
          ))}
        </div>
      )}

      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/20 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  )
}
