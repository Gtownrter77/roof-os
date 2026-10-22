import { createBrowserClient } from '@supabase/ssr'
import { getSupabaseEnv } from './env'

let browserClient: ReturnType<typeof createBrowserClient> | null = null

export function createClient() {
  if (typeof window === 'undefined') {
    const { url, anonKey } = getSupabaseEnv()
    return createBrowserClient(url, anonKey)
  }
  if (!browserClient) {
    const { url, anonKey } = getSupabaseEnv()
    browserClient = createBrowserClient(url, anonKey)
  }
  return browserClient
}
