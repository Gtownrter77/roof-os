import assert from 'node:assert/strict'
import { checkLocalProviders } from './ci/local-provider-check.mjs'

{
  const calls = []
  const fetchImpl = async (url, init) => {
    calls.push({ url, method: init?.method })
    if (url.includes('/api/generate')) {
      return { ok: true, json: async () => ({ response: 'OK' }) }
    }
    return { ok: true, json: async () => ({ sid: 'SM1234567890' }) }
  }
  let smtpMessage
  const sendSmtp = async (message) => { smtpMessage = message; return true }
  const result = await checkLocalProviders({
    fetchImpl,
    sendSmtp,
    ollamaUrl: 'http://127.0.0.1:11434',
    twilioUrl: 'http://127.0.0.1:6060/2010-04-01/Accounts/ACtest/Messages.json',
  })
  assert.deepEqual(result, { ollama: 'OK', smtp: true, twilioSid: 'SM1234567890' })
  assert.equal(calls.length, 2)
  assert.match(calls[0].url, /11434\/api\/generate/)
  assert.match(calls[1].url, /Messages\.json/)
  assert.ok(smtpMessage.subject.includes('free-evidence'))
}

{
  const fetchImpl = async () => ({ ok: true, json: async () => ({ response: 'OK' }) })
  const sendSmtp = async () => { throw new Error('smtp refused') }
  await assert.rejects(
    checkLocalProviders({ fetchImpl, sendSmtp, ollamaUrl: 'http://x', twilioUrl: 'http://y' }),
    (error) => /smtp refused/.test(String(error.message)),
  )
}

{
  const fetchImpl = async (url) => ({
    ok: true,
    json: async () => (url.includes('generate') ? { response: '' } : { sid: 'SM123' }),
  })
  const sendSmtp = async () => true
  await assert.rejects(
    checkLocalProviders({ fetchImpl, sendSmtp, ollamaUrl: 'http://x', twilioUrl: 'http://y' }),
    (error) => /empty ollama/i.test(String(error.message)),
  )
}

console.log('ci-local-providers-test: PASS (Ollama, SMTP, Twilio mock paths checked with fail-closed assertions)')
