import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

function loadTypeScript(relativePath, imports = {}) {
  const source = readFileSync(new URL(relativePath, import.meta.url), 'utf8')
  const code = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText
  const loaded = { exports: {} }
  const localRequire = (name) => {
    if (Object.hasOwn(imports, name)) return imports[name]
    throw new Error(`Unexpected test import: ${name}`)
  }
  new Function('require', 'module', 'exports', code)(localRequire, loaded, loaded.exports)
  return loaded.exports
}

const geometryContract = loadTypeScript('../lib/ai/geometry-contract.ts')
const localVision = loadTypeScript('../lib/ai/local-vision-browser.ts', { './geometry-contract': geometryContract })
const quantityMath = loadTypeScript('../lib/measurements/calibrated-roof-draft.ts')

const baseSuggestion = {
  contract_version: geometryContract.GEOMETRY_CONTRACT_VERSION,
  image_width: 1000,
  image_height: 800,
  source_image_reference: 'synthetic-browser-fixture',
  planes: [{ id: 'plane-1', vertices: [{ x: 100, y: 100 }, { x: 600, y: 100 }, { x: 600, y: 500 }, { x: 100, y: 500 }], suggested_pitch: null, confidence: 'low' }],
  edges: [{ id: 'edge-1', start: { x: 100, y: 500 }, end: { x: 600, y: 500 }, classification: 'eave', confidence: 'low' }],
  objects: [],
  warnings: ['Synthetic fixture only.'],
}

const oldFetch = globalThis.fetch
const oldWindow = globalThis.window
const oldEndpoint = process.env.NEXT_PUBLIC_OLLAMA_VISION_API_BASE_URL
const oldModel = process.env.NEXT_PUBLIC_OLLAMA_VISION_MODEL
const oldBtoa = globalThis.btoa
try {
  globalThis.window = { setTimeout, clearTimeout }
  globalThis.btoa = globalThis.btoa ?? ((value) => Buffer.from(value, 'binary').toString('base64'))
  process.env.NEXT_PUBLIC_OLLAMA_VISION_API_BASE_URL = 'http://localhost:11434/v1/'
  process.env.NEXT_PUBLIC_OLLAMA_VISION_MODEL = 'qwen3-vl:test'

  let requestUrl
  let requestInit
  globalThis.fetch = async (url, init) => {
    requestUrl = url
    requestInit = init
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(baseSuggestion) } }] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }
  const fixture = {
    type: 'image/png',
    size: 4,
    arrayBuffer: async () => Uint8Array.from([1, 2, 3, 4]).buffer,
  }
  const result = await localVision.analyzeRoofImageWithLocalOllama(fixture, 1000, 800)
  assert.equal(requestUrl, 'http://localhost:11434/v1/chat/completions')
  assert.equal(requestInit.method, 'POST')
  assert.equal(new Headers(requestInit.headers).get('content-type'), 'application/json')
  assert.equal(new Headers(requestInit.headers).get('authorization'), null)
  const requestBody = JSON.parse(requestInit.body)
  assert.equal(requestBody.model, 'qwen3-vl:test')
  assert.deepEqual(requestBody.response_format, { type: 'json_object' })
  assert.equal(requestBody.messages[0].content[1].image_url.url, 'data:image/png;base64,AQIDBA==')
  assert.equal(result.suggestion.planes[0].id, 'plane-1')
  assert.equal(result.model, 'qwen3-vl:test')

  globalThis.fetch = async () => new Response(JSON.stringify({ choices: [{ message: { content: '{}' } }] }), { status: 200 })
  await assert.rejects(
    localVision.analyzeRoofImageWithLocalOllama(fixture, 1000, 800),
    /failed the ROOF\/OS contract/,
  )

  process.env.NEXT_PUBLIC_OLLAMA_VISION_API_BASE_URL = 'https://api.openai.com/v1'
  await assert.rejects(
    localVision.analyzeRoofImageWithLocalOllama(fixture, 1000, 800),
    /Local-only vision accepts only a loopback URL/,
  )

  process.env.NEXT_PUBLIC_OLLAMA_VISION_API_BASE_URL = 'http://localhost:11434/v1'
  globalThis.fetch = async () => { throw new TypeError('Failed to fetch') }
  await assert.rejects(
    localVision.analyzeRoofImageWithLocalOllama(fixture, 1000, 800),
    /no hosted AI fallback is used/i,
  )
} finally {
  globalThis.fetch = oldFetch
  if (oldWindow === undefined) delete globalThis.window
  else globalThis.window = oldWindow
  if (oldBtoa === undefined) delete globalThis.btoa
  else globalThis.btoa = oldBtoa
  if (oldEndpoint === undefined) delete process.env.NEXT_PUBLIC_OLLAMA_VISION_API_BASE_URL
  else process.env.NEXT_PUBLIC_OLLAMA_VISION_API_BASE_URL = oldEndpoint
  if (oldModel === undefined) delete process.env.NEXT_PUBLIC_OLLAMA_VISION_MODEL
  else process.env.NEXT_PUBLIC_OLLAMA_VISION_MODEL = oldModel
}

