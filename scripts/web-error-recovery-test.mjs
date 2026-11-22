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

// 73: every lead-detail mutation must release its saving flag, and partial
// query failures must not silently blank the activity/appointment lists.
{
  const source = read('../app/leads/[id]/page.tsx')
  for (const name of ['updateStatus', 'saveNextAction', 'saveLostReason', 'addNote', 'scheduleInspection', 'startInspection']) {
    const start = source.indexOf(`async function ${name}(`)
    assert.ok(start !== -1, `missing lead handler: ${name}`)
    const next = source.indexOf('\n  async function ', start + 1)
    const body = source.slice(start, next === -1 ? source.length : next)
    const tryAt = body.indexOf('try {')
    const ctxAt = body.indexOf('await ctx()')
    const finallyAt = body.indexOf('finally')
    assert.ok(tryAt !== -1 && finallyAt !== -1, `${name} must use try/finally`)
    assert.ok(tryAt < ctxAt, `${name} must await ctx() inside the try block`)
    assert.ok(body.indexOf('setSaving(false)', finallyAt) !== -1, `${name} must reset saving in finally`)
  }
  const load = section(source, 'async function load()', 'useEffect(')
  assert.ok(load.includes('try {') && load.includes('catch'), 'lead load must catch thrown auth/network errors')
  assert.ok(load.includes('activityRes.error') && load.includes('appointmentRes.error'), 'both partial query errors must be checked')
  assert.ok(source.includes('load().catch('), 'the mount load must attach a rejection handler')
}

// 77: MFA enrollment/verification must not lock a user out on a network blip.
{
  const source = read('../app/auth/mfa/page.tsx')
  const prepare = section(source, 'async function prepare()', 'void prepare()')
  assert.ok(prepare.includes('try {') && prepare.includes('catch') && prepare.includes('finally'), 'prepare must use try/catch/finally')
  assert.ok(prepare.indexOf('try {') < prepare.indexOf('auth.getUser()'), 'prepare auth call must be inside try')
  assert.ok(prepare.indexOf('setLoading(false)', prepare.indexOf('finally')) !== -1, 'prepare must clear loading in finally')
  const verify = section(source, 'async function verify()', 'async function restartEnrollment()')
  assert.ok(verify.includes('try {') && verify.includes('catch') && verify.includes('finally'), 'verify must use try/catch/finally')
  assert.ok(verify.indexOf('try {') < verify.indexOf('auth.mfa.verify('), 'verify RPC must be inside try')
  assert.ok(verify.indexOf('setWorking(false)', verify.indexOf('finally')) !== -1, 'verify must clear working in finally')
  const restart = section(source, 'async function restartEnrollment()', 'if (loading) return')
  assert.ok(restart.includes('try {') && restart.includes('catch') && restart.includes('finally'), 'restartEnrollment must use try/catch/finally')
  assert.ok(restart.indexOf('try {') < restart.indexOf('auth.mfa.unenroll('), 'unenroll RPC must be inside try')
}

// 80: a partial field query failure must not overwrite a loaded agenda with [].
{
  const source = read('../apps/field/App.tsx')
  const load = section(source, 'async function loadFieldData()', 'function saveDraft(')
  assert.ok(load.includes('appointmentResult.error'), 'appointment query errors must be checked')
  assert.ok(load.includes('taskResult.error'), 'task query errors must be checked')
  assert.ok(load.includes('try {') && load.includes('catch'), 'field data load must catch thrown errors')
  assert.ok(!load.includes('setAgenda([])'), 'a failed load must not silently clear the agenda')
  const boot = section(source, 'useEffect(() => {\n    if (session) {', '\n  }, [session])')
  assert.ok(/loadFieldData\(\)[\s\S]*\.catch\(/.test(boot), 'the boot IIFE must attach a rejection handler')
}

// Batch 10 / 96: Tesseract worker creation can reject before `try` is entered.
// If it sits outside the try, the finally never clears ocrWorking and the OCR
// button is disabled permanently with no error shown.
{
  const estimate = read('../app/photo-estimate/page.tsx')
  const ocr = section(estimate, 'async function findAddressInPhotos()', 'async function uploadPhotos')
  const tryAt = ocr.indexOf('try {')
  const workerAt = ocr.indexOf("createWorker('eng')")
  assert.ok(tryAt !== -1 && workerAt > tryAt, 'Tesseract worker creation must be inside try so a rejection still clears ocrWorking')
  assert.match(ocr, /finally \{[\s\S]*setOcrWorking\(false\)/, 'the OCR working flag must be cleared on every path')
}

console.log('web-error-recovery-test: PASS (mic, passport, upload, leads, packet, lead mutations, MFA, OCR, and field failure paths recover)')
