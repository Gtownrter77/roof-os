# ROOF/OS Field Mobile Release 0.2.0

## Release scope

The Expo field app now provides an authenticated, offline-first inspection capture pilot. Sessions require Supabase authentication and persist credentials through `expo-secure-store`. Inspection drafts, measurements, and photo queue metadata persist in SQLite so a field worker can continue capture without a network connection.

When a workspace connection is available, the app resolves the authenticated workspace through `current_workspace_id`, creates an RLS-scoped `inspection_sessions` record, syncs manual measurements as explicitly unverified evidence, and uploads queued camera files into the private `inspection-photos` bucket using a workspace/user/inspection path. Photo metadata is inserted only after the Storage upload succeeds. The UI keeps estimate and report approval review-gated and labels GPS and manual measurements honestly.

The release also persists the latest draft location, provides sign-in/sign-out states, exposes queued-work sync, makes checklist rows interactive and screen-reader addressable, and adds release checks for the mobile security boundary. The app version is `0.2.0`.

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


## 2026-10-04 EAS artifact download correction

EAS CLI 24.10.0 does not support `build:download --latest --path`. The APK workflow now requests JSON from the completed build, extracts the returned build ID, downloads with `build:download --build-id`, normalizes the downloaded `.apk` name, and uploads it as the GitHub Actions artifact.
