'use client'

import { usePathname, useRouter } from 'next/navigation'

const NAV_ITEMS = [
  { icon: '🏠', label: 'Home', path: '/' },
  { icon: '👤', label: 'Leads', path: '/leads' },
  { icon: '📅', label: 'Calendar', path: '/calendar' },
  { icon: '✅', label: 'Tasks', path: '/tasks' },
  { icon: '📷', label: 'Camera', path: '/camera' },
  { icon: '📄', label: 'Reports', path: '/reports' },
  { icon: '⚙️', label: 'Settings', path: '/settings' },
]

const HIDDEN_ON = ['/auth/login', '/auth/signup', '/onboarding']

export default function Navigation() {
  const pathname = usePathname()
  const router = useRouter()

  if (HIDDEN_ON.some((p) => pathname?.startsWith(p))) return null

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t flex justify-around py-2 px-1 z-40 overflow-x-auto">
      {NAV_ITEMS.map((item) => {
        const active = pathname === item.path
        return (
          <button
            key={item.path}
            onClick={() => router.push(item.path)}
            className={`flex flex-col items-center text-xs px-2 shrink-0 ${active ? 'text-blue-600 font-semibold' : 'text-gray-500'}`}
          >
            <span className="text-lg leading-none">{item.icon}</span>
            <span>{item.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
