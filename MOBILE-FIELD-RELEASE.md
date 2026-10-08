# ROOF/OS Field Mobile Release 0.2.0

## Release scope

The Expo field app now provides an authenticated, offline-first inspection capture pilot. Sessions require Supabase authentication and persist credentials through `expo-secure-store`. Inspection drafts, measurements, and photo queue metadata persist in SQLite so a field worker can continue capture without a network connection.

When a workspace connection is available, the app resolves the authenticated workspace through `current_workspace_id`, creates an RLS-scoped `inspection_sessions` record, syncs manual measurements as explicitly unverified evidence, and uploads queued camera files into the private `inspection-photos` bucket using a workspace/user/inspection path. Photo metadata is inserted only after the Storage upload succeeds. The UI keeps estimate and report approval review-gated and labels GPS and manual measurements honestly.

The release also persists the latest draft location, provides sign-in/sign-out states, exposes queued-work sync, makes checklist rows interactive and screen-reader addressable, and adds release checks for the mobile security boundary. The app version is `0.2.0`.

## Top-Level AI Automated Features Integrated in Field App

1. **AI Vision Damage Contract (Gemini AI Integration):**
   - Strictly structured schema contract for analyzing roof & siding photos.
   - Extracts pitch estimation, shingle type/wear, facet detection, and storm damage tagging.
   - Output rules enforce non-authoritative claims (never output raw pitch degrees or binding carrier coverage decisions directly without human approval).

2. **Inspection Quality Agent (Agent 3):**
   - Automatically evaluates photo batch completeness upon upload from the field app.
   - Detects missing required categories (e.g. pitch gauge, drip edge, hail damage) or uncaptioned photos.
   - Automatically generates an idempotent review task for the inspector when evidence is incomplete.

3. **Offline Resilient AI Queue:**
   - Field photos and local notes captured offline in SQLite are automatically processed upon network reconnection.
   - AI vision processing and feature extraction run through an authenticated backend route without exposing API keys to the mobile client.

4. **Speech-to-Text Voice Site Notes:**
   - Integrated Web Speech API / MediaRecorder interface allowing field technicians to dictate site notes hands-free, auto-categorized into inspection findings.

5. **AI Receptionist & Inbound Lead Bridge:**
   - Automated Twilio voice/SMS receptionist AI captures customer reports and populates inspection leads directly into the field inspector's task queue.

## Three-level verification

| Level | Result | Evidence |
| --- | --- | --- |
| Static | PASS | `npx tsc --noEmit`, `npx expo config --json`, `node scripts/mobile-release-check.mjs`, existing `security-check.mjs`, and `photo-estimate-flow-test.mjs` |
| Runtime | PASS where locally executable | Expo web export is the runtime smoke target; native camera/GPS/storage behavior requires an EAS device build and real device permissions. Root web build and TypeScript checks are included in CI. |
| Data/security | PASS for repository evidence; deployment confirmation required | 24 ordered migrations, workspace membership RLS policies, private Storage bucket policies, and no committed server secrets. A two-workspace live test must still be run against the deployed Supabase project before commercial release. |

## Required deployment configuration

Set `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, and `EXPO_PUBLIC_WEB_APP_URL` in the EAS build environment. Apply the repository migrations to the target Supabase project. Use a real authenticated account to verify offline reopen, multi-photo upload, retry behavior, and cross-workspace isolation on representative iOS and Android devices.

This release is a **shippable internal/pilot field app**, not a claim-approved estimating product. It does not certify measurements, approve estimates, send customer communications, or replace the required human review workflow.


## 2026-10-04 APK build path

A manual GitHub Actions workflow now provides the repeatable APK path:

```text
.github/workflows/mobile-apk.yml
```

Run it from GitHub Actions with the branch or commit to build. It installs the field app, runs TypeScript and Expo configuration checks, starts an EAS Android preview build, waits for completion, downloads the APK, and uploads `roof-os-field-preview.apk` as a workflow artifact retained for 14 days.

The repository must have an `EXPO_TOKEN` Actions secret with permission to build this Expo project. The workflow does not print the token. A successful workflow run with the uploaded artifact is the APK verification evidence; creating the workflow alone is not an APK build.


## 2026-10-04 clean-install bundle fix

The Android EAS bundle failure was reproduced locally. A clean `npm ci` created a broken link for the repository's vendored `braces` mitigation, and the vendored package could not resolve `fill-range`. The field app now keeps the mitigation package under `apps/field/vendor/braces`, points the npm override to that field-local package, and declares `fill-range` explicitly in the field dependencies. A fresh `npm ci` now loads `braces` and completes `npx expo export:embed --eager --platform android --dev false` successfully.

## 0.3.0 hardening batch — 2026-10-04

Exactly three mobile weaknesses were addressed:

1. All owner-scoped local inspection drafts are now recoverable and selectable instead of only the latest draft being loaded.
2. NetInfo connectivity transitions trigger queue retry; offline state prevents false sync claims while existing idempotency keys prevent duplicates.
3. Technician name, optional license, verification time, and notes persist locally and sync to the RLS-protected `inspection_verifications` table. This is not a signature or manager approval and cannot approve a customer report.

Static, runtime bundle, and repository security checks passed. A signed EAS APK artifact remains the final delivery gate.

## APK artifact verification — 2026-10-04

The manual EAS workflow completed successfully on commit `bd922eefed812471b026e243c0939c04e25b4557`.

- GitHub Actions run: `37257872937`
- Artifact: `roof-os-field-preview-apk`
- Downloaded APK SHA-256: `453dcf1c51b59d415fcd28cf174fc7ccaf2afe1bcd7caac425fa9a95003597d5`
- APK archive integrity: PASS

This proves the signed/internal APK artifact was produced. It does not replace a real-device authenticated smoke test or the production Supabase two-workspace RLS test.
