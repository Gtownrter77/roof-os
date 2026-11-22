/**
 * True only for an HTTPS signed URL on this project's Supabase origin under an
 * approved object-storage path with a token. Pure: no env reads, no I/O.
 */
export function isApprovedStorageUrl(
  value: unknown,
  supabaseUrl: string,
  pathPrefix = '/storage/v1/object/sign/',
): value is string {
  if (typeof value !== 'string' || !value || !supabaseUrl) return false
  try {
    const source = new URL(value)
    const expected = new URL(supabaseUrl)
    return source.protocol === 'https:'
      && source.origin === expected.origin
      && source.pathname.startsWith(pathPrefix)
      && source.searchParams.has('token')
  } catch {
    return false
  }
}
