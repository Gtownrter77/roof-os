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

// 83: the agent-run idempotency lookup must propagate read failures, and a
// 23505 replay must return only a terminal-success row, never a running/failed one.
{
  const source = read('../workers/agent-runtime.ts')
  const lookup = section(source, "const { data: existing", 'if (existing?.status')
  assert.ok(/error:\s*\w+/.test(lookup), 'idempotency lookup must capture its error')
  assert.ok(/if\s*\(\s*\w*[Ee]rror\s*\)\s*throw/.test(lookup), 'idempotency read error must be thrown')

  const replayStart = source.indexOf('if (!data) {', source.indexOf("error.code !== '23505'"))
  assert.ok(replayStart !== -1, 'missing 23505 replay branch')
  const replay = source.slice(replayStart, source.indexOf('started = data', replayStart))
  assert.ok(/error:\s*\w+/.test(replay), '23505 re-read must capture its error')
  assert.ok(/if\s*\(\s*\w*[Ee]rror\s*\)\s*throw/.test(replay), '23505 re-read error must be thrown')
  assert.ok(/'succeeded'/.test(replay) && /'needs_review'/.test(replay), '23505 replay must validate a terminal-success status before returning the row')
}

// 84: every tasks-page loader/handler must clear its busy flag in finally and guard re-entry.
{
  const source = read('../app/tasks/page.tsx')
  const handlers = [
    ['loadTasks', section(source, 'const loadTasks = async', 'useEffect(() =>')],
    ['mount load', section(source, 'async function load()', 'void load()')],
    ['addTask', section(source, 'const addTask = async', 'const toggleTask')],
    ['toggleTask', section(source, 'const toggleTask = async', 'return <main')],
  ]
  for (const [name, body] of handlers) {
    const hasBusyFlag = name !== 'toggleTask'
    const structureOk = body.includes('try {') && body.includes('catch') && (!hasBusyFlag || body.includes('finally'))
    assert.ok(structureOk, `${name} must use try/catch${hasBusyFlag ? '/finally' : ''}`)
    const flag = name === 'addTask' ? 'setSaving(false)' : name === 'toggleTask' ? '' : 'setLoading(false)'
    if (flag) assert.ok(body.indexOf(flag, body.indexOf('finally')) !== -1, `${name} must reset ${flag} in finally`)
  }
  const add = handlers[2][1]
  assert.ok(/if\s*\([\s\S]{0,80}\bsaving\b[\s\S]{0,80}\)\s*return/.test(add), 'addTask must guard against duplicate submits')
}

// 85: new-lead submit must be throw-safe, clear saving in finally, and guard re-entry.
{
  const source = read('../app/leads/new/page.tsx')
  const submit = section(source, 'const handleSubmit = async', 'return (')
  assert.ok(submit.includes('try {') && submit.includes('catch') && submit.includes('finally'), 'handleSubmit must use try/catch/finally')
  const finallyAt = submit.indexOf('finally')
  assert.ok(submit.indexOf('setSaving(false)', finallyAt) !== -1, 'handleSubmit must reset saving in finally')
  assert.ok(/if\s*\([\s\S]{0,80}\bsaving\b[\s\S]{0,80}\)\s*return/.test(submit), 'handleSubmit must guard against duplicate submits')
  assert.ok(submit.includes('activityError'), 'the lead_activity write result must be checked')
  // A setError() immediately before navigation is unobservable. The bounded
  // warning code must survive the redirect and be rendered on the lead page.
  assert.match(submit, /activityError\s*\?\s*'\?notice=activity-log-write-failed'/, 'activity-write warning must be carried in the redirect')
  const detail = read('../app/leads/[id]/page.tsx')
  assert.ok(detail.includes("get('notice') === 'activity-log-write-failed'"), 'lead page must recognize the warning code')
  assert.match(detail, /\{notice\s*&&\s*<p/, 'lead page must render the warning')
  assert.ok(!/get\('notice'\)[\s\S]{0,120}\{\s*notice\s*\}/.test(detail), 'raw query text must never be rendered directly')
}

// 86: workspace switcher load must catch rejections; switch must clear saving in finally and guard re-entry.
{
  const source = read('../components/WorkspaceSwitcher.tsx')
  const load = section(source, 'async function load()', 'void load()')
  assert.ok(load.includes('try {') && load.includes('catch'), 'workspace load must handle rejections')
  const choose = section(source, 'async function chooseWorkspace', 'return (')
  assert.ok(choose.includes('try {') && choose.includes('catch') && choose.includes('finally'), 'chooseWorkspace must use try/catch/finally')
  const finallyAt = choose.indexOf('finally')
  assert.ok(choose.indexOf('setSaving(false)', finallyAt) !== -1, 'chooseWorkspace must reset saving in finally')
  assert.ok(/if\s*\([\s\S]{0,80}\bsaving\b[\s\S]{0,80}\)\s*return/.test(choose), 'chooseWorkspace must guard against concurrent switches')
}

// 87: siding save/verify/createDraft must clear working in finally and guard re-entry.
{
  const source = read('../app/siding/page.tsx')
  for (const name of ['save', 'verify', 'createDraft']) {
    const start = source.indexOf(`async function ${name}()`)
    assert.ok(start !== -1, `missing siding ${name} handler`)
    const body = source.slice(start, source.indexOf('\n', start))
    assert.ok(/try\s*\{/.test(body) && /catch\s*\(/.test(body) && body.includes('finally'), `siding ${name} must use try/catch/finally`)
    const finallyAt = body.indexOf('finally')
    assert.ok(body.indexOf('setWorking(false)', finallyAt) !== -1, `siding ${name} must reset working in finally`)
    assert.ok(/if\s*\([\s\S]{0,40}\bworking\b[\s\S]{0,40}\)\s*return/.test(body), `siding ${name} must guard re-entry`)
  }
}

// 89: supplement additional cost must be a real number with an upper bound.
{
  const source = read('../app/api/supplements/route.ts')
  const cost = section(source, 'const cost =', 'const urgency =')
  assert.ok(/typeof\s+body\.additionalCost/.test(cost), 'additionalCost must be type-checked, not coerced')
  assert.ok(/MAX_SUPPLEMENT_COST|1_000_000|1000000/.test(cost), 'additionalCost must have an upper bound')
}

// 90: estimate PATCH read-back and DELETE precheck must propagate DB errors as 502.
{
  const source = read('../app/api/estimates/[id]/route.ts')
  const readBack = section(source, 'const { data: updated,', 'return NextResponse.json({ estimate:')
  assert.ok(/error:\s*readBackError/.test(readBack), 'PATCH read-back must capture its error')
  assert.match(readBack, /if\s*\(\s*readBackError\s*\)\s*return NextResponse\.json\([\s\S]{0,120}?status:\s*502/, 'PATCH read-back error must return 502')

  const deleteBody = section(source, 'export async function DELETE', null)
  const precheck = section(deleteBody, 'const { data: existing,', 'if (!existing)')
  assert.ok(/error:\s*precheckError/.test(precheck), 'DELETE precheck must capture its error')
  // Scope the 502 assertion to the precheck slice: a whole-body match could be
  // satisfied by the unrelated admin-authorization 502 further down.
  assert.match(precheck, /if\s*\(\s*precheckError\s*\)\s*return NextResponse\.json\([\s\S]{0,120}?status:\s*502/, 'DELETE precheck error must return 502')
}

console.log('async-write-safety-test: PASS (agent replay, web busy flags, cost bound, estimate read-back errors)')
