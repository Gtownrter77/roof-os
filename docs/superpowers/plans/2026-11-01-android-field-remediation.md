# Android Field App Release and AI Roadmap Implementation Plan

> **For agentic workers:** Use the approved autonomous execution method in this conversation. Each task requires executable tests and fresh CI/build evidence.

**Goal:** Produce a traceable current-main Android APK and raise the field app's reliability, offline usability, accessibility, and safe AI assistance without claiming unimplemented on-device inference.

**Architecture:** Keep the Expo/React Native field client as the offline-first capture surface; use SQLite for durable local records and a workspace-scoped server boundary for synchronization and AI. Build reproducible APKs from a tagged commit, publish checksums and build provenance, and retain a separate internal preview lane from production App Bundles.

**Tech Stack:** Expo SDK 57, React Native 0.86, SQLite, Supabase Auth/Storage/Postgres, GitHub Actions, EAS Build, Node 22.

**Spec:** `apps/field` at current main SHA `b74d23431aa4affcf512710635197bc0e1923256`.

## Global Constraints

- Do not add service-role keys, provider secrets, or credentials to the APK.
- Native offline records must persist across app restarts and failed sync attempts.
- Do not silently discard local drafts/photos on auth expiry or workspace switch.
- AI output is advisory only; a technician must review it and independently verify measurements.
- No automatic estimate approval, insurer submission, customer message, material order, payment, or warranty issuance.
- Keep the 0.4.0 release identity until a deliberate version increment is implemented and proven.
- Maintain Android arm64 compatibility and validate the actual installed APK on a physical device before production release.

## Review Focus

- Airplane mode during photo capture, then network restoration.
- App process killed while a draft/photo is queued.
- Token expiry or workspace switch before queued data is uploaded.
- Duplicate sync retry after a timeout where the server committed but the client missed the response.
- Unsupported camera image encoding, oversized photo, permission denial, or low storage.

---

### Task 1: Make APK build output reproducible and auditable

**Files:**
- Modify: `.github/workflows/mobile-apk.yml`
- Modify: `scripts/mobile-release-check.mjs`
- Create: `scripts/mobile-apk-provenance.mjs`
- Modify: `package.json`

**Interfaces:**
- Build input: explicit tag/ref and exact source SHA.
- Outputs: APK artifact, JSON build manifest, SHA-256 checksum, Expo build ID, app version, Android package, commit SHA, workflow run URL.
- Artifact retention and release publication must be explicit.

- [ ] Add failing release contract tests for ref-to-SHA provenance, checksum generation, version/package identity, and artifact presence.
- [ ] Run the new tests and verify the expected RED result.
- [ ] Update the workflow so a manual build can only use the selected ref and a release tag can produce a signed, traceable APK artifact.
- [ ] Verify the downloaded EAS build matches the requested source commit (not merely the newest finished build).
- [ ] Upload the APK and provenance manifest; compute SHA-256 after download.
- [ ] Run current-main mobile tests and CI; confirm required EAS secret presence before claiming a successful APK.
- [ ] Publish a new release only from a verified tag/build and retain the prior release for rollback.

### Task 2: Field app reliability and offline validation

**Files:**
- Review/modify: `apps/field/App.tsx`
- Review/modify: `apps/field/src/localDb.ts`
- Review/modify: `apps/field/src/localDb.web.ts`
- Review/modify: local sync queue logic and tests
- Tests: `scripts/mobile-offline-sync-test.mjs`, `scripts/mobile-release-check.mjs`

- [ ] Add regressions for persistent draft/photo queue behavior across app restarts and interrupted uploads.
- [ ] Verify local SQLite schema, transaction boundaries, per-user/workspace ownership and safe retry/idempotency.
- [ ] Ensure remote writes are workspace-scoped and client idempotency keys survive retries.
- [ ] Ensure failed photo upload preserves the local original and surfaces a clear retry state.
- [ ] Test auth expiry and workspace changes without leaking or deleting another user's local records.
- [ ] Test permission denied, low storage, corrupt image, large image, and missing Supabase environment.
- [ ] Run CI plus physical Pixel 8 Android install/smoke when a device runner is available.

### Task 3: Add AI automation only where it saves field labor

**Files:**
- Review: `apps/field/src/ai/inference.ts`, `review.ts`, `fieldCoach.ts`
- Integrate only after server endpoint contracts pass: `/api/photo-estimate/analyze`, `/api/ai/transcribe`, inspection-quality worker.
- Tests: AI observation authority, provenance, user review, privacy and offline fallback.

- [ ] Keep on-device inference disabled until a real runtime/model artifact is bundled and loaded; never set readiness flags as a placeholder.
- [ ] Add an AI-assisted photo caption and album suggestion after upload, showing source photo, model/version, confidence and reason.
- [ ] Add a photo completeness assistant that identifies missing evidence categories and asks the technician for the missing angle.
- [ ] Add voice-to-structured inspection notes and numeric measurement transcription, with read-back confirmation before saving.
- [ ] Add estimate prefill only from verified measurements and the workspace price book; keep line items draft-only until a human reviews and approves.
- [ ] Add offline-aware queueing for AI requests; mark pending analysis distinctly and never pretend an offline result is AI.
- [ ] Add operator controls for AI opt-in, data retention, and per-feature disable switches.
- [ ] Capture model/version, input-photo hashes, source IDs, prompt/contract version, confidence and reviewer decisions for auditability.

### Task 4: Accessibility, ergonomics and performance

- [ ] Audit all field controls for accessible labels, roles, hit targets, focus order, screen reader output and high-contrast outdoor use.
- [ ] Reduce image upload payload through orientation-safe compression and background queueing without altering originals.
- [ ] Surface sync status, last successful sync, pending photos, and retry errors in one clear field status panel.
- [ ] Keep important capture controls one-handed and glove-friendly; ensure layouts work on common small Android screens.
- [ ] Measure cold start, photo capture-to-save, local queue writes, sync throughput and crash-free sessions.

### Task 5: Release gate

- [ ] Verify artifact checksum and source commit.
- [ ] Install the built APK on a physical Android device; verify sign-in, capture, airplane-mode save, app restart, reconnection, sync, retry, logout/login and workspace isolation.
- [ ] Compare the installed build's version/package/signature against the provenance manifest.
- [ ] Keep release marked preview until all device and authenticated-production gates have evidence.
