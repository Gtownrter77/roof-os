'use client'

import { usePathname } from 'next/navigation'

const PROTOTYPE_PATHS = [
  '/quantum', '/genetic', '/vr', '/ar', '/pitch-gauge', '/voice-ai', '/ai-wizard', '/photo-verify',
  '/portal', '/schedule', '/drone', '/invoices', '/sign', '/integrations', '/admin', '/pricing', '/exterior',
  '/deck', '/siding', '/repair', '/doors-windows', '/manual', '/logistics', '/homedepot', '/insurance', '/insurance-intel',
]

export default function PrototypeNotice() {
  const pathname = usePathname()
  if (!pathname || !PROTOTYPE_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))) return null

  return (
    <div className="sticky top-0 z-50 border-b border-amber-300 bg-amber-50 px-4 py-2 text-center text-xs font-semibold text-amber-950" role="status">
      PILOT / PROTOTYPE — This screen may use simulated or non-authoritative results. Do not use it for customer quotes, insurance claims, measurements, contracts, or payment decisions.
    </div>
  )
}
