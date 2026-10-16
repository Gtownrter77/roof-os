'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Settings } from 'lucide-react'
import { APP_NAV_ITEMS, APP_SHELL_HIDDEN } from '../lib/nav'
import NextPage from './NextPage'

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '/'
  const hidden = APP_SHELL_HIDDEN.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
  if (hidden) return <>{children}</>

  return (
    <div className="ops-bg min-h-screen pb-24 text-slate-100 lg:pb-8">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#070b14]/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-4 py-3 md:px-6">
          <Link href="/" className="text-xl font-black tracking-tight text-white">
            ROOF<span className="text-red-500">/</span>OS
            <span className="ml-2 hidden text-xs font-medium tracking-[0.18em] text-slate-400 sm:inline">
              ROOFING OPERATIONS
            </span>
          </Link>
          <Link
            href="/settings"
            aria-label="Workspace settings"
            className="rounded-lg border border-white/10 p-2 text-slate-300 hover:bg-white/10"
          >
            <Settings className="h-4 w-4" />
          </Link>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1600px] gap-5 px-3 py-4 md:px-6 lg:grid-cols-[220px_minmax(0,1fr)] lg:py-6">
        <aside className="hidden lg:block">
          <nav
            aria-label="ROOF/OS features"
            className="sticky top-20 space-y-1 rounded-2xl border border-white/10 bg-slate-950/70 p-3"
          >
            {APP_NAV_ITEMS.map(({ href, label, icon: Icon, pilot }) => {
              const active = href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`)
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${
                    active ? 'bg-blue-600 font-bold text-white' : 'text-slate-300 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate">{label}</span>
                  {pilot && (
                    <span className="rounded bg-amber-400/15 px-1.5 py-0.5 text-[9px] font-bold uppercase text-amber-200">
                      Pilot
                    </span>
                  )}
                </Link>
              )
            })}
          </nav>
        </aside>
        <div className="min-w-0">
          <NextPage pathname={pathname} />
          {children}
        </div>
      </div>
    </div>
  )
}
