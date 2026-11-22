import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripCommentsAndStrings } from './lib/source-marker.mjs'

// 63: auth detection must not be satisfied by a comment or a string literal.
const commentOnly = stripCommentsAndStrings('// getUser()\n/* CRON_SECRET */\nconst x = 1')
assert.ok(!commentOnly.includes('getUser()'), 'commented-out session guard must not count')
assert.ok(!commentOnly.includes('CRON_SECRET'), 'commented-out cron secret must not count')

const stringOnly = stripCommentsAndStrings("const s = 'getUser()'\nconst c = `CRON_SECRET`")
assert.ok(!stringOnly.includes('getUser()'), 'string-literal session guard must not count')
assert.ok(!stringOnly.includes('CRON_SECRET'), 'string-literal cron secret must not count')

const realCode = stripCommentsAndStrings(
  "// this calls getUser() in a comment\nconst { data: { user } } = await supabase.auth.getUser()\nconst secret = process.env.CRON_SECRET?.trim()"
)
assert.ok(realCode.includes('getUser()'), 'a real session guard must still be detected')
assert.ok(realCode.includes('CRON_SECRET'), 'a real cron guard must still be detected')

const releaseCheck = readFileSync(new URL('./release-check.mjs', import.meta.url), 'utf8')
assert.ok(releaseCheck.includes("from './lib/source-marker.mjs'"), 'release-check must import the marker stripper')
assert.ok(releaseCheck.includes('stripCommentsAndStrings(source)'), 'auth markers must be scanned in stripped source')
assert.ok(!/const hasSessionGuard = source\.includes\('getUser\(\)'\)/.test(releaseCheck), 'raw-source session marker check must be gone')
assert.ok(!/const hasCronGuard = source\.includes\('CRON_SECRET'\)/.test(releaseCheck), 'raw-source cron marker check must be gone')
// Reviewer NIT 5: provider webhook guards have the same comment/string weakness.
assert.ok(/hasStripeSignatureGuard[^\n]*code\.includes\('constructEvent'\)/.test(releaseCheck), 'Stripe webhook marker must use stripped source')
assert.ok(/hasTwilioSignatureGuard = code\.includes\('assertTwilioRequest'\)/.test(releaseCheck), 'Twilio webhook marker must use stripped source')
assert.ok(/hasStripeSignatureGuard[^\n]*source\.includes\("stripe-signature"\)/.test(releaseCheck), 'header-name literal check stays on raw source')

// Guard the gate against a fixture that only mentions auth in comments.
const fixture = "// getUser()\n// CRON_SECRET\nexport async function GET() { return null }"
const strippedFixture = stripCommentsAndStrings(fixture)
assert.ok(!strippedFixture.includes('getUser()') && !strippedFixture.includes('CRON_SECRET'), 'comment-only route fixture must fail auth detection')

console.log('release-check-auth-marker-test: PASS (comment/string auth markers rejected, real guards detected)')
