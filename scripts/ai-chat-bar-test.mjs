import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = new URL('..', import.meta.url).pathname

// 1. Verify Global Layout Mount
const layoutSource = readFileSync(join(root, 'app', 'layout.tsx'), 'utf8')
assert.ok(
  layoutSource.includes('AiChatBar'),
  'app/layout.tsx must import and render AiChatBar so it appears on every page'
)

// 2. Verify Client Component Contract
const componentSource = readFileSync(join(root, 'components', 'AiChatBar.tsx'), 'utf8')
assert.ok(
  componentSource.includes('What would you like to do now?'),
  'AiChatBar component must prompt: "What would you like to do now?"'
)
assert.ok(
  componentSource.includes('AI Copilot') || componentSource.includes('AI Assistant'),
  'AiChatBar must identify as AI Copilot'
)
assert.ok(
  componentSource.includes('role="region"'),
  'AiChatBar must include accessible region'
)
assert.ok(
  componentSource.includes('/api/ai/chat'),
  'AiChatBar must connect to /api/ai/chat'
)
for (const action of ['Track Storms', 'Review Leads', 'Aerial Measure', 'Create Estimate', 'Golden Report']) {
  assert.ok(
    componentSource.includes(action),
    `AiChatBar must provide quick action suggestion: ${action}`
  )
}
assert.ok(
  componentSource.includes('metaKey') && componentSource.includes("'k'"),
  'AiChatBar must support Cmd+K / Ctrl+K keyboard shortcut'
)

// 3. Verify API Route Security & Integrity
const routeSource = readFileSync(join(root, 'app', 'api', 'ai', 'chat', 'route.ts'), 'utf8')
assert.ok(
  routeSource.includes('getUser()'),
  'AI chat API route must contain user session check'
)
assert.ok(
  routeSource.includes('readJson'),
  'AI chat API route must use bounded JSON body reader'
)
assert.ok(
  !routeSource.includes('request.json()'),
  'AI chat API route must not bypass bounded reader'
)
assert.ok(
  [...routeSource.matchAll(/\bfetch\s*\(/g)].length === 0,
  'AI chat API route must not contain raw unbounded fetches'
)

const copilotSource = readFileSync(join(root, 'lib', 'ai', 'chat-copilot.ts'), 'utf8')
for (const [, href] of copilotSource.matchAll(/href:\s*'([^']+)'/g)) {
  const page = href === '/' ? join(root, 'app', 'page.tsx') : join(root, 'app', href.slice(1), 'page.tsx')
  assert.ok(existsSync(page), `Copilot action ${href} must resolve to an App Router page`)
}

const transcribeRoute = readFileSync(join(root, 'app', 'api', 'ai', 'transcribe', 'route.ts'), 'utf8')
assert.ok(transcribeRoute.includes('sourced: false'), 'Unavailable Whisper must not claim a sourced transcript')
assert.ok(transcribeRoute.includes('status: 503'), 'Unavailable Whisper must be reported as a service failure')
assert.ok(!transcribeRoute.includes('sourced: Boolean(text)'), 'A non-empty Unknown placeholder must not be treated as a transcript')

const invitationRoute = readFileSync(join(root, 'app', 'api', 'team', 'invitations', 'route.ts'), 'utf8')
const invitationPost = invitationRoute.split('export async function POST')[1] ?? ''
assert.ok(invitationPost.includes('is_workspace_admin'), 'Invitation creation must verify workspace-admin role')
assert.ok(invitationPost.includes('roleError || isAdmin !== true'), 'Invitation creation must fail closed on role-check errors')
assert.ok(invitationPost.includes('NEXT_PUBLIC_APP_URL'), 'Invitation email redirect must support the configured app URL')

const photoVerifyPage = readFileSync(join(root, 'app', 'photo-verify', 'page.tsx'), 'utf8')
assert.ok(photoVerifyPage.includes("router.push('/photo-estimate')"), 'Photo checklist must continue to the real saved photo-estimate workflow')
assert.ok(photoVerifyPage.includes('disabled title="Insurance submission is not configured"'), 'Unconfigured insurer submission must be disabled')
assert.ok(!photoVerifyPage.includes('AI Photo Verification'), 'Browser-only category checks must not be represented as AI')
assert.ok(!photoVerifyPage.includes("quality: 'High'"), 'Photo quality must not be fabricated as High')

// 4. Test Assistant Intelligence Processor Unit Tests
const { processChatCopilot } = await import('../lib/ai/chat-copilot.ts')

// Empty prompt check
const emptyResult = await processChatCopilot({ message: '' })
assert.ok(
  emptyResult.reply.includes('What would you like to do now?'),
  'Default assistant response must ask "What would you like to do now?"'
)

// Intent & navigation matching checks
const stormResult = await processChatCopilot({ message: 'I need to track the storm in Ohio' })
assert.equal(stormResult.suggestedAction?.href, '/weather')

const leadResult = await processChatCopilot({ message: 'show me my new leads' })
assert.equal(leadResult.suggestedAction?.href, '/leads')

const measureResult = await processChatCopilot({ message: 'calculate roof pitch and squares' })
assert.equal(measureResult.suggestedAction?.href, '/measure')

const estimateResult = await processChatCopilot({ message: 'create pricing estimate with lowes' })
assert.equal(estimateResult.suggestedAction?.href, '/pricing')

const reportResult = await processChatCopilot({ message: 'generate golden inspection report' })
assert.equal(reportResult.suggestedAction?.href, '/reports')

const damageResult = await processChatCopilot({ message: 'check these photos for hail damage' })
assert.equal(damageResult.suggestedAction?.href, '/photo-estimate')

const teamResult = await processChatCopilot({ message: 'invite a new team member' })
assert.equal(teamResult.suggestedAction?.href, '/team')

const savedWhisperUrl = process.env.WHISPER_URL
const savedWhisperWorkerUrl = process.env.WHISPER_WORKER_URL
delete process.env.WHISPER_URL
delete process.env.WHISPER_WORKER_URL
const { processAudioTranscription } = await import('../lib/ai/chat-copilot.ts')
assert.equal(await processAudioTranscription(new Blob(['test audio'])), null, 'Missing Whisper worker must produce no transcript')
if (savedWhisperUrl === undefined) delete process.env.WHISPER_URL
else process.env.WHISPER_URL = savedWhisperUrl
if (savedWhisperWorkerUrl === undefined) delete process.env.WHISPER_WORKER_URL
else process.env.WHISPER_WORKER_URL = savedWhisperWorkerUrl

console.log('ai-chat-bar-test: PASS (copilot routes resolve; missing Whisper is surfaced; team/photo workflows are wired and honestly labeled)')
