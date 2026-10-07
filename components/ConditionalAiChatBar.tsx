'use client'

import { usePathname } from 'next/navigation'
import AiChatBar from './AiChatBar'

export default function ConditionalAiChatBar() {
  const pathname = usePathname()

  if (pathname === '/auth/login') return null

  return <AiChatBar />
}
