// Bounded private-storage reader. Keep the AbortController alive until the
// response BODY has been completely read, not just until response headers arrive.
export async function fetchPrivatePhotoBytes(url: URL, maxBytes = 30 * 1024 * 1024, timeoutMs = 15_000): Promise<Uint8Array> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, { signal: controller.signal, cache: 'no-store', redirect: 'error' })
    if (!response.ok || !response.body) throw new Error('Original private photo unavailable')
    const declared = Number(response.headers.get('content-length'))
    if (declared > maxBytes) throw new Error('Original private photo exceeds size limit')
    const reader = response.body.getReader()
    const chunks: Uint8Array[] = []
    let size = 0
    try {
      while (true) {
        const part = await reader.read()
        if (part.done) break
        size += part.value.byteLength
        if (size > maxBytes) {
          await reader.cancel().catch(() => undefined)
          throw new Error('Original private photo exceeds size limit')
        }
        chunks.push(part.value)
      }
    } finally { reader.releaseLock() }
    const output = new Uint8Array(size)
    let at = 0
    for (const part of chunks) { output.set(part, at); at += part.byteLength }
    return output
  } finally { clearTimeout(timer) }
}
