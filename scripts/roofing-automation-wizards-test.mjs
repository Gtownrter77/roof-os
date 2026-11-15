import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  DEFAULT_ROOFING_WORKFLOW_PREFS,
  ROOFING_WORKFLOW_PREFS_KEY,
  canAutoLookupAddress,
  validateRoofingWorkflowPreferences,
} from '../lib/roofing-workflow-preferences.ts'

assert.deepEqual(DEFAULT_ROOFING_WORKFLOW_PREFS, {
  autoAddressLookup: false,
  selectSingleFootprint: false,
  showReviewChecklist: true,
})
assert.match(ROOFING_WORKFLOW_PREFS_KEY, /roofing-workflow-preferences/)
assert.deepEqual(validateRoofingWorkflowPreferences(null), DEFAULT_ROOFING_WORKFLOW_PREFS)
assert.deepEqual(validateRoofingWorkflowPreferences({ autoAddressLookup: 'true', selectSingleFootprint: 1 }), DEFAULT_ROOFING_WORKFLOW_PREFS)
const optIn = validateRoofingWorkflowPreferences({
  autoAddressLookup: true,
  selectSingleFootprint: true,
  showReviewChecklist: true,
  forceExecute: true,
})
assert.equal('forceExecute' in optIn, false)
assert.equal(canAutoLookupAddress('123 Main St, GA', optIn), true)
assert.equal(canAutoLookupAddress('short', optIn), false)
assert.equal(canAutoLookupAddress('123 Main St, GA', DEFAULT_ROOFING_WORKFLOW_PREFS), false)
assert.equal(canAutoLookupAddress('A'.repeat(241), optIn), false)

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const prefsUi = read('components/RoofingWorkflowSettings.tsx')
assert.match(prefsUi, /saveRoofingWorkflowPreferences/)
assert.match(prefsUi, /Automatic address lookup/)
assert.match(prefsUi, /Off by default/)
assert.match(prefsUi, /Saved on this browser only/)
assert.match(prefsUi, /Reset roofing automation settings/)
assert.doesNotMatch(prefsUi, /service.role|upsert\(/)

const navigation = read('components/RoofingWizardNavigator.tsx')
for (const route of ['/measure','/sketch','/estimate/new','/supplement','/supplement/review','/settings']) {
  assert.ok(navigation.includes("href: '" + route + "'"), 'missing route ' + route)
}
assert.match(navigation, /showReviewChecklist/)
assert.match(navigation, /No automatic carrier submissions or material orders/)

const screens = [
  'app/settings/page.tsx',
  'app/measure/page.tsx',
  'app/sketch/page.tsx',
  'app/supplement/page.tsx',
  'app/estimate/new/page.tsx',
  'app/onboarding/workspace/page.tsx',
  'app/onboarding/agents/page.tsx',
  'app/ai-wizard/page.tsx',
  'app/manual/page.tsx',
  'app/photo-estimate/page.tsx',
  'app/supplement/review/page.tsx',
]
for (const page of screens) {
  const source = read(page)
  assert.match(source, /<RoofingWizardNavigator/, 'wizard navigator missing in ' + page)
}
for (const page of ['app/settings/page.tsx','app/measure/page.tsx','app/sketch/page.tsx','app/supplement/page.tsx','app/onboarding/workspace/page.tsx']) {
  assert.match(read(page), /<RoofingWorkflowSettings/, 'settings panel missing in ' + page)
}
const measure = read('app/measure/page.tsx')
assert.match(measure, /canAutoLookupAddress\(address, automationPrefs\)/)
assert.match(measure, /setTimeout\(\(\) => \{ void lookupImagery\(\) \}, 1200\)/)
assert.match(measure, /lookupSeqRef\.current/)
assert.match(measure, /requestSeq !== lookupSeqRef\.current/)
assert.match(measure, /selectSingleFootprint && candidates\.length === 1/)
assert.match(measure, /Automatic measurement readiness checks/)
assert.match(measure, /Start estimate with this address/)
assert.match(measure, /Continue this address in supplement wizard/)
assert.match(read('app/estimate/new/page.tsx'), /searchParams\.get\('address'\)/)
const supplement = read('app/supplement/page.tsx')
assert.match(supplement, /URLSearchParams\(window\.location\.search\)\.get\('address'\)/)
assert.match(supplement, /Automatic supplement draft completeness check/)
assert.match(supplement, /copyReviewSummary/)
assert.match(supplement, /readyCount !== readiness\.length/)
assert.match(supplement, /NOT SENT TO INSURER/)
assert.match(supplement, /owner_entered_unverified/)
assert.doesNotMatch(supplement, /additionalCost: (?:2500|1800|3200)/)
console.log('Roofing automation settings and all linked wizard contracts PASS')
