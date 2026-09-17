import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const root = new URL('..', import.meta.url).pathname
const config = readFileSync(join(root, 'next.config.ts'), 'utf8')
if (!config.includes('Content-Security-Policy') || !config.includes('X-Content-Type-Options')) {
  throw new Error('Required security headers are missing from next.config.ts')
}

const routes = []
function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) walk(path)
    else if (entry.name === 'route.ts') routes.push(path)
  }
}
walk(join(root, 'app', 'api'))
const protectedWorkspaceRoutes = routes.filter((path) => /claims|measurements|pricing|storms/.test(path))
for (const route of protectedWorkspaceRoutes) {
  const source = readFileSync(route, 'utf8')
  if (!source.includes('requireWorkspaceMember')) {
    throw new Error(`Workspace authorization helper missing from ${route}`)
  }
}

const forbidden = /(?:SUPABASE_SERVICE_ROLE_KEY|CAPOUT_API_KEY|RAPIDAPI_KEY)\s*=\s*(?!your_|server_only_|validation-only-)[A-Za-z0-9_\-./]+/g
for (const path of routes) {
  const source = readFileSync(path, 'utf8')
  if (forbidden.test(source)) throw new Error(`Possible hard-coded secret in ${path}`)
}
console.log(`release-check passed: ${protectedWorkspaceRoutes.length} protected routes, security headers, and secret scan verified`)
