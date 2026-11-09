import assert from 'node:assert/strict'
import { askBrowserLocalOllama, getLocalChatEndpoint, getLocalChatModel } from '../lib/ai/local-chat-browser.ts'
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
assert.ok(transcribeRoute.includes('MAX_AUDIO_BYTES'), 'Transcription route must bound audio uploads')
assert.ok(transcribeRoute.includes('file.size > MAX_AUDIO_BYTES'), 'Transcription route must check Blob size')
assert.ok(transcribeRoute.includes('AUDIO_TYPES'), 'Transcription route must validate audio MIME types')
assert.ok(transcribeRoute.includes('content-length'), 'Transcription route must reject oversized requests before parsing multipart data')
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
assert.equal(estimateResult.suggestedAction?.href, '/estimate')

const priceBookResult = await processChatCopilot({ message: 'review lowes material pricing and labor rates' })
assert.equal(priceBookResult.suggestedAction?.href, '/pricing-config')

const reportResult = await processChatCopilot({ message: 'generate golden inspection report' })
assert.equal(reportResult.suggestedAction?.href, '/reports')

const damageResult = await processChatCopilot({ message: 'check these photos for hail damage' })
assert.equal(damageResult.suggestedAction?.href, '/photo-estimate')

const teamResult = await processChatCopilot({ message: 'invite a new team member' })
assert.equal(teamResult.suggestedAction?.href, '/team')

