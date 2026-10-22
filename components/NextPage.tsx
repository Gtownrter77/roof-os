'use client'

import Link from 'next/link'

const BEATS = [
  { match: (path: string) => path === '/' || path.startsWith('/weather'), href: '/radar', line: 'Open the radar' },
  { match: (path: string) => path.startsWith('/inspections') || path.startsWith('/camera'), href: '/reports', line: 'Keep the proof' },
  { match: (path: string) => path.startsWith('/reports'), href: '/leads', line: 'Open the job' },
  { match: (path: string) => path.startsWith('/leads'), href: '/weather', line: 'Back to the sky' },
]

export default function NextPage({ pathname }: { pathname: string }) {
  const beat = BEATS.find((item) => item.match(pathname)) ?? { href: '/radar', line: 'Open the radar' }
  return (
    <Link href={beat.href} className="next-page">
      <span>Next</span>
      {beat.line}
    </Link>
  )
}
