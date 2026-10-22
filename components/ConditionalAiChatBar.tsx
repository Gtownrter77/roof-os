'use client'

import { usePathname } from 'next/navigation'
import AiChatBar from './AiChatBar'

export default function ConditionalAiChatBar() {
  const pathname = usePathname()

  // Authentication screens should stay focused and unobstructed. Keep the
  // copilot available everywhere else in the operations app.
  if (pathname?.startsWith('/auth') || pathname?.startsWith('/radar')) return null

  return <AiChatBar />
}
