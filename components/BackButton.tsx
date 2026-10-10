'use client'

import { useRouter } from 'next/navigation'
import { smartBack } from '../lib/smart-back'

type Props = {
  fallback?: string
  className?: string
  children?: React.ReactNode
  'aria-label'?: string
}

export default function BackButton({
  fallback = '/',
  className = 'mr-3 text-xl text-cyan-300',
  children = '←',
  'aria-label': ariaLabel = 'Go back',
}: Props) {
  const router = useRouter()
  return (
    <button
      type="button"
      onClick={() => smartBack(router, fallback)}
      className={className}
      aria-label={ariaLabel}
    >
      {children}
    </button>
  )
}
