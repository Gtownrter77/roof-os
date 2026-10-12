import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'

const port = 4100
const base = `http://127.0.0.1:${port}`
const child = spawn('npm', ['run', 'start'], {
  env: {
    ...process.env,
    PORT: String(port),
    NEXT_PUBLIC_SUPABASE_URL: 'https://validation.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'validation-only-key',
    SUPABASE_SERVICE_ROLE_KEY: 'validation-only-service-role-key',
  },
  detached: true,
  stdio: ['ignore', 'pipe', 'pipe'],
})

let logs = ''
child.stdout.on('data', (chunk) => { logs += chunk.toString() })
child.stderr.on('data', (chunk) => { logs += chunk.toString() })

async function waitForServer() {
  const deadline = Date.now() + 30_000
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${base}/manus-routes.json`)
      if (response.status === 200) return
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error(`Production server did not become ready.\n${logs}`)
}

try {
  await waitForServer()

  const manifest = await fetch(`${base}/manus-routes.json`)
  assert.equal(manifest.status, 200, 'standalone server must serve the route manifest')
  const manifestJson = await manifest.json()
  assert.ok(Array.isArray(manifestJson.routes), 'route manifest must contain routes')
  assert.ok(manifestJson.routes.some((route) => route.path === '/'), 'route manifest must include the dashboard')

  const status = await fetch(`${base}/api/status`)
  assert.equal(status.status, 200, 'status health must return a usable response')
  const statusJson = await status.json()
  assert.ok(['operational', 'degraded'].includes(statusJson.overall), 'status health must report operational or degraded')

  const dashboard = await fetch(base, { headers: { accept: 'text/html' } })
  assert.ok([200, 307, 308].includes(dashboard.status), `dashboard must not return a server error (got ${dashboard.status})`)

  console.log('runtime-smoke-test: PASS (standalone public assets, status health, and dashboard response)')
} finally {
  if (child.pid) {
    try { process.kill(-child.pid, 'SIGTERM') } catch {}
    await new Promise((resolve) => setTimeout(resolve, 300))
    try { process.kill(-child.pid, 'SIGKILL') } catch {}
  }
}
