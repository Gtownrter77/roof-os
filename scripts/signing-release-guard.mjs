import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const sign = readFileSync('app/sign/page.tsx', 'utf8')
assert.doesNotMatch(sign, /setSigned\s*\(|handleSign\s*=|Execute Legal Signature|Contract Legally Executed|ESIGN\s*&amp;\s*UETA Compliant|Verification certificate stored/i, 'Unsigned demo must never report a legally executed contract')
assert.doesNotMatch(sign, /Whispering Pines|Sarah Jenkins|Marcus Vance/, 'Signing page must not display fabricated customer documents')
assert.match(sign, /signing is not available/i, 'Page must clearly disclose that electronic signing is unavailable')
console.log('signing-release-guard: PASS')
