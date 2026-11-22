import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')

// 58: these two joins must emit a real newline. The source previously held a
// double-backslash literal, so the CSV had no row breaks and the clipboard
// summary showed the two characters \ and n between lines.
for (const path of ['../app/export/page.tsx', '../app/supplement/page.tsx']) {
  const source = read(path)
  assert.ok(source.includes(".join('\\n')"), `${path} must join with a real newline`)
  assert.ok(!source.includes(".join('\\\\n')"), `${path} must not contain a literal backslash-n separator`)
}

// The calendar ICS escape is correct per RFC 5545 and must remain untouched.
const calendar = read('../app/calendar/page.tsx')
assert.ok(calendar.includes(".replace(/\\n/g, '\\\\n')"), 'RFC 5545 ICS escaping must remain')

console.log('literal-newline-test: PASS (real newlines in CSV and summary, ICS escaping preserved)')
