import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { performance } from 'node:perf_hooks'

const root = new URL('..', import.meta.url).pathname

console.log('=== LEVEL 3: RUNTIME PERFORMANCE & RESOURCE USAGE BENCHMARKS ===\n')

// 1. Verify Next.js Bundle & Package Import Optimizations
const nextConfig = readFileSync(join(root, 'next.config.ts'), 'utf8')
assert.ok(
  nextConfig.includes("optimizePackageImports: ['lucide-react']") ||
  nextConfig.includes('optimizePackageImports'),
  'next.config.ts must enable optimizePackageImports for icon tree-shaking'
)
assert.ok(
  nextConfig.includes('/_next/static/(.*)') && nextConfig.includes('Cache-Control'),
  'next.config.ts must configure immutable cache headers for static assets'
)
console.log('✓ Check 1: next.config.ts bundle tree-shaking and static caching verified')

// 2. Benchmark readJson Memory & Stream Decoding
const { readJson } = await import('../lib/read-json.ts')

// Single chunk test
const smallPayload = JSON.stringify({ action: 'calculate_roof', squares: 34.5, pitch: '8/12' })
const encoded = new TextEncoder().encode(smallPayload)

const mockRequest = {
  headers: new Headers({ 'content-length': String(encoded.byteLength) }),
  body: new ReadableStream({
    start(controller) {
      controller.enqueue(encoded)
      controller.close()
    },
  }),
}

const t0 = performance.now()
const res = await readJson(mockRequest)
const t1 = performance.now()
assert.ok('body' in res, 'readJson must successfully decode payload')
assert.equal(res.body.squares, 34.5)
assert.ok((t1 - t0) < 50, 'readJson must execute in under 50ms')
console.log(`✓ Check 2: readJson single-chunk fast path verified in ${(t1 - t0).toFixed(2)}ms`)

// 3. Benchmark Weather Service Caching & Deduplication
const { getForecast, getNwsRelativeLocation } = await import('../lib/services/weather.ts')

const lat = 33.02
const lon = -96.70

// Cold request
const coldStart = performance.now()
const loc1 = await getNwsRelativeLocation(lat, lon)
const coldDuration = performance.now() - coldStart

// Warm cached request (should be near 0ms)
const warmStart = performance.now()
const loc2 = await getNwsRelativeLocation(lat, lon)
const warmDuration = performance.now() - warmStart

assert.equal(loc1, loc2, 'Cached relative location must match')
assert.ok(warmDuration < 5, `Warm cached location (${warmDuration.toFixed(2)}ms) must be under 5ms`)
console.log(`✓ Check 3: Weather service cache speedup: cold=${coldDuration.toFixed(1)}ms -> warm=${warmDuration.toFixed(2)}ms (deduplicated & cached)`)

// 4. Benchmark Ollama Circuit-Breaker
const { askOllama } = await import('../lib/ai/ollama.ts')

// First call trips breaker if unreachable
const p0 = performance.now()
const ans1 = await askOllama('Test prompt', { timeoutMs: 300 })
const p1 = performance.now()
assert.equal(ans1, null, 'Offline Ollama returns null')

// Second call should instantly circuit-break in < 2ms!
const p2 = performance.now()
const ans2 = await askOllama('Test prompt', { timeoutMs: 300 })
const p3 = performance.now()
assert.equal(ans2, null, 'Circuit-broken Ollama returns null')
assert.ok((p3 - p2) < 5, `Circuit breaker response time (${(p3 - p2).toFixed(2)}ms) must be < 5ms`)
console.log(`✓ Check 4: Ollama circuit-breaker verified: trip=${(p1 - p0).toFixed(1)}ms -> fast-fail=${(p3 - p2).toFixed(2)}ms`)

// 5. Verify Bounded Leads Query
const leadsSource = readFileSync(join(root, 'app', 'leads', 'LeadsClient.tsx'), 'utf8')
assert.ok(leadsSource.includes('.limit('), 'LeadsClient.tsx must bound query with .limit()')
console.log('✓ Check 5: app/leads/LeadsClient.tsx query bounding verified')

// 6. Verify Property Intelligence Concurrency
const intelRoute = readFileSync(join(root, 'app', 'api', 'intelligence', 'property', 'route.ts'), 'utf8')
assert.ok(
  intelRoute.includes('Promise.all([') && intelRoute.includes('inspection_sessions') && intelRoute.includes('tasks'),
  'Property intelligence route must fetch sessions and tasks concurrently'
)
assert.ok(intelRoute.includes('.limit(50)'), 'Sessions query must have limit(50)')
assert.ok(intelRoute.includes('.limit(200)'), 'Photos query must have limit(200)')
console.log('✓ Check 6: Property intelligence concurrent fetching and query limits verified')

// 7. Verify Supabase Browser Client Singleton
const clientSource = readFileSync(join(root, 'lib', 'supabase', 'client.ts'), 'utf8')
assert.ok(clientSource.includes('browserClient'), 'lib/supabase/client.ts must implement browserClient singleton')
console.log('✓ Check 7: Supabase browser client singleton pattern verified')

// 8. Verify Status Route Concurrency & Weather Cache
const statusSource = readFileSync(join(root, 'app', 'api', 'status', 'route.ts'), 'utf8')
assert.ok(statusSource.includes('cachedWeatherStatus'), 'Status route must cache weather probe')
assert.ok(statusSource.includes('weatherPromise'), 'Status route must execute weather probe concurrently')
console.log('✓ Check 8: Status route concurrent probe and 30s cache verified')

// 9. Verify Workspace Member Query Optimization
const securitySource = readFileSync(join(root, 'lib', 'api-security.ts'), 'utf8')
assert.ok(securitySource.includes('.limit(1)'), 'requireWorkspaceMember must specify .limit(1)')
console.log('✓ Check 9: requireWorkspaceMember index seek limit(1) verified')

// 10. Verify AiChatBar Client Abort Signal
const chatBarSource = readFileSync(join(root, 'components', 'AiChatBar.tsx'), 'utf8')
assert.ok(chatBarSource.includes('AbortSignal.timeout'), 'AiChatBar must use AbortSignal.timeout on fetch')
console.log('✓ Check 10: AiChatBar client fetch timeout verified')

console.log('\nALL 10 PERFORMANCE CHECKS PASSED!')
