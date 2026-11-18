# ROOF/OS Field Mobile Release 0.5.0


## Current checkpoint — 2026-11-18

**Current `main`:** `99792955cf69fb56c6473e3050b7d96dd9a31040` (PR #485, Gradle retry/timeouts). Parent Metro repair is `7008e22f05bb566674ab38aa333c7c38c811c42b` (PR #483). Required CI on both SHAs passed: web, mobile, field-security, migration-safety, preview-build, Vercel.

**Current APK artifact (source `7008e22`):** workflow [run 44404219619](https://github.com/Gtownrter77/roof-os/actions/runs/44404219619) succeeded. Artifact `roof-os-field-preview-7008e22f05bb566674ab38aa333c7c38c811c42b`. Version `0.5.0`, package `com.roofos.field`, version code `42`, size `73,559,240` bytes. SHA-256 `d94e7fe1657a3041dd155d42ff5c253938542389f8e2b0ac7b46b2be8c7c404f` (local download matched the provenance file). Signing certificate SHA-256 `7a1c64b0a0bdae5ac87aef821ee7d6a6a56a6ec21ef53c249149b8e90b74868f`. EAS CLI `27.2.0`. Signature verified. This is a GitHub Actions artifact, not a new `field-v*` GitHub Release.

**APK rebuild of current `main` `9979295`:** workflow [run 44406863550](https://github.com/Gtownrter77/roof-os/actions/runs/44406863550) started on the merge push. Do not treat it as successful until the run completes and a new SHA-256 exists.

**What broke, then what was repaired:** PRs #478–#480 taught `apps/field/App.tsx` to import `../../lib/photo-provenance.mjs`. EAS bundling starts in `apps/field`, so Metro could not resolve that file (`Unable to resolve module`). `apps/field/metro.config.cjs` now watches the repo root and includes `.mjs`. After Metro succeeded (716 modules), the first push APK on `7008e22` ([run 44400175072](https://github.com/Gtownrter77/roof-os/actions/runs/44400175072)) failed resolving `kotlin-stdlib:2.2.21` and retries reused Gradle's negative cache. PR #485 writes 120s Maven HTTP timeouts into `gradle.properties` and wipes `$HOME/.gradle/caches` between attempts. A clean dispatch of the Metro SHA then produced the artifact above.

**Older binaries:** GitHub Release [field-apk-main-6976341](https://github.com/Gtownrter77/roof-os/releases/tag/field-apk-main-6976341) remains the latest *release tag* (2026-11-09, version code `15`). Prior successful workflow artifact was [run 44197803638](https://github.com/Gtownrter77/roof-os/actions/runs/44197803638) from `8bb00b6` (version code `29`).

The app source reports version `0.5.0` and package `com.roofos.field`. Physical-device install and two-workspace live test remain separate unverified gates.

### Current build pipeline


- Manual workflow dispatch builds **protected `main` only**; it no longer accepts an arbitrary branch/ref input.
- A `field-v*` tag builds that exact tag and must match `app.json` version.
- EAS CLI is pinned to `27.2.0`; the build is tied to the checked-out source SHA.
- The workflow generates SHA-256 and a JSON provenance manifest, checks the actual APK package/version with Android build-tools, verifies its APK signature, and records the signing certificate fingerprint.
- APK, checksum and manifest are retained as a 90-day GitHub artifact.
- Tagged internal APK releases are prereleases. The EAS build job has read-only GitHub permission and only exposes `EXPO_TOKEN` to EAS steps; a separate artifact-only job receives release-write permission.
- The workflow produced APK run `44404219619` from `7008e22` (version code `42`). `EXPO_TOKEN` is present in Actions (the successful local EAS build used it). The preview profile increments the remote Android build number so an internal APK can update an existing installation. Physical-device install remains unverified.

### Current app capability assessment

Implemented: Supabase Auth with SecureStore session persistence, owner-scoped local drafts, SQLite offline capture and retry queue, NetInfo reconnect handling, camera/photo capture, private Storage paths, manual measurements, inspection verification, lead/appointment/task context, and workspace-scoped sync checks.

Not yet implemented as working field AI: the mobile inference adapter is intentionally disabled (`runtimeAvailable=false`, `modelLoaded=false`); the model version is unavailable. `fieldCoach.ts` is deterministic guidance, not an AI model. The server photo-analysis route is workspace-admin gated and depends on configured Ollama vision; the voice-transcription route is feature-flagged but the mobile app has no recording/transcription UI. The AI modules are not integrated into the field capture flow.

Highest-value next AI work: (1) missing-evidence/elevation checklist, (2) photo captions and album suggestions with technician review, (3) voice-to-structured notes with read-back, (4) OCR for product labels/receipts/claim documents, and (5) estimate draft prefill from human-verified measurements and price books. AI must never certify measurements, approve estimates, decide claims/code, or send customer communications automatically.

### Remaining release gates

1. Final PR-head CI green — **done** for PRs #483 and #485 (web, mobile, field-security, migration-safety, preview-build, Vercel).
2. EAS build from protected `main` with `EXPO_TOKEN` — **done** for SHA `7008e22` (run `44404219619`). Rebuild of `9979295` is a later run.
3. Inspect generated APK package/version, signature/certificate, source SHA, checksum and manifest — **done** for the `7008e22` artifact (version code `42`, SHA-256 recorded above).
4. Install on a physical Android device and test sign-in, offline capture, process kill/restart, reconnect, retries, auth expiry, workspace switch, camera/location permissions and low-storage handling — **UNVERIFIED**.
5. Confirm Vercel production deployment SHA and authenticated API/runtime compatibility — **UNVERIFIED** for the current SHA.

---


**Current checkpoint — 2026-11-03:** The source and Expo configuration report version `0.5.0`. The most recent successful APK workflow run is #39739973454 (2026-10-22), built from `9f65193`; it predates current main `b74d234`. This release updates the APK to the current field-app source, including initialized on-device SQLite tables, clearer offline retry/queue feedback, and the removal of legacy mobile AI screens that are no longer in the system source. The sync indicator now advances only after a complete successful sync, and pending photos/measurements are counted as pending items. These are source/CI behaviors only; a new successful APK artifact, authenticated physical-device capture, offline reopen, private upload, and two-workspace test are still required.


## Release scope

The Expo field app now provides an authenticated, offline-first inspection capture pilot. Sessions require Supabase authentication and persist credentials through `expo-secure-store`. Inspection drafts, measurements, and photo queue metadata persist in SQLite so a field worker can continue capture without a network connection.

When a workspace connection is available, the app resolves the authenticated workspace through `current_workspace_id`, creates an RLS-scoped `inspection_sessions` record, syncs manual measurements as explicitly unverified evidence, and uploads queued camera files into the private `inspection-photos` bucket using a workspace/user/inspection path. Photo metadata is inserted only after the Storage upload succeeds. The UI keeps estimate and report approval review-gated and labels GPS and manual measurements honestly.

The release also persists the latest draft location, provides sign-in/sign-out states, exposes queued-work sync and retry-now, makes checklist rows interactive and screen-reader addressable, and adds release checks for the mobile security boundary. The app version is `0.5.0`.




The internal preview profile explicitly produces an APK and increments its remote Android build number so it can be installed as an update. This follows Expo's guidance for [building APKs](https://docs.expo.dev/build-reference/apk/) and [remote app version management](https://docs.expo.dev/versions/v57.0.0/build-reference/app-versions.md).


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


## 0.5.0 hardening batch — 2026-10-05
This batch completed three integration steps:
1. Added CI and release guards for migrations 050–051, including technician verification and complete field measurement columns.
2. Expanded the deterministic mobile contract checks and aligned the real-device E2E preconditions through migration 052.
3. Verified Expo configuration and the Android bundle embed locally; the signed APK still requires the existing EAS workflow with `EXPO_TOKEN`.

The field app version is now `0.5.0`.

## APK artifact verification — 2026-10-04

The manual EAS workflow completed successfully on commit `bd922eefed812471b026e243c0939c04e25b4557`.

- GitHub Actions run: `37257872937`
- Artifact: `roof-os-field-preview-apk`
- Downloaded APK SHA-256: `453dcf1c51b59d415fcd28cf174fc7ccaf2afe1bcd7caac425fa9a95003597d5`
- APK archive integrity: PASS

This proves the signed/internal APK artifact was produced. It does not replace a real-device authenticated smoke test or the production Supabase two-workspace RLS test.
