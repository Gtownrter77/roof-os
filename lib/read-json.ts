export type JsonReadResult =
  | { body: Record<string, unknown> }
  | { error: string; status: 400 | 413 }

// Reused decoder singleton avoids repeated instantiation overhead
const textDecoder = new TextDecoder('utf-8', { fatal: true })

/** Read JSON with a hard byte ceiling, including requests without Content-Length. */
export async function readJson(request: Pick<Request, 'headers' | 'body'>, maxBytes = 64 * 1024): Promise<JsonReadResult> {
  const rawLength = request.headers.get('content-length')
  if (rawLength !== null) {
    if (!/^\d+$/.test(rawLength)) return { error: 'Invalid Content-Length header.', status: 400 }
    if (Number(rawLength) > maxBytes) return { error: 'Request body is too large.', status: 413 }
  }

  if (!request.body) return { error: 'Invalid JSON body.', status: 400 }

  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let totalBytes = 0

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      totalBytes += value.byteLength
      if (totalBytes > maxBytes) {
        await reader.cancel().catch(() => undefined)
        return { error: 'Request body is too large.', status: 413 }
      }
      chunks.push(value)
    }
  } catch {
    return { error: 'Could not read request body.', status: 400 }
  }

  // Fast-path: single chunk avoids buffer reallocation and memory copy overhead
  let bytes: Uint8Array
  if (chunks.length === 1) {
    bytes = chunks[0]
  } else {
    bytes = new Uint8Array(totalBytes)
    let offset = 0
    for (const chunk of chunks) {
      bytes.set(chunk, offset)
      offset += chunk.byteLength
    }
  }

  try {
    const parsed: unknown = JSON.parse(textDecoder.decode(bytes))
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { error: 'JSON body must be an object.', status: 400 }
    }
    return { body: parsed as Record<string, unknown> }
  } catch {
    return { error: 'Invalid JSON body.', status: 400 }
  }
}
