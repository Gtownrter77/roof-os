// Shared, fixed classification helpers for the required field dependency gate.
// Keeping them pure lets scripts/field-deps-audit-contract-test.mjs exercise
// cyclic `via` graphs and malformed npm audit payloads without a network call.
export const BUILD_TOOL_ONLY_PACKAGES = new Set(['metro-config', 'metro-transform-worker'])

export function parseAuditReport(stdout) {
  if (!stdout || !String(stdout).trim()) throw new Error('npm audit produced no output')
  let report
  try { report = JSON.parse(String(stdout)) } catch { throw new Error('npm audit produced unparseable JSON') }
  if (!report || typeof report !== 'object' || Array.isArray(report)) throw new Error('npm audit payload is not an object')
  // A parseable error response or a partial scan is not a clean dependency
  // audit. Failing closed here is what makes this required gate trustworthy.
  if (report.error) throw new Error('npm audit reported an error: ' + String(report.error.code ?? report.error.message ?? 'unknown'))
  if (!report.vulnerabilities || typeof report.vulnerabilities !== 'object' || Array.isArray(report.vulnerabilities)) throw new Error('npm audit payload has no vulnerabilities object')
  const totals = report.metadata?.vulnerabilities
  if (!totals || typeof totals !== 'object' || Array.isArray(totals)) throw new Error('npm audit payload has no metadata totals')
  const reported = Number(totals.total) || ['info', 'low', 'moderate', 'high', 'critical'].reduce((sum, key) => sum + (Number(totals[key]) || 0), 0)
  if (reported > 0 && Object.keys(report.vulnerabilities).length === 0) throw new Error('npm audit payload is truncated: advisories reported but no vulnerability entries')
  return report
}

function source(v) {
  if (!v || typeof v !== 'object') return null
  if (typeof v.source === 'string') return v.source
  if (typeof v.url === 'string') return v.url.split('/').filter(Boolean).at(-1) ?? null
  return null
}

export function advisoriesFor(vulnerabilities, name, visiting = new Set(), cache = new Map()) {
  if (cache.has(name)) return cache.get(name)
  if (visiting.has(name)) return new Set()
  const vuln = vulnerabilities[name]
  if (!vuln) return new Set()
  const next = new Set(visiting)
  next.add(name)
  const found = new Set()
  for (const via of vuln.via ?? []) {
    if (typeof via === 'string') {
      for (const x of advisoriesFor(vulnerabilities, via, next, cache)) found.add(x)
    } else {
      const x = source(via)
      if (x) found.add(x)
    }
  }
  // Only root results are complete. A result computed with a non-empty
  // `visiting` set was truncated by cycle detection for that particular path;
  // caching it caused a later top-level lookup to report `fixed` while an
  // unremediated advisory was still present.
  if (visiting.size === 0) cache.set(name, found)
  return found
}

export function classifyVulnerabilities(vulnerabilities, remediated, buildToolOnlyPackages = BUILD_TOOL_ONLY_PACKAGES) {
  const blocking = [], fixed = []
  const cache = new Map()
  for (const [name, vuln] of Object.entries(vulnerabilities)) {
    if (!['moderate', 'high', 'critical'].includes(vuln.severity)) continue
    const ids = [...advisoriesFor(vulnerabilities, name, new Set(), cache)]
    const unresolved = ids.filter((id) => !remediated(id))
    if (!ids.length && buildToolOnlyPackages.has(name)) {
      fixed.push(name + ' (' + vuln.severity + '): build-tool-only advisory without source ID')
      continue
    }
    if (ids.length && !unresolved.length) fixed.push(name + ' (' + vuln.severity + '): ' + ids.join(', '))
    else blocking.push([name, vuln.severity, unresolved])
  }
  return { blocking, fixed }
}