const rectangle = [{ x: 100, y: 100 }, { x: 600, y: 100 }, { x: 600, y: 500 }, { x: 100, y: 500 }]
const draft = quantityMath.calculateCalibratedRoofDraft({
  planes: [{ vertices: rectangle, review_status: 'accepted' }],
  scaleReferencePixels: 100,
  scaleReferenceFeet: 10,
  pitchRisePer12: 6,
  orthographicTopDownConfirmed: true,
  uniformPitchConfirmed: true,
  geometryConfirmed: true,
})
assert.equal(draft.acceptedPlaneCount, 1)
assert.equal(draft.pixelsPerFoot, 10)
assert.equal(draft.planAreaSqFt, 2000)
assert.equal(draft.roofAreaSqFt, 2236.07)
assert.equal(draft.roofSquares, 22.36)
assert.throws(() => quantityMath.calculateCalibratedRoofDraft({
  planes: [{ vertices: rectangle, review_status: 'accepted' }],
  scaleReferencePixels: 100,
  scaleReferenceFeet: 10,
  pitchRisePer12: 6,
  orthographicTopDownConfirmed: false,
  uniformPitchConfirmed: true,
  geometryConfirmed: true,
}), /top-down and orthographic/)
assert.throws(() => quantityMath.calculateCalibratedRoofDraft({
  planes: [{ vertices: rectangle, review_status: 'pending' }],
  scaleReferencePixels: 100,
  scaleReferenceFeet: 10,
  pitchRisePer12: 6,
  orthographicTopDownConfirmed: true,
  uniformPitchConfirmed: true,
  geometryConfirmed: true,
}), /Review every suggested roof plane/)
assert.throws(() => quantityMath.calculateCalibratedRoofDraft({
  planes: [{ vertices: rectangle, review_status: 'accepted' }],
  scaleReferencePixels: 100,
  scaleReferenceFeet: 10,
  pitchRisePer12: 6,
  orthographicTopDownConfirmed: true,
  uniformPitchConfirmed: false,
  geometryConfirmed: true,
}), /applies to every accepted/)
assert.throws(() => quantityMath.calculateCalibratedRoofDraft({
  planes: [{ vertices: rectangle, review_status: 'accepted' }],
  scaleReferencePixels: 100,
  scaleReferenceFeet: 10,
  pitchRisePer12: 6,
  orthographicTopDownConfirmed: true,
  uniformPitchConfirmed: true,
  geometryConfirmed: false,
}), /Confirm reviewed geometry/)

const autoMeasurementUi = readFileSync(new URL('../components/AutoMeasurementTool.tsx', import.meta.url), 'utf8')
assert.match(autoMeasurementUi, /localhost:11434/)
assert.match(autoMeasurementUi, /qwen3-vl:8b/)
assert.match(autoMeasurementUi, /does not include an Ollama server on Android by default/)
assert.match(autoMeasurementUi, /Trace roof manually/)
assert.doesNotMatch(autoMeasurementUi, /Google Gemini/)

const deploymentGuide = readFileSync(new URL('../DEPLOYMENT.md', import.meta.url), 'utf8')
assert.match(deploymentGuide, /Windows 10\/11 \(PowerShell\)/)
assert.match(deploymentGuide, /SetEnvironmentVariable\("OLLAMA_ORIGINS"/)
assert.match(deploymentGuide, /ollama pull qwen3-vl:8b/)
assert.match(deploymentGuide, /Invoke-RestMethod http:\/\/localhost:11434\/api\/tags/)
assert.match(deploymentGuide, /Do not use.*\*.*do not expose port 11434/s)

console.log('auto-measurement-local-and-quantity-test: PASS (loopback-only browser inference, image payload, no remote fallback, validated geometry, orthographic/scale/pitch gates, draft area and squares)')
