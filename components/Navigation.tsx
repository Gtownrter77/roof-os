'use client'

import { usePathname, useRouter } from 'next/navigation'

const NAV_ITEMS = [
  { icon: 'Home', path: '/' },
  { icon: 'Leads', path: '/leads' },
  { icon: 'Brief', path: '/brief' },
  { icon: 'Passport', path: '/warranty' },
  { icon: 'Camera', path: '/camera' },
]

const HIDDEN_ON = ['/auth/login', '/auth/signup', '/onboarding']

export default function Navigation() {
  const pathname = usePathname()
  const router = useRouter()
  if (HIDDEN_ON.some((p) => pathname?.startsWith(p))) return null
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t flex justify-around py-2 px-1 z-40">
      {NAV_ITEMS.map((item) => {
        const active = pathname === item.path || (item.path !== '/' && pathname?.startsWith(item.path))
        return (
          <button key={item.path} onClick={() => router.push(item.path)} className={`text-xs px-2 ${active ? 'text-blue-600 font-semibold' : 'text-gray-500'}`}>
            {item.icon}
          </button>
        )
      })}
    </nav>
  )
}
