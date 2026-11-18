import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const register = JSON.parse(readFileSync('docs/contractor-os/PHASE-0-REQUIREMENT-REGISTER.json', 'utf8'))
const allowedStatuses = new Set(register.statusVocabulary)

function assertUnique(items, label) {
  const ids = items.map((item) => item.id)
  assert.equal(new Set(ids).size, ids.length, `${label} IDs must be unique`)
}

function assertValidStatuses(items, label) {
  for (const item of items) {
    assert.ok(item.id && item.title, `${label} entries require id and title`)
    assert.ok(allowedStatuses.has(item.status), `${label} ${item.id} has invalid status ${item.status}`)
    assert.ok(item.source || label !== 'sections', `${label} ${item.id} requires a source reference`)
  }
}

assert.equal(register.authority.document, 'ContractorOS_Unified_Master_Dossier.pdf')
assert.equal(register.sections.length, 38, 'dossier section register must contain all 38 sections')
assert.equal(register.workPackages.length, 24, 'work-package register must contain all 24 packages')
assert.equal(register.releases.length, 9, 'release register must contain all 9 releases')
assert.equal(register.aiFunctions.length, 20, 'AI-function register must contain all 20 functions')
assert.equal(register.gates.length, 12, 'completion-gate register must contain all 12 gates')

for (const [items, label] of [
  [register.sections, 'sections'],
  [register.workPackages, 'work packages'],
  [register.releases, 'releases'],
  [register.aiFunctions, 'AI functions'],
  [register.gates, 'gates'],
]) {
  assertUnique(items, label)
  assertValidStatuses(items, label)
}

const releaseIds = new Set(register.releases.map((release) => release.id))
for (const workPackage of register.workPackages) {
  assert.ok(releaseIds.has(workPackage.release), `${workPackage.id} must map to a registered release`)
}

for (const prefix of ['SEC-', 'WP-', 'REL-', 'AI-', 'GATE-']) {
  const collection = prefix === 'SEC-' ? register.sections
    : prefix === 'WP-' ? register.workPackages
      : prefix === 'REL-' ? register.releases
        : prefix === 'AI-' ? register.aiFunctions
          : register.gates
  assert.ok(collection.every((item) => item.id.startsWith(prefix)), `${prefix} collection IDs must use the stable prefix`)
}

console.log(`phase-0-register-test: PASS (${register.sections.length} sections, ${register.workPackages.length} work packages, ${register.releases.length} releases, ${register.aiFunctions.length} AI functions, ${register.gates.length} gates)`)
