// Simulation tests for automations 126-150
// Run with: npx tsx src/ai/batch126to150.sim.ts

import {
  draftMaterialMatch,
  draftTearOff,
  draftDeckRepair,
  draftPipeBoots,
  draftRidgeVent,
  draftSoffit,
  draftFascia,
  draftGutterGuard,
  draftSkylightFlash,
  draftSatellite,
  draftSolar,
  draftChimneyCap,
  draftCricket,
  draftIceBarrier,
  draftUnderlaymentType,
  draftNailPattern,
  draftWasteFactor,
  draftLaborCrew,
  draftDuration,
  draftStaging,
  draftSafetyHarness,
  draftDumpFee,
  draftPermitCost,
  draftFinalWalk,
  draftReviewRequest,
} from './batch126to150'

let passed = 0
let failed = 0

function assert(cond: boolean, msg: string) {
  if (cond) {
    passed++
    console.log('  PASS:', msg)
  } else {
    failed++
    console.error('  FAIL:', msg)
  }
}

function run(name: string, fn: () => void) {
  console.log('\n' + name)
  fn()
}

run('126 draftMaterialMatch', () => {
  assert(draftMaterialMatch('architectural shingle').match === 'Architectural shingle', 'architectural')
  assert(draftMaterialMatch('3-tab').match === '3-tab shingle', '3-tab')
  assert(draftMaterialMatch('metal roof').match === 'Metal', 'metal')
  assert(draftMaterialMatch('tile').match === 'Tile', 'tile')
  assert(draftMaterialMatch('standard').match === 'Standard', 'standard')
  assert(draftMaterialMatch('').match === 'Unknown', 'empty')
  assert(draftMaterialMatch('anything').requiresApproval === true, 'approval')
})

run('127 draftTearOff', () => {
  assert(draftTearOff('tear off old').needed === true, 'tear')
  assert(draftTearOff('remove existing').needed === true, 'remove')
  assert(draftTearOff('overlay').needed === false, 'no tear')
  assert(draftTearOff('').requiresApproval === true, 'approval')
})

run('128 draftDeckRepair', () => {
  assert(draftDeckRepair('deck damage').flagged === true, 'deck')
  assert(draftDeckRepair('plywood soft').flagged === true, 'plywood')
  assert(draftDeckRepair('osb').flagged === true, 'osb')
  assert(draftDeckRepair('good deck').flagged === true, 'deck word')
  assert(draftDeckRepair('clean').flagged === false, 'clean')
})

run('129 draftPipeBoots', () => {
  assert(draftPipeBoots('4 boots').count === 4, 'explicit count')
  assert(draftPipeBoots('boots needed').count === 2, 'mention only')
  assert(draftPipeBoots('no pipes').count === 0, 'none')
  assert(draftPipeBoots('').count === 0, 'empty')
})

run('130 draftRidgeVent', () => {
  assert(draftRidgeVent(20).lf === 40, '20 squares')
  assert(draftRidgeVent(0).lf === 0, 'zero')
  assert(draftRidgeVent(-5).lf === 0, 'negative clamped')
})

run('131 draftSoffit', () => {
  assert(draftSoffit('soffit rotten').needed === true, 'needed')
  assert(draftSoffit('clean').needed === false, 'not')
})

run('132 draftFascia', () => {
  assert(draftFascia('fascia boards').needed === true, 'needed')
  assert(draftFascia('none').needed === false, 'not')
})

run('133 draftGutterGuard', () => {
  assert(draftGutterGuard('gutter clogged').suggest === true, 'suggest')
  assert(draftGutterGuard('no gutters').suggest === true, 'gutter word')
  assert(draftGutterGuard('clean').suggest === false, 'not')
})

run('134 draftSkylightFlash', () => {
  assert(draftSkylightFlash().action.includes('skylight'), 'action')
  assert(draftSkylightFlash().requiresApproval === true, 'approval')
})

