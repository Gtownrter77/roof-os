import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const root = new URL('..', import.meta.url).pathname
const appRoot = join(root, 'app')
const routeFiles = []
const sourceFiles = []

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) walk(path)
    else if (entry.endsWith('.tsx')) sourceFiles.push(path)
  }
}

walk(appRoot)
for (const path of sourceFiles) {
  if (path.endsWith('/page.tsx')) {
    const routePath = relative(appRoot, path.replace(/\/page\.tsx$/, ''))
    routeFiles.push(routePath ? `/${routePath}` : '/')
  }
}

const routeMatches = (route, target) => {
  const pattern = route.replace(/\[\[\.\.\.([^\]]+)\]\]/g, '.*').replace(/\[([^\]]+)\]/g, '[^/]+')
  const matchesConcreteRoute = new RegExp(`^${pattern}$`).test(target)
  const matchesDynamicPrefix = route.includes('/[') && target === `${route.slice(0, route.indexOf('/['))}/`
  return matchesConcreteRoute || matchesDynamicPrefix
}
const actualRoutes = routeFiles.sort()
const missing = []
const targetPattern = /router\.(?:push|replace)\(\s*(['"`])([^'"`]+)\1/g

for (const path of sourceFiles) {
  const source = readFileSync(path, 'utf8')
  for (const match of source.matchAll(targetPattern)) {
    const target = match[2].split(/[?#]/, 1)[0]
    if (target.startsWith('/') && !actualRoutes.some((route) => routeMatches(route, target))) {
      missing.push(`${relative(root, path)} -> ${target}`)
    }
  }
}

assert.deepEqual(missing, [], `Navigation targets must resolve to existing pages:\n${missing.join('\n')}`)
console.log(`frontend-route-integrity-test: PASS (${actualRoutes.length} page routes, no missing literal router targets)`)
