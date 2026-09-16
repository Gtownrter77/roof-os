const BUILD_FALLBACK_URL = 'https://placeholder.supabase.co'
const BUILD_FALLBACK_KEY = 'preview-build-placeholder-key'

export function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()

  if (!url || !anonKey) {
    // Next.js evaluates client components during prerendering. Preview builds
    // may inject empty public variables; placeholders let the build complete.
    // Production deployments must provide the real public Supabase settings.
    return { url: url || BUILD_FALLBACK_URL, anonKey: anonKey || BUILD_FALLBACK_KEY }
  }

  return { url, anonKey }
}
