/**
 * Anonymous-only Parallel MCP transport. Never accepts a key or custom URL:
 * an authenticated Parallel session may incur charges.
 * This is an opt-in supplementary research source, not a replacement for NWS/OSM.
 */
const ENDPOINT = 'https://mcp.parallel.ai/mcp?tools=web_search'
const TIMEOUT_MS = 12000
type Rpc = { jsonrpc: '2.0'; id: number; method: string; params: Record<string, unknown> }
type RpcReply = { id?: number; result?: Record<string, unknown>; error?: { message?: string } }

function readRpc(text: string, id: number): RpcReply {
  // Streamable HTTP MCP may respond with JSON or SSE.
  let entries: unknown[] = []
  try { entries = [JSON.parse(text)] } catch {
    entries = text.split(/\r?\n\r?\n/).flatMap((chunk) => {
      const data = chunk.split(/\r?\n/).filter((line) => line.startsWith('data:')).map((line) => line.slice(5).trim()).join('\n')
      if (!data || data === '[DONE]') return []
      try { return [JSON.parse(data)] } catch { return [] }
    })
  }
  const matching = entries.find((item) => !!item && typeof item === 'object' && (item as RpcReply).id === id)
  if (!matching) throw new Error('Parallel MCP did not return a matching response.')
  return matching as RpcReply
}

async function rpc(request: Rpc, session?: string): Promise<{ reply: RpcReply; session?: string }> {
  const headers: Record<string, string> = {
    accept: 'application/json, text/event-stream',
    'content-type': 'application/json',
    'mcp-protocol-version': '2025-03-26',
  }
  if (session) headers['mcp-session-id'] = session
  const response = await fetch(ENDPOINT, {
    method: 'POST', headers, body: JSON.stringify(request),
    cache: 'no-store', signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  if (!response.ok) throw new Error(`Anonymous Parallel MCP unavailable (HTTP ${response.status}).`)
  const body = await response.text()
  if (body.length > 500_000) throw new Error('Parallel MCP response exceeds the safe size limit.')
  const reply = readRpc(body, request.id)
  if (reply.error) throw new Error(reply.error.message || 'Parallel MCP rejected the request.')
  return { reply, session: response.headers.get('mcp-session-id') || session }
}

export type ParallelResult = { title: string; url: string; excerpt: string }
export type ParallelSearchResponse = { results: ParallelResult[]; source: 'parallel-anonymous-mcp'; paidCalls: 0 }

export async function searchParallelAnonymous(input: string): Promise<ParallelSearchResponse> {
  if (process.env.PARALLEL_ANONYMOUS_RESEARCH_ENABLED !== 'true') {
    throw new Error('Free Parallel research is disabled. Existing research sources remain available.')
  }
  const query = input.trim().replace(/\s+/g, ' ')
  if (query.length < 4 || query.length > 180) throw new Error('Enter a research question of 4–180 characters.')
  // No customer records, private notes, or automatically attached addresses.
  const keywords = query.replace(/[^\p{L}\p{N}\s-]/gu, ' ').split(/\s+/).filter(Boolean).slice(0, 6).join(' ')
  if (!keywords) throw new Error('No searchable keywords provided.')
  const init = await rpc({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {
    protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'bailey-boss', version: '1.0.0' },
  } })
  // MCP initialized notification has no ID; don't turn its acknowledgement into a paid request.
  // Some stateless MCP servers accept tools/call without a notification.
  const result = await rpc({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: {
    name: 'web_search', arguments: {
      objective: `Find reliable, attributable web sources answering: ${query}`,
      search_queries: [keywords],
    },
  } }, init.session)
  const raw = result.reply.result
  if (!raw || raw.isError === true) throw new Error('Parallel MCP search could not complete.')
  const parts = Array.isArray(raw.content) ? raw.content : []
  let payload: Record<string, unknown> | undefined
  for (const part of parts) {
    if (!part || typeof part !== 'object' || !('text' in part) || typeof part.text !== 'string') continue
    try {
      const parsed: unknown = JSON.parse(part.text)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        payload = parsed as Record<string, unknown>
        if (Array.isArray(payload.results)) break
      }
    } catch { /* Keep looking for structured search results. */ }
  }
  // Some MCP transports return a structuredContent envelope.
  if (!payload && raw.structuredContent && typeof raw.structuredContent === 'object') {
    payload = raw.structuredContent as Record<string, unknown>
  }
  const items = Array.isArray(payload?.results) ? payload.results : []
  const results = items.flatMap((item): ParallelResult[] => {
    if (!item || typeof item !== 'object') return []
    const row = item as Record<string, unknown>
    if (typeof row.url !== 'string') return []
    let url: URL
    try { url = new URL(row.url) } catch { return [] }
    if (!['https:', 'http:'].includes(url.protocol)) return []
    const excerpts = Array.isArray(row.excerpts) ? row.excerpts.filter((v): v is string => typeof v === 'string') : []
    return [{ title: typeof row.title === 'string' ? row.title.slice(0, 200) : url.hostname,
      url: url.toString(), excerpt: excerpts.join(' ').slice(0, 1800) }]
  }).slice(0, 8)
  if (!results.length) throw new Error('Parallel returned no usable sourced results. Try existing research sources.')
  return { results, source: 'parallel-anonymous-mcp', paidCalls: 0 }
}
