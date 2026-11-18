import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { searchParallelAnonymous } from '../lib/research/parallel-anonymous.ts'

const file = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const client = file('lib/research/parallel-anonymous.ts')
const route = file('app/api/research/parallel/route.ts')
const page = file('app/research/page.tsx')
assert.match(client, /https:\/\/mcp\.parallel\.ai\/mcp\?tools=web_search/)
assert.doesNotMatch(client, /PARALLEL_API_KEY|Authorization|api\.parallel\.ai|web_research/)
assert.match(client, /PARALLEL_ANONYMOUS_RESEARCH_ENABLED/)
assert.match(route, /supabase\.auth\.getUser\(\)/)
assert.match(route, /readJson\(request\)/)
assert.match(page, /Do not enter customer names/)
assert.match(page, /href="\/weather"/)

const oldFetch = globalThis.fetch
const previous = process.env.PARALLEL_ANONYMOUS_RESEARCH_ENABLED
let calls = []
try {
  process.env.PARALLEL_ANONYMOUS_RESEARCH_ENABLED = 'true'
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options })
    const request = JSON.parse(options.body)
    if (request.method === 'initialize') return new Response(JSON.stringify({
      jsonrpc: '2.0', id: 1, result: { protocolVersion: '2025-03-26', capabilities: {}, serverInfo: { name: 'mock', version: '1' } },
    }), { status: 200, headers: { 'content-type': 'application/json', 'mcp-session-id': 'safe-session' } })
    if (request.method === 'notifications/initialized') return new Response(null, { status: 202 })
    assert.equal(request.method, 'tools/call')
    assert.equal(request.params.name, 'web_search')
    return new Response('event: message\ndata: ' + JSON.stringify({ jsonrpc: '2.0', id: 2, result: {
      content: [{ type: 'text', text: JSON.stringify({ results: [
        { title: 'Roofing instructions', url: 'https://example.com/roof', excerpts: ['Official installation guide'] },
        { title: 'Unsafe', url: 'javascript:alert(1)', excerpts: ['discard'] },
      ] }) }],
    } }) + '\n\n', { status: 200, headers: { 'content-type': 'text/event-stream' } })
  }
  const result = await searchParallelAnonymous('GAF installation instructions')
  assert.equal(result.paidCalls, 0)
  assert.equal(result.results.length, 1)
  assert.equal(result.results[0].url, 'https://example.com/roof')
  assert.deepEqual(calls.map((call) => JSON.parse(call.options.body).method), ['initialize', 'notifications/initialized', 'tools/call'])
  assert.ok(calls.every((call) => !Object.keys(call.options.headers).some((key) => /authorization|api-key/i.test(key))))
  assert.ok(calls.every((call) => call.url === 'https://mcp.parallel.ai/mcp?tools=web_search'))
  calls = []
  process.env.PARALLEL_ANONYMOUS_RESEARCH_ENABLED = 'false'
  await assert.rejects(searchParallelAnonymous('GAF installation instructions'), /disabled/)
  assert.equal(calls.length, 0)
} finally {
  globalThis.fetch = oldFetch
  if (previous === undefined) delete process.env.PARALLEL_ANONYMOUS_RESEARCH_ENABLED
  else process.env.PARALLEL_ANONYMOUS_RESEARCH_ENABLED = previous
}
console.log('Parallel anonymous no-charge contract tests PASS')
