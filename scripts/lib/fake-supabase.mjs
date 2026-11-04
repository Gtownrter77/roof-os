// Minimal chainable Supabase stand-in for read-path tests. Records every call and
// fails the test if a write method is used.
export const WRITE_METHODS = new Set(['insert', 'upsert', 'update', 'delete', 'rpc'])

export function createFakeSupabase(tables, { allowWrites = false } = {}) {
  const calls = []
  const writes = []
  function builder(table) {
    const filters = []
    let limit = null
    let order = null
    const api = {
      select() { return api },
      eq(column, value) { filters.push((row) => row[column] === value); return api },
      neq(column, value) { filters.push((row) => row[column] !== value); return api },
      in(column, values) { filters.push((row) => values.includes(row[column])); return api },
      not(column, op, value) { filters.push((row) => !(op === 'is' && value === null ? row[column] == null : row[column] === value)); return api },
      like(column, pattern) {
        const prefix = pattern.replace(/%$/, '')
        filters.push((row) => typeof row[column] === 'string' && row[column].startsWith(prefix))
        return api
      },
      lte(column, value) { filters.push((row) => row[column] <= value); return api },
      order(column, options = {}) { order = { column, ascending: options.ascending !== false }; return api },
      limit(value) { limit = value; return api },
      rows() {
        let rows = (tables[table] ?? []).filter((row) => filters.every((filter) => filter(row)))
        if (order) rows = [...rows].sort((a, b) => (a[order.column] < b[order.column] ? -1 : a[order.column] > b[order.column] ? 1 : 0) * (order.ascending ? 1 : -1))
        if (limit !== null) rows = rows.slice(0, limit)
        return rows
      },
      maybeSingle() { return Promise.resolve({ data: api.rows()[0] ?? null, error: null }) },
      single() { return Promise.resolve({ data: api.rows()[0] ?? null, error: null }) },
      then(resolve, reject) { return Promise.resolve({ data: api.rows(), error: null }).then(resolve, reject) },
    }
    for (const method of WRITE_METHODS) {
      if (method === 'rpc') continue
      api[method] = (payload) => {
        writes.push({ table, method, payload })
        if (!allowWrites) throw new Error(`Unexpected ${method} on ${table} in a read-only path`)
        if (method === 'insert' || method === 'upsert') {
          const rows = Array.isArray(payload) ? payload : [payload]
          tables[table] = [...(tables[table] ?? []), ...rows]
        }
        return api
      }
    }
    return api
  }
  return {
    calls,
    writes,
    from(table) { calls.push(table); return builder(table) },
    rpc(name) { writes.push({ table: name, method: 'rpc' }); throw new Error(`Unexpected rpc ${name}`) },
  }
}
