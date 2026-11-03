import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { readFileSync, statSync, writeFileSync } from 'node:fs'
import { basename, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

function requiredEnv(name) {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  return value
}

const [apkArg, manifestArg] = process.argv.slice(2)
if (!apkArg || !manifestArg) {
  throw new Error('Usage: node mobile-apk-provenance.mjs <apk-path> <manifest-path>')
}

const apkPath = resolve(apkArg)
const manifestPath = resolve(manifestArg)
const sourceSha = requiredEnv('SOURCE_SHA')
const sourceRef = requiredEnv('SOURCE_REF')
const buildId = requiredEnv('EAS_BUILD_ID')
const easCliVersion = requiredEnv('EAS_CLI_VERSION')
const appVersion = requiredEnv('APP_VERSION')
const androidPackage = requiredEnv('ANDROID_PACKAGE')

const checkoutSha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
if (checkoutSha !== sourceSha) {
  throw new Error(`Checkout SHA mismatch: expected ${sourceSha}, found ${checkoutSha}`)
}

const appJsonPath = resolve(fileURLToPath(new URL('../apps/field/app.json', import.meta.url)))
const appJson = JSON.parse(readFileSync(appJsonPath, 'utf8'))
if (appJson.expo.version !== appVersion || appJson.expo.android.package !== androidPackage) {
  throw new Error('APK manifest identity does not match apps/field/app.json')
}

const apkBytes = readFileSync(apkPath)
if (apkBytes.length === 0) throw new Error('Downloaded APK is empty')
const sha256 = createHash('sha256').update(apkBytes).digest('hex')
const sizeBytes = statSync(apkPath).size

// Verify the artifact itself, not only the EAS job metadata. This catches a
// wrong package, stale version, unsigned/corrupt APK, or mismatched release.
const androidBuildTools = requiredEnv('ANDROID_BUILD_TOOLS')
const aapt = resolve(androidBuildTools, 'aapt')
const apksigner = resolve(androidBuildTools, 'apksigner')
const badging = execFileSync(aapt, ['dump', 'badging', apkPath], { encoding: 'utf8' })
const packageMatch = badging.match(/^package: name='([^']+)' versionCode='([^']+)' versionName='([^']+)'/m)
if (!packageMatch) throw new Error('Android package metadata could not be read from the APK')
const [, binaryPackage, binaryVersionCode, binaryVersion] = packageMatch
if (binaryPackage !== androidPackage) {
  throw new Error(`APK package mismatch: expected ${androidPackage}, found ${binaryPackage}`)
}
if (binaryVersion !== appVersion) {
  throw new Error(`APK version mismatch: expected ${appVersion}, found ${binaryVersion}`)
}
const signatureReport = execFileSync(apksigner, ['verify', '--verbose', '--print-certs', apkPath], { encoding: 'utf8' })
const certificateMatch = signatureReport.match(/Signer #1 certificate SHA-256 digest: ([a-f0-9:]+)/i)
if (!certificateMatch) throw new Error('APK signing certificate SHA-256 fingerprint is missing')
const signingCertificateSha256 = certificateMatch[1].replaceAll(':', '').toLowerCase()
const workflowUrl = process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY && process.env.GITHUB_RUN_ID
  ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
  : null

const manifest = {
  artifact: basename(apkPath),
  app: 'ROOF/OS Field',
  appVersion,
  androidPackage,
  platform: 'android',
  artifactType: 'internal-preview-apk',
  sizeBytes,
  sha256,
  signingCertificateSha256,
  binary: {
    packageName: binaryPackage,
    versionCode: binaryVersionCode,
    versionName: binaryVersion,
    signatureVerified: true,
  },
  source: {
    repository: process.env.GITHUB_REPOSITORY ?? null,
    ref: sourceRef,
    commit: sourceSha,
  },
  build: {
    provider: 'Expo Application Services',
    profile: 'preview',
    buildId,
    easCliVersion,
  },
  workflow: {
    url: workflowUrl,
    runId: process.env.GITHUB_RUN_ID ?? null,
    runAttempt: process.env.GITHUB_RUN_ATTEMPT ?? null,
  },
  generatedAt: new Date().toISOString(),
}

writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'w' })
writeFileSync(`${apkPath}.sha256`, `${sha256}  ${basename(apkPath)}\n`, { flag: 'w' })
console.log(`APK provenance written: ${sha256} (${sizeBytes} bytes, source ${sourceSha}, EAS build ${buildId})`)
