import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')
function section(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker)
  assert.ok(start !== -1, 'missing section start: ' + startMarker)
  const end = endMarker ? source.indexOf(endMarker, start + startMarker.length) : source.length
  assert.ok(end !== -1, 'missing section end: ' + endMarker)
  return source.slice(start, end)
}

// 65: getUserMedia denial must reset the listening UI, not disable it forever.
{
  const source = read('../app/voice-ai/page.tsx')
  const body = section(source, 'const startVoiceRecognition', 'const sendToWhisper')
  const tryAt = body.indexOf('try {')
  const catchAt = body.indexOf('catch')
  const mediaAt = body.indexOf('getUserMedia({ audio: true })')
  const resetAt = body.indexOf('setIsListening(false)')
  assert.ok(tryAt !== -1 && catchAt !== -1, 'voice acquisition must be wrapped in try/catch')
  assert.ok(tryAt < mediaAt, 'getUserMedia must be acquired inside the try block')
  assert.ok(catchAt > mediaAt, 'catch must follow acquisition')
  assert.ok(resetAt > catchAt, 'mic failure must reset isListening so the button recovers')
  assert.ok(/setResponse\([^)]*(denied|microphone|permission|cannot access)/i.test(body), 'mic failure must surface a user-facing error')
}

// 66: a failed passport load must not render the create form for an existing record.
{
  const source = read('../app/passport/[id]/page.tsx')
  const load = section(source, 'async function load()', 'void load()')
  assert.ok(load.includes('try {') && load.includes('catch') && load.includes('finally'), 'load must handle thrown errors')
  assert.ok((load.match(/\.error/g) ?? []).length >= 3, 'each passport query error must be checked')
  assert.ok(load.includes('setLoadFailed'), 'load failures must be recorded in state')
  const create = section(source, 'async function createPassport()', 'async function setSharing')
  assert.ok(/onConflict:\s*'lead_id'/.test(create), 'create must be idempotent on the unique lead binding')
  // Reviewer MEDIUM 2: createPassport had the same pre-try await defect as camera.
  assert.ok(create.includes('try {') && create.includes('catch') && create.includes('finally'), 'createPassport must handle thrown auth/transport errors')
  assert.ok(create.indexOf('try {') < create.indexOf('auth.getUser()'), 'createPassport auth call must be inside try')
  assert.ok(create.indexOf('setSaving(false)', create.indexOf('finally')) !== -1, 'createPassport must clear saving in finally')
  const render = source.slice(source.indexOf('{passport ? ('))
  assert.ok(render.includes('loadFailed'), 'create form must be hidden while load state is unknown/failed')
  assert.ok(render.indexOf('loadFailed') < render.indexOf('Create Roof Passport'), 'load guard must precede the create form')
}

// 67: auth/RPC failures before the try block must not strand the upload button.
{
  const source = read('../app/camera/page.tsx')
  const save = section(source, 'const savePhotos', 'return (')
  const tryAt = save.indexOf('try {')
  assert.ok(tryAt !== -1, 'savePhotos must have a try block')
  assert.ok(tryAt < save.indexOf('auth.getUser()'), 'auth.getUser must be inside the try block')
  assert.ok(tryAt < save.indexOf("rpc('current_workspace_id')"), 'workspace RPC must be inside the try block')
  assert.ok(save.includes('finally') || save.includes('setSaving(false)'), 'saving state must always be reset')
  const catchAt = save.indexOf('catch')
  assert.ok(catchAt !== -1 && catchAt > tryAt, 'savePhotos must catch auth/transport failures')
}

// 68: lead list network/auth rejection must clear the spinner.
{
  const source = read('../app/leads/LeadsClient.tsx')
  const load = section(source, 'async function loadLeads()', 'void loadLeads()')
  assert.ok(load.includes('try {') && load.includes('catch') && load.includes('finally'), 'loadLeads must use try/catch/finally')
  assert.ok(load.indexOf('try {') < load.indexOf('auth.getUser()'), 'auth call must be inside try')
  const finallyAt = load.indexOf('finally')
  assert.ok(finallyAt !== -1 && load.indexOf('setLoading(false)', finallyAt) !== -1, 'spinner must be cleared in finally')
}

// 69: inspection packet fetch rejection must clear loading and show an error.
{
  const source = read('../app/inspections/[id]/page.tsx')
  const load = section(source, 'async function load()', 'void load()')
  assert.ok(load.includes('try {') && load.includes('catch') && load.includes('finally'), 'packet load must use try/catch/finally')
  assert.ok(load.indexOf('try {') < load.indexOf("fetch(`/api/inspections/"), 'fetch must be inside try')
  const catchAt = load.indexOf('catch')
  assert.ok(catchAt !== -1 && load.indexOf('setError(', catchAt) !== -1, 'fetch failures must surface an error')
  const finallyAt = load.indexOf('finally')
  assert.ok(finallyAt !== -1 && load.indexOf('setLoading(false)', finallyAt) !== -1, 'spinner must be cleared in finally')
}

console.log('web-error-recovery-test: PASS (mic, passport, upload, leads, and packet failure paths recover)')
