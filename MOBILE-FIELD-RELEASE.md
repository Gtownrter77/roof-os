# ROOF/OS Field Mobile Release 0.4.0

## Current checkpoint — 2026-11-02

**The APK currently published on GitHub is not the current app.** The latest release is [field-apk-main-2501cc2](https://github.com/Gtownrter77/roof-os/releases/tag/field-apk-main-2501cc2), published 2026-10-22 from commit `2501cc20fc5a0e346426a389bbfe46be6aaa44c5`. Current `main` is `b74d23431aa4affcf512710635197bc0e1923256), **119 commits ahead** of that APK source. The existing APK is 78,795,524 bytes and has GitHub asset SHA-256 `580d3ebac4ddc1143c9c5336123a0b7c12fc996185ee4cfdb3bdc77f31ec357b`. It has no companion provenance manifest or published checksum file.

The app source still reports version `0.4.0` and package `com.roofos.field`. No APK has yet been built from the current `main`, no current-main APK binary has been inspected, and no physical-device installation/smoke test has been verified. Do not call the old release current or production-ready.

### Current build pipeline in PR #375

- Manual workflow dispatch builds **protected `main` only**; it no longer accepts an arbitrary branch/ref input.
- A `field-v*` tag builds that exact tag and must match `app.json` version.
- EAS CLI is pinned to `27.2.0`; the build is tied to the checked-out source SHA.
- The workflow generates SHA-256 and a JSON provenance manifest, checks the actual APK package/version with Android build-tools, verifies its APK signature, and records the signing certificate fingerprint.
- APK, checksum and manifest are retained as a 90-day GitHub artifact.
- Tagged internal APK releases are prereleases. The EAS build job has read-only GitHub permission and only exposes `EXPO_TOKEN` to EAS steps; a separate artifact-only job receives release-write permission.
- The workflow has not yet produced a current APK. `EXPO_TOKEN` presence is unverified through this connection.

### Current app capability assessment

Implemented: Supabase Auth with SecureStore session persistence, owner-scoped local drafts, SQLite offline capture and retry queue, NetInfo reconnect handling, camera/photo capture, private Storage paths, manual measurements, inspection verification, lead/appointment/task context, and workspace-scoped sync checks.

Not yet implemented as working field AI: the mobile inference adapter is intentionally disabled (`runtimeAvailable=false`, `modelLoaded=false`); the model version is unavailable. `fieldCoach.ts` is deterministic guidance, not an AI model. The server photo-analysis route is workspace-admin gated and depends on configured Ollama vision; the voice-transcription route is feature-flagged but the mobile app has no recording/transcription UI. The AI modules are not integrated into the field capture flow.

Highest-value next AI work: (1) missing-evidence/elevation checklist, (2) photo captions and album suggestions with technician review, (3) voice-to-structured notes with read-back, (4) OCR for product labels/receipts/claim documents, and (5) estimate draft prefill from human-verified measurements and price books. AI must never certify measurements, approve estimates, decide claims/code, or send customer communications automatically.

### Remaining release gates

1. Final PR-head CI green, including migrations 075–078 and Android release contracts.
2. EAS build from current protected `main` with `EXPO_TOKEN`.
3. Inspect generated APK package/version, signature/certificate, source SHA, checksum and manifest.
4. Install on a physical Android device and test sign-in, offline capture, process kill/restart, reconnect, retries, auth expiry, workspace switch, camera/location permissions and low-storage handling.
5. Confirm Vercel production deployment SHA and authenticated API/runtime compatibility.

---

## Release scope

The Expo field app now provides an authenticated, offline-first inspection capture pilot. Sessions require Supabase authentication and persist credentials through `expo-secure-store`. Inspection drafts, measurements, and photo queue metadata persist in SQLite so a field worker can continue capture without a network connection.

When a workspace connection is available, the app resolves the authenticated workspace through `current_workspace_id`, creates an RLS-scoped `inspection_sessions` record, syncs manual measurements as explicitly unverified evidence, and uploads queued camera files into the private `inspection-photos` bucket using a workspace/user/inspection path. Photo metadata is inserted only after the Storage upload succeeds. The UI keeps estimate and report approval review-gated and labels GPS and manual measurements honestly.

The release also persists the latest draft location, provides sign-in/sign-out states, exposes queued-work sync and retry-now, makes checklist rows interactive and screen-reader addressable, and adds release checks for the mobile security boundary. The app version is `0.4.0`.

## Three-level verification

| Level | Result | Evidence |
| --- | --- | --- |
| Static | PASS | `npx tsc --noEmit`, `npx expo config --json`, `node scripts/mobile-release-check.mjs`, existing `security-check.mjs`, and `photo-estimate-flow-test.mjs` |
| Runtime | PASS where locally executable | Expo web export is the runtime smoke target; native camera/GPS/storage behavior requires an EAS device build and real device permissions. Root web build and TypeScript checks are included in CI. |
| Data/security | PASS for repository evidence; deployment confirmation required | 24 ordered migrations, workspace membership RLS policies, private Storage bucket policies, and no committed server secrets. A two-workspace live test must still be run against the deployed Supabase project before commercial release. |

## Required deployment configuration

Set `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, and `EXPO_PUBLIC_WEB_APP_URL` in the EAS build environment. Apply the repository migrations to the target Supabase project. Use a real authenticated account to verify offline reopen, multi-photo upload, retry behavior, and cross-workspace isolation on representative iOS and Android devices.

This release is a **shippable internal/pilot field app**, not a claim-approved estimating product. It does not certify measurements, approve estimates, send customer communications, or replace the required human review workflow.


## 2026-10-04 APK build path — superseded 2026-11-02

The original manual EAS workflow has been replaced by the protected, provenance-producing workflow described in the current checkpoint above. Manual builds now target `main` only; version tags trigger internal prereleases. The current workflow requires an `EXPO_TOKEN` Actions secret and has not yet produced a new APK.


## 2026-10-04 clean-install bundle fix

The Android EAS bundle failure was reproduced locally. A clean `npm ci` created a broken link for the repository's vendored `braces` mitigation, and the vendored package could not resolve `fill-range`. The field app now keeps the mitigation package under `apps/field/vendor/braces`, points the npm override to that field-local package, and declares `fill-range` explicitly in the field dependencies. A fresh `npm ci` now loads `braces` and completes `npx expo export:embed --eager --platform android --dev false` successfully.

## 0.3.0 hardening batch — 2026-10-04

Exactly three mobile weaknesses were addressed:

1. All owner-scoped local inspection drafts are now recoverable and selectable instead of only the latest draft being loaded.
2. NetInfo connectivity transitions trigger queue retry; offline state prevents false sync claims while existing idempotency keys prevent duplicates.
3. Technician name, optional license, verification time, and notes persist locally and sync to the RLS-protected `inspection_verifications` table. This is not a signature or manager approval and cannot approve a customer report.

Static, runtime bundle, and repository security checks passed. A signed EAS APK artifact remains the final delivery gate.


## 0.4.0 hardening batch — 2026-10-05
This batch completed three integration steps:
1. Added CI and release guards for migrations 050–051, including technician verification and complete field measurement columns.
2. Expanded the deterministic mobile contract checks and aligned the real-device E2E preconditions through migration 052.
3. Verified Expo configuration and the Android bundle embed locally; the signed APK still requires the existing EAS workflow with `EXPO_TOKEN`.

The field app version is now `0.4.0`.

## APK artifact verification — 2026-10-04

The manual EAS workflow completed successfully on commit `bd922eefed812471b026e243c0939c04e25b4557`.

- GitHub Actions run: `37257872937`
- Artifact: `roof-os-field-preview-apk`
- Downloaded APK SHA-256: `453dcf1c51b59d415fcd28cf174fc7ccaf2afe1bcd7caac425fa9a95003597d5`
- APK archive integrity: PASS

This proves the signed/internal APK artifact was produced. It does not replace a real-device authenticated smoke test or the production Supabase two-workspace RLS test.
