// Executes the real POST handler and JSON decoder. Only the external Supabase
// auth/database boundary is replaced; this does not verify deployed RLS or Auth.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve, dirname } from 'node:path'
import vm from 'node:vm'
import ts from 'typescript'

function loadTs(path, replacements = {}) {
  const filename = resolve(path)
  const module = { exports: {} }
  const nativeRequire = createRequire(filename)
  const code = ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText
  const require = (name) => {
    if (Object.hasOwn(replacements, name)) return replacements[name]
    if (name.startsWith('.')) return loadTs(resolve(dirname(filename), name + '.ts'), replacements)
    return nativeRequire(name)
  }
  vm.runInThisContext(`(function(require,module,exports){${code}\n})`, { filename })(require, module, module.exports)
  return module.exports
}

const workspaceId = '11111111-1111-4111-8111-111111111111'
function harness({ authenticated = true, admin = false, lineError = false } = {}) {
  const writes = []
  const supabase = {
    auth: { getUser: async () => ({ data: { user: authenticated ? { id: 'user-1' } : null } }) },
    rpc: async (name) => ({ data: name === 'current_workspace_id' ? workspaceId : admin }),
    from(table) {
      return {
        insert(row) {
          writes.push({ table, row })
          if (table === 'estimate_line_items') return Promise.resolve({ error: lineError ? { message: 'synthetic write failure' } : null })
          return { select: () => ({ single: async () => ({ data: { ...row, id: 'estimate-1', created_at: '2026-11-01T12:00:00Z' }, error: null }) }) }
        },
        delete: () => ({ eq: async (column, value) => { writes.push({ table, delete: { column, value } }); return { error: null } } }),
      }
    },
  }
  const route = loadTs('app/api/estimates/route.ts', {
    '../../../lib/supabase/server': { createClient: async () => supabase },
  })
  return {
    writes,
    post: (body) => route.POST(new Request('https://roof-os.test/api/estimates', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    })),
  }
}
const valid = { description: ' Roof material ', category: 'material', unit: ' SQ ', quantity: 2, unit_cost: 25 }
for (const [label, body, status, options] of [
  ['unauthenticated', { line_items: [valid] }, 401, { authenticated: false }],
  ['non-admin approval', { status: 'approved', line_items: [valid] }, 403],
  ['invalid status', { status: 'sent', line_items: [] }, 400],
  ['non-array items', { line_items: {} }, 400],
  ['201 rows', { line_items: Array(201).fill(valid) }, 400],
  ['null row', { line_items: [null] }, 400],
  ['blank description', { line_items: [{ ...valid, description: ' ' }] }, 400],
  ['long description', { line_items: [{ ...valid, description: 'x'.repeat(501) }] }, 400],
  ['invalid category', { line_items: [{ ...valid, category: 'unknown' }] }, 400],
  ['blank unit', { line_items: [{ ...valid, unit: ' ' }] }, 400],
  ['long unit', { line_items: [{ ...valid, unit: 'x'.repeat(21) }] }, 400],
  ['numeric string', { line_items: [{ ...valid, quantity: '2' }] }, 400],
  ['negative cost', { line_items: [{ ...valid, unit_cost: -1 }] }, 400],
  ['null quantity', { line_items: [{ ...valid, quantity: null }] }, 400],
  ['invalid item code', { line_items: [{ ...valid, item_code: {} }] }, 400],
  ['overflowing estimate total', { line_items: Array(20).fill({ ...valid, quantity: 1, unit_cost: 1e307 }) }, 400],
  ['overflowing line total', { line_items: [{ ...valid, quantity: 1e308, unit_cost: 2 }] }, 400],
]) {
  const h = harness(options)
  const response = await h.post(body)
  assert.equal(response.status, status, label)
  assert.deepEqual(h.writes, [], `${label}: reject before any write`)
}
const h = harness()
const response = await h.post({ customer_name: 'Synthetic Customer', line_items: [valid, { ...valid, category: 'tax', quantity: 1, unit_cost: 4 }] })
assert.equal(response.status, 201)
const { estimate } = await response.json()
assert.equal(estimate.status, 'draft', 'new estimates default to review-gated drafts')
assert.equal(estimate.subtotal, 50)
assert.equal(estimate.tax, 4)
assert.equal(estimate.total, 54)
assert.equal(h.writes[0].row.workspace_id, workspaceId)
assert.equal(h.writes[0].row.created_by, 'user-1')
assert.equal(h.writes[1].row[0].description, 'Roof material')
assert.equal(h.writes[1].row[0].unit, 'SQ')
for (const items of [[], Array(200).fill({ ...valid, unit_cost: 0 })]) {
  const boundary = harness()
  const result = await boundary.post({ line_items: items })
  assert.equal(result.status, 201, 'empty and maximum-size drafts are accepted')
  const payload = await result.json()
  assert.equal(payload.estimate.total, 0, 'unpriced drafts stay zero')
  assert.equal(payload.estimate.status, 'draft')
}
const rollback = harness({ lineError: true })
assert.equal((await rollback.post({ line_items: [valid] })).status, 502)
assert.deepEqual(rollback.writes.at(-1), { table: 'estimates', delete: { column: 'id', value: 'estimate-1' } })
console.log('estimate-creation-runtime-test: PASS (real handler, auth, approval, validation before writes, draft totals, rollback; synthetic database boundary)')