run('135 draftSatellite', () => {
  assert(draftSatellite('satellite dish').present === true, 'satellite')
  assert(draftSatellite('dish').present === true, 'dish')
  assert(draftSatellite('none').present === false, 'none')
})

run('136 draftSolar', () => {
  assert(draftSolar('solar panels').present === true, 'present')
  assert(draftSolar('none').present === false, 'none')
})

run('137 draftChimneyCap', () => {
  assert(draftChimneyCap().needed === true, 'always')
})

run('138 draftCricket', () => {
  assert(draftCricket(6).needed === true, 'pitch 6')
  assert(draftCricket(8).needed === true, 'pitch 8')
  assert(draftCricket(5).needed === false, 'pitch 5')
})

run('139 draftIceBarrier', () => {
  assert(draftIceBarrier('OH').needed === true, 'OH')
  assert(draftIceBarrier('ny').needed === true, 'ny lower')
  assert(draftIceBarrier('FL').needed === false, 'FL')
  assert(draftIceBarrier('').needed === false, 'empty')
})

run('140 draftUnderlaymentType', () => {
  assert(draftUnderlaymentType(3).type === 'Double layer', 'low pitch')
  assert(draftUnderlaymentType(6).type === 'Synthetic', 'normal')
})

run('141 draftNailPattern', () => {
  assert(draftNailPattern('high').pattern === '6-nail', 'high')
  assert(draftNailPattern('normal').pattern === '4-nail', 'normal')
})

run('142 draftWasteFactor', () => {
  assert(draftWasteFactor(6, 2).percent === 15, '6+2')
  assert(draftWasteFactor(0, 0).percent === 10, 'zero')
  assert(draftWasteFactor(-1, -1).percent === 10, 'clamped')
})

run('143 draftLaborCrew', () => {
  assert(draftLaborCrew(31).crew === 5, 'large')
  assert(draftLaborCrew(20).crew === 3, 'normal')
  assert(draftLaborCrew(30).crew === 3, 'boundary')
})

run('144 draftDuration', () => {
  assert(draftDuration(15).days === 1, '15')
  assert(draftDuration(16).days === 2, '16')
  assert(draftDuration(0).days === 1, 'zero min')
  assert(draftDuration(-10).days === 1, 'negative min')
})

run('145 draftStaging', () => {
  assert(draftStaging(2).needed === true, '2 stories')
  assert(draftStaging(1).needed === false, '1 story')
})

run('146 draftSafetyHarness', () => {
  assert(draftSafetyHarness(6).required === true, 'pitch 6')
  assert(draftSafetyHarness(5).required === false, 'pitch 5')
})

run('147 draftDumpFee', () => {
  assert(draftDumpFee(20).estimate === 160, '20')
  assert(draftDumpFee(0).estimate === 0, 'zero')
  assert(draftDumpFee(-5).estimate === 0, 'clamped')
})

run('148 draftPermitCost', () => {
  assert(draftPermitCost().estimate === 150, 'fixed')
  assert(draftPermitCost().requiresApproval === true, 'approval')
})

run('149 draftFinalWalk', () => {
  const items = draftFinalWalk().items
  assert(items.length === 3, 'three items')
  assert(items.includes('Clean up'), 'clean up')
  assert(items.includes('Magnet sweep'), 'magnet')
  assert(items.includes('Customer walk'), 'walk')
})

run('150 draftReviewRequest', () => {
  assert(draftReviewRequest('Alice').text.includes('Alice'), 'name')
  assert(draftReviewRequest('').text.includes('Customer'), 'empty name')
  assert(draftReviewRequest('  ').text.includes('Customer'), 'whitespace')
  assert(draftReviewRequest('Bob').requiresApproval === true, 'approval')
})

console.log('\n========================================')
console.log(`Results: ${passed} passed, ${failed} failed`)
console.log('========================================')

if (failed > 0) {
  process.exit(1)
}
process.exit(0)
