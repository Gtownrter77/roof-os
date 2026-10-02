import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const pages = [
  'app/calendar/page.tsx',
  'app/inspections/page.tsx',
  'app/leads/LeadsClient.tsx',
  'app/reports/page.tsx',
]

for (const path of pages) {
  const source = readFileSync(path, 'utf8')
  assert.match(source, /useMemo\(\(\) => createClient\(\), \[\]\)/, `${path} must memoize its Supabase client`)
  assert.doesNotMatch(source, /const supabase = createClient\(\)/, `${path} must not create a Supabase client during every render`)
}

console.log(`supabase-client-stability-test: PASS (${pages.length} data-loading pages)`)
