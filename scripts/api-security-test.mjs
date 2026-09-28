import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

const source = readFileSync(new URL('../lib/read-json.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText
const { readJson } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`)

function request(body, headers = {}) {
  return new Request('https://roof-os.test/api', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body,
  })
}

assert.deepEqual(await readJson(request('{"name":"roof"}')), { body: { name: 'roof' } })
assert.equal((await readJson(request('[]'))).status, 400, 'arrays are not accepted as request objects')
assert.equal((await readJson(request('{'))).status, 400, 'malformed JSON is rejected')
assert.equal((await readJson(request('{}', { 'content-length': '129' }), 128)).status, 413, 'declared oversize bodies are rejected before reading')

const stream = new ReadableStream({
  start(controller) {
    controller.enqueue(new TextEncoder().encode('{"payload":"'))
    controller.enqueue(new Uint8Array(256).fill(97))
    controller.enqueue(new TextEncoder().encode('"}'))
    controller.close()
  },
})
const chunked = new Request('https://roof-os.test/api', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: stream,
  duplex: 'half',
})
assert.equal((await readJson(chunked, 128)).status, 413, 'chunked oversized bodies are rejected without Content-Length')

console.log('api-security-test: PASS (object shape, malformed JSON, declared and streamed limits)')
