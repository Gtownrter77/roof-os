const BUILD_FALLBACK_URL = 'https://placeholder.supabase.co'
const BUILD_FALLBACK_KEY = 'preview-build-placeholder-key'

export function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()

  if (!url || !anonKey) {
    // Next.js evaluates client components during server rendering.
    // Preview builds may inject empty public vars; placeholders let builds complete.
    // Production deployments must provide real public Supabase settings.
    // Emit once on the server so missing vars don't silently route to the placeholder host.
    if (typeof window === 'undefined' && !hasWarnedMissingSupabaseEnv) {
      const missing: string[] = []
      if (!url) missing.push('NEXT_PUBLIC_SUPABASE_URL')
      if (!anonKey) missing.push('NEXT_PUBLIC_SUPABASE_ANON_KEY')
      console.warn(
        `[supabase] Missing required environment variables: ${missing.join(', ')}. ` +
          `Using ${BUILD_FALLBACK_URL} (placeholder) for this process.`
      )
      hasWarnedMissingSupabaseEnv = true
    }
    return { url: url || BUILD_FALLBACK_URL, anonKey: anonKey || BUILD_FALLBACK_KEY }
  }

  return { url, anonKey }
}

let hasWarnedMissingSupabaseEnv = false
