#!/usr/bin/env node
import assert from 'node:assert/strict'
import net from 'node:net'

export async function checkLocalProviders({ fetchImpl = fetch, sendSmtp, ollamaUrl, twilioUrl }) {
  assert.ok(ollamaUrl && twilioUrl && typeof sendSmtp === 'function', 'ollamaUrl, twilioUrl and sendSmtp are required')
  const ollamaResponse = await fetchImpl(`${ollamaUrl.replace(/\/$/, '')}/api/generate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'llama3.2:1b', prompt: 'Reply with OK', stream: false }),
  })
  assert.ok(ollamaResponse.ok, 'local Ollama generate request failed')
  const ollamaBody = await ollamaResponse.json()
  assert.ok(String(ollamaBody.response ?? '').trim(), 'empty ollama response')

  const smtpOk = await sendSmtp({
    from: 'ci@roof-os.test',
    to: 'capture@roof-os.test',
    subject: 'roof-os free-evidence probe',
    body: 'Synthetic provider probe — not a customer record.',
  })
  assert.equal(smtpOk, true, 'local SMTP delivery failed')

  const twilioResponse = await fetchImpl(twilioUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      authorization: `Basic ${Buffer.from('ACtest:ci-token').toString('base64')}`,
    },
    body: new URLSearchParams({ To: '+15550000001', From: '+15550000002', Body: 'Synthetic provider probe' }),
  })
  assert.ok(twilioResponse.ok, 'local Twilio mock request failed')
  const twilioBody = await twilioResponse.json()
  assert.match(String(twilioBody.sid ?? ''), /^SM/, 'Twilio mock did not return a message sid')

  return { ollama: String(ollamaBody.response).trim(), smtp: smtpOk, twilioSid: twilioBody.sid }
}

function smtpSend({ host, port, from, to, subject, body }) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port })
    let phase = 0
    let buffer = ''
    const next = (line) => socket.write(`${line}\r\n`)
    socket.on('connect', () => {})
    socket.on('data', (chunk) => {
      buffer += chunk.toString()
      while (buffer.includes('\r\n')) {
        const at = buffer.indexOf('\r\n')
        const line = buffer.slice(0, at)
        buffer = buffer.slice(at + 2)
        const code = line.slice(0, 3)
        if (phase === 0 && code === '220') { next('EHLO roof-os-ci'); phase = 1 }
        else if (phase === 1 && code === '250') { next(`MAIL FROM:<${from}>`); phase = 2 }
        else if (phase === 2 && code === '250') { next(`RCPT TO:<${to}>`); phase = 3 }
        else if (phase === 3 && code === '250') { next('DATA'); phase = 4 }
        else if (phase === 4 && code === '354') { next(`Subject: ${subject}\r\n\r\n${body}\r\n.`); phase = 5 }
        else if (phase === 5 && code === '250') { next('QUIT'); socket.end(); resolve(true) }
        else if (/^[45]/.test(code)) { socket.destroy(); reject(new Error(line)) }
      }
    })
    socket.on('error', reject)
  })
}

if (import.meta.url === `file://${process.argv[1]}`) {
  for (const name of ['OLLAMA_URL', 'SMTP_HOST', 'SMTP_PORT', 'TWILIO_MOCK_URL']) {
    assert.ok(process.env[name], `${name} is required`)
  }
  const result = await checkLocalProviders({
    ollamaUrl: process.env.OLLAMA_URL,
    twilioUrl: process.env.TWILIO_MOCK_URL,
    sendSmtp: (message) => smtpSend({ ...message, host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT) }),
  })
  console.log(`ci-local-providers-check: PASS (Ollama=${result.ollama}, SMTP=${result.smtp}, Twilio=${result.twilioSid})`)
}
