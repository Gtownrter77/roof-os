'use client'

import { usePathname, useRouter } from 'next/navigation'

const NAV_ITEMS = [
  { icon: 'Home', path: '/' },
  { icon: 'Leads', path: '/leads' },
  { icon: 'Brief', path: '/brief' },
  { icon: 'Passport', path: '/warranty' },
  { icon: 'Camera', path: '/camera' },
  { icon: 'Measure', path: '/measure' },
]

const HIDDEN_ON = ['/auth/login', '/auth/signup', '/auth/enter', '/onboarding']

export default function Navigation() {
  const pathname = usePathname()
  const router = useRouter()
  if (HIDDEN_ON.some((p) => pathname?.startsWith(p))) return null
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 flex justify-around border-t border-white/10 bg-[#070b14]/95 px-1 py-2 backdrop-blur-xl lg:hidden">
      {NAV_ITEMS.map((item) => {
        const active = pathname === item.path || (item.path !== '/' && pathname?.startsWith(item.path))
        return (
          <button
            key={item.path}
            type="button"
            onClick={() => router.push(item.path)}
            className={`px-2 text-xs ${active ? 'font-semibold text-cyan-300' : 'text-slate-400'}`}
          >
            {item.icon}
          </button>
        )
      })}
    </nav>
  )
}
