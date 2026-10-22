'use client'

import { usePathname } from 'next/navigation'

const PROTOTYPE_PATHS = [
  '/quantum', '/genetic', '/vr', '/ar', '/pitch-gauge', '/voice-ai', '/ai-wizard', '/photo-verify',
  '/portal', '/schedule', '/drone', '/invoices', '/sign', '/integrations', '/admin', '/pricing', '/exterior',
  '/deck', '/siding', '/repair', '/doors-windows', '/manual', '/logistics', '/homedepot', '/insurance', '/insurance-intel',
  '/chat', '/notifications', '/status',
  // Simulated or non-authoritative surfaces that must not be mistaken for production workflow
  '/ai', '/ai-train', '/codes', '/predict', '/ready', '/export',
]

export default function PrototypeNotice() {
  const pathname = usePathname()
  if (!pathname || !PROTOTYPE_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))) return null

  return (
    <div className="sticky top-0 z-50 border-b border-amber-400/40 bg-amber-400/15 px-4 py-2 text-center text-xs font-semibold text-amber-100" role="status">
      PILOT / PROTOTYPE — This screen may use simulated or non-authoritative results. Do not use it for customer quotes, insurance claims, measurements, contracts, or payment decisions.
    </div>
  )
}
