const BUILD_FALLBACK_URL = 'https://placeholder.supabase.co'
const BUILD_FALLBACK_KEY = 'preview-build-placeholder-key'

export function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    // Client components are evaluated during Next.js prerendering. Preview
    // deployments should still build when preview-only env vars are absent;
    // runtime server requests must remain fail-closed instead of using these
    // placeholders.
    if (process.env.NEXT_PHASE === 'phase-production-build') {
      return { url: url ?? BUILD_FALLBACK_URL, anonKey: anonKey ?? BUILD_FALLBACK_KEY }
    }
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. Configure them before starting or serving ROOF/OS.',
    )
  }

  return { url, anonKey }
}