const savedWhisperUrl = process.env.WHISPER_URL
const savedWhisperWorkerUrl = process.env.WHISPER_WORKER_URL
const savedFetch = globalThis.fetch
delete process.env.WHISPER_URL
process.env.WHISPER_WORKER_URL = 'http://127.0.0.1:8088/worker-prefix/'
const { processAudioTranscription } = await import('../lib/ai/chat-copilot.ts')
const workerSource = readFileSync(join(root, 'workers', 'whisper', 'server.py'), 'utf8')
assert.match(workerSource, /file:\s*UploadFile\s*=\s*File\(\.\.\.\)/, 'Whisper worker must accept the file multipart field')
try {
  globalThis.fetch = async (input, init) => {
    assert.equal(String(input), 'http://127.0.0.1:8088/worker-prefix/transcribe', 'Whisper base URLs must resolve to the worker endpoint')
    assert.equal(init?.method, 'POST')
    assert.ok(init?.body instanceof FormData, 'Whisper request must be multipart form data')
    assert.ok(init.body.get('file') instanceof Blob, 'Whisper request must use the worker file field')
    assert.equal(init.body.get('audio'), null, 'Whisper request must not use the unsupported audio field')
    assert.equal(init.body.get('language'), 'en-US')
    return new Response(JSON.stringify({ text: '  roof inspection requested  ' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }
  assert.equal(
    await processAudioTranscription(new Blob(['test audio']), 'en-US'),
    'roof inspection requested',
    'Whisper client must return trimmed worker transcript text',
  )

  process.env.WHISPER_WORKER_URL = 'http://127.0.0.1:8088/transcribe'
  globalThis.fetch = async (input) => {
    assert.equal(String(input), 'http://127.0.0.1:8088/transcribe', 'An explicit endpoint must not receive a duplicate path')
    return new Response(JSON.stringify({ text: 'ok' }), { status: 200 })
  }
  assert.equal(await processAudioTranscription(new Blob(['test audio'])), 'ok')

  globalThis.fetch = async () => new Response('{}', { status: 503 })
  assert.equal(await processAudioTranscription(new Blob(['test audio'])), null, 'Unavailable Whisper worker must produce no transcript')

  delete process.env.WHISPER_WORKER_URL
  assert.equal(await processAudioTranscription(new Blob(['test audio'])), null, 'Missing Whisper worker must produce no transcript')
} finally {
  globalThis.fetch = savedFetch
  if (savedWhisperUrl === undefined) delete process.env.WHISPER_URL
  else process.env.WHISPER_URL = savedWhisperUrl
  if (savedWhisperWorkerUrl === undefined) delete process.env.WHISPER_WORKER_URL
  else process.env.WHISPER_WORKER_URL = savedWhisperWorkerUrl
}


const localChatSource = readFileSync(join(root, 'lib', 'ai', 'local-chat-browser.ts'), 'utf8')
const proxySource = readFileSync(join(root, 'proxy.ts'), 'utf8')
assert.ok(proxySource.includes("http://localhost:11434"), 'CSP must allow the default desktop Ollama origin')
assert.ok(proxySource.includes("http://127.0.0.1:11434"), 'CSP must allow IPv4 loopback Ollama')
assert.ok(proxySource.includes("http://[::1]:11434"), 'CSP must allow IPv6 loopback Ollama')
assert.ok(localChatSource.includes("url.protocol !== 'http:'") && localChatSource.includes("url.port !== '11434'"), 'browser Ollama endpoint must match the narrowly allowed CSP origin')
assert.ok(componentSource.includes('askBrowserLocalOllama'), 'chat UI must call browser-local Ollama')
assert.ok(!copilotSource.includes('askOllama'), 'server-side copilot must not try to reach the hosting machine localhost')
assert.ok(localChatSource.includes('LOCAL_HOSTS'), 'browser chat may connect only to loopback')
assert.ok(localChatSource.includes("credentials: 'omit'"), 'local Ollama requests must not send app cookies')
assert.ok(routeSource.includes('processChatCopilot'), 'authenticated API route retains deterministic copilot navigation')
assert.ok(routeSource.includes('refused: true'), 'server permission refusals are explicitly marked')
assert.ok(componentSource.includes('data.refused === true ? null : await askBrowserLocalOllama'), 'local model cannot overwrite a server-enforced role refusal')
const serverRequestStart = componentSource.indexOf("fetch('/api/ai/chat'")
const serverRequestEnd = componentSource.indexOf('const data = await response.json()', serverRequestStart)
assert.ok(serverRequestStart >= 0 && serverRequestEnd > serverRequestStart, 'server chat request block exists')
assert.ok(!componentSource.slice(serverRequestStart, serverRequestEnd).includes('history:'), 'chat history stays in the browser and is not sent to the app server')
assert.ok(!routeSource.includes('history?: unknown'), 'server route does not accept or retain chat history')

const savedChatBase = process.env.NEXT_PUBLIC_OLLAMA_CHAT_API_BASE_URL
const savedChatModel = process.env.NEXT_PUBLIC_OLLAMA_CHAT_MODEL
const savedChatFetch = globalThis.fetch
try {
  delete process.env.NEXT_PUBLIC_OLLAMA_CHAT_API_BASE_URL
  process.env.NEXT_PUBLIC_OLLAMA_CHAT_MODEL = 'llama3:test'
  assert.equal(getLocalChatEndpoint(), 'http://localhost:11434/v1')
  assert.equal(getLocalChatModel(), 'llama3:test')
  let requestUrl
  let requestInit
  globalThis.fetch = async (url, init) => {
    requestUrl = url
    requestInit = init
    return new Response(JSON.stringify({ choices: [{ message: { content: '  Local answer  ' } }] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }
  assert.equal(await askBrowserLocalOllama({
    message: 'How do I inspect a roof?',
    history: [{ role: 'user', content: 'Previous question' }],
    currentPath: '/measure',
    suggestedAction: { label: 'Measurements', href: '/measure' },
  }), 'Local answer')
  assert.equal(requestUrl, 'http://localhost:11434/v1/chat/completions')
  assert.equal(requestInit.credentials, 'omit')
  assert.equal(new Headers(requestInit.headers).get('authorization'), null)
  const localBody = JSON.parse(requestInit.body)
  assert.equal(localBody.model, 'llama3:test')
  assert.equal(localBody.messages.at(-1).role, 'user')
  assert.match(localBody.messages.at(-1).content, /Current ROOF\/OS page: \/measure/)
  globalThis.fetch = async () => new Response('x'.repeat(300 * 1024), { status: 200 })
  assert.equal(await askBrowserLocalOllama({ message: 'test' }), null, 'oversized local model responses are rejected')

  process.env.NEXT_PUBLIC_OLLAMA_CHAT_API_BASE_URL = 'https://example.com/v1'
  assert.equal(getLocalChatEndpoint(), null, 'remote hosts are rejected')
  assert.equal(await askBrowserLocalOllama({ message: 'test' }), null, 'remote endpoint is never contacted')
  process.env.NEXT_PUBLIC_OLLAMA_CHAT_API_BASE_URL = 'http://localhost:11435/v1'
  assert.equal(getLocalChatEndpoint(), null, 'non-default local ports are rejected by the CSP-aligned client')
  process.env.NEXT_PUBLIC_OLLAMA_CHAT_API_BASE_URL = 'https://localhost:11434/v1'
  assert.equal(getLocalChatEndpoint(), null, 'unexpected local HTTPS endpoints are rejected')
  process.env.NEXT_PUBLIC_OLLAMA_CHAT_API_BASE_URL = 'http://localhost:11434/v1'
  globalThis.fetch = async () => { throw new TypeError('CORS blocked') }
  assert.equal(await askBrowserLocalOllama({ message: 'test' }), null, 'offline/CORS errors preserve fallback behavior')
} finally {
  globalThis.fetch = savedChatFetch
  if (savedChatBase === undefined) delete process.env.NEXT_PUBLIC_OLLAMA_CHAT_API_BASE_URL
  else process.env.NEXT_PUBLIC_OLLAMA_CHAT_API_BASE_URL = savedChatBase
  if (savedChatModel === undefined) delete process.env.NEXT_PUBLIC_OLLAMA_CHAT_MODEL
  else process.env.NEXT_PUBLIC_OLLAMA_CHAT_MODEL = savedChatModel
}

console.log('ai-chat-bar-test: PASS (browser-local Ollama, loopback-only endpoint, deterministic fallback, copilot navigation and existing workflows)')
