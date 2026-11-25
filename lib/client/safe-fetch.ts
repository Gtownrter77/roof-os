// One safe reader for every desktop fetch. A non-JSON error page must surface
// as a readable message, never as a raw "Unexpected token" in the UI.

export async function readApiJson<T>(response: {
  ok: boolean
  status: number
  json: () => Promise<unknown>
}): Promise<{ ok: true; data: T; error: null } | { ok: false; data: null; error: string }> {
  let payload: unknown = null
  try {
    payload = await response.json()
  } catch {
    payload = null
  }
  if (!response.ok) {
    const error = (payload as { error?: unknown } | null)?.error
    return {
      ok: false,
      data: null,
      error: typeof error === 'string' && error.trim()
        ? error
        : `Request failed (${response.status}).`,
    }
  }
  if (payload === null || typeof payload !== 'object') {
    return { ok: false, data: null, error: 'The server returned an unreadable response.' }
  }
  return { ok: true, data: payload as T, error: null }
}
