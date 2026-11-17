import assert from 'node:assert/strict'
import { searchParallelAnonymous } from '../lib/research/parallel-anonymous.ts'

// Public, non-customer test input. Calls only the pinned anonymous web_search
// MCP transport; no API keys, OAuth, paid API, or paid fallback.
delete process.env.PARALLEL_ANONYMOUS_RESEARCH_ENABLED
const result = await searchParallelAnonymous('GAF Timberline HDZ shingle installation instructions')
assert.equal(result.source, 'parallel-anonymous-mcp')
assert.equal(result.paidCalls, 0)
assert.ok(result.results.length > 0)
for (const row of result.results) {
  const url = new URL(row.url)
  assert.ok(['https:', 'http:'].includes(url.protocol))
  assert.ok(row.title.trim().length > 0)
}
console.log('Anonymous Parallel live smoke PASS: usable public sources, no credentials or paid calls.')
