# Field Capture Wiring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the merged Hover capture contract reachable from the offline field app and carry its evidence through upload into `scan_images` and `scale_anchors`.

**Architecture:** A slot picker and reference-anchor entry feed a local SQLite queue; a WebView-canvas sampler computes normalised blur/light scores; pure mappers turn queued rows into `ScanImage`/`ScaleAnchor` values for the existing `validateCapture`; the Hover ingest route auto-creates a 1:1 `scan_jobs` row per inspection draft and derives GPS status from the byte-verifying authority.

**Tech Stack:** Expo 57 / React Native 0.86, expo-sqlite, react-native-webview canvas, Next.js route handlers, Supabase Postgres/RLS, Node test scripts.

**Spec:** `docs/superpowers/specs/2026-11-23-field-capture-wiring-design.md`

## Global Constraints

- GPS must be embedded in the photo file; the server derives `gps_in_file` from byte verification, never from a client flag.
- `Unknown` stays `Unknown`; null blur/light scores remain unscored, never a pass.
- No measurement is published from an incomplete or unanchored capture; downstream metric gates do the blocking.
- Do not change the merged `validateCapture` or `buildInputManifest` contracts or their tests.
- Migration 112 adds only `inspection_photos` columns; migration 111 already owns Hover tables and RLS.
- New migration is forward-only; applied migrations are never edited.
- Free/OSS only; no paid API, licensed data feed, GPU rental or commercial engine.
- Every behavior change is RED → GREEN → REFACTOR with recorded output; commit after each verified task.

## Review Focus

1. **A model photo captured without a slot or with embedded-GPS stamping failure** → it must stay evidence-only and be rejected by validation | `field-hover-capture-test.mjs` in Task 3.
2. **Recapturing a slot that failed blur/light** → old row is superseded, new row owns the slot, no duplicate-slot deadlock | `field-hover-capture-test.mjs` in Task 3.
3. **Client claims `gps_in_file = true` without server verification** → ingest derives status from the provenance authority and rejects unverified model photos | `field-hover-ingest-test.mjs` in Task 5.
4. **Retried anchor sync after a network failure** → idempotency key prevents duplicate `scale_anchors` rows | `field-hover-ingest-test.mjs` in Task 5.
5. **Blue/green release where the hosted migration has not been applied** → field upload must not claim Hover metadata was accepted; migration-112 governance gates must name the new head | `field-hover-migration-test.mjs` in Task 4 and `npm run test:all`.

---

### Task 1: Local queue schema and web shim

**Files:**
- Modify: `apps/field/App.tsx` (`ensureLocalColumns` list near line 198; `CREATE TABLE` near line 197)
- Modify: `apps/field/src/localDb.web.ts`
- Test: `scripts/field-hover-schema-test.mjs` (new)

**Interfaces:**
- Consumes: existing `ensureLocalColumns(db, strings[])` pattern.
- Produces: `inspection_photo_queue.hover_slot TEXT`, `gps_verified INTEGER NOT NULL DEFAULT 0`, `blur_score REAL`, `light_score REAL`, `superseded_at TEXT`, `superseded_reason TEXT`; new table `inspection_hover_anchors (id INTEGER PRIMARY KEY AUTOINCREMENT, draft_id INTEGER NOT NULL, client_id TEXT NOT NULL UNIQUE, kind TEXT NOT NULL, observed_value REAL NOT NULL, unit TEXT NOT NULL, captured_at TEXT NOT NULL)`; same contract in the web shim.

- [ ] **Step 1: Write the failing test** in `scripts/field-hover-schema-test.mjs`: assert `apps/field/App.tsx` contains each `ALTER TABLE inspection_photo_queue ADD COLUMN` for the six columns and the `inspection_hover_anchors` CREATE TABLE; assert `apps/field/src/localDb.web.ts` declares the same columns and table names; assert defaults are `0` for `gps_verified` and no default makes a photo GPS-verified.
- [ ] **Step 2:** Run `node scripts/field-hover-schema-test.mjs`; expected FAIL (missing columns).
- [ ] **Step 3:** Add the columns and table to both native and web paths using the existing patterns; keep `gps_verified` default 0.
- [ ] **Step 4:** Run `node scripts/field-hover-schema-test.mjs` and `npm run test:field-localdb-web`; expected PASS.
- [ ] **Step 5:** Commit: `git add apps/field/App.tsx apps/field/src/localDb.web.ts scripts/field-hover-schema-test.mjs && git commit -m "feat(field): add Hover slot, quality and anchor local schema"`.

### Task 2: Quality scoring helper

**Files:**
- Create: `lib/hover/field-quality.ts`
- Test: `scripts/field-hover-quality-test.mjs` (new)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `scorePixels(pixels: Uint8ClampedArray, width: number, height: number): { blurScore: number; lightScore: number }` over a grayscale 64×64 sample; both outputs in `[0,1]`; `{ blurScore: 0, lightScore: 0 }` for non-finite or empty input.

- [ ] **Step 1:** Write the failing test asserting: a uniform mid-grey 64×64 image returns `blurScore === 1` (zero Laplacian variance maps to maximum sharpness), a checkerboard returns a lower blur score, a black image returns `lightScore === 0` and a white image `lightScore === 1`, and empty input returns zeros.
- [ ] **Step 2:** Run `node --experimental-strip-types scripts/field-hover-quality-test.mjs`; expected FAIL (module missing).
- [ ] **Step 3:** Implement `scorePixels` with normalised variance of the 3×3 Laplacian and mean luminance; document the normalisation constants in the file.
- [ ] **Step 4:** Run the same test; expected PASS.
- [ ] **Step 5:** Commit: `git add lib/hover/field-quality.ts scripts/field-hover-quality-test.mjs && git commit -m "feat(hover): add on-device quality scoring helper"`.

### Task 3: Capture UI, anchor entry and validation feedback

**Files:**
- Modify: `apps/field/App.tsx` (`capturePhoto` near line 732; draft detail render near line 1227)
- Create: `lib/hover/field-capture.ts`
- Test: `scripts/field-hover-capture-test.mjs` (new)

**Interfaces:**
- Consumes: `scorePixels` from Task 2; `validateCapture`, `CAPTURE_SLOTS`, `ScanImage`, `ScaleAnchor`, `SlotId` from `lib/hover/types.ts` / `lib/hover/capture.ts`; queue columns from Task 1.
- Produces: `toScanImages(rows: FieldPhotoRow[]): ScanImage[]`; `toScaleAnchors(rows: FieldAnchorRow[]): ScaleAnchor[]`; `supersedeSlot(draftId: number, slot: SlotId): void` (SQL contract only in the source test).

- [ ] **Step 1:** Write the failing test asserting: `toScanImages` maps `hover_slot` to `slot`, `gps_verified` to `gpsInFile` with no client override, and null scores stay `null`; `toScaleAnchors` maps kind/value/unit and uses fixed `confidence: 1` for owner-entered references; a source assertion that `supersedeSlot` issues `UPDATE inspection_photo_queue SET superseded_at = ?, superseded_reason = ? WHERE draft_id = ? AND hover_slot = ? AND superseded_at IS NULL`; a source assertion that `validateCapture` is called in the draft detail render.
- [ ] **Step 2:** Run `node --experimental-strip-types scripts/field-hover-capture-test.mjs`; expected FAIL.
- [ ] **Step 3:** Implement the two pure mappers in `lib/hover/field-capture.ts`, add slot state and a reference-anchor panel to `App.tsx`, wire the WebView canvas sampler to `scorePixels` with a `null` fallback on any error, add `supersedeSlot` before inserting a recaptured photo, and render `validateCapture(...).reason`.
- [ ] **Step 4:** Run `node --experimental-strip-types scripts/field-hover-capture-test.mjs` and `npm run typecheck`; expected PASS.
- [ ] **Step 5:** Commit: `git add apps/field/App.tsx lib/hover/field-capture.ts scripts/field-hover-capture-test.mjs && git commit -m "feat(field): wire Hover slot capture, anchors and validation feedback"`.

### Task 4: Migration 112 and governance

**Files:**
- Create: `supabase/migrations/112_inspection_photos_hover_fields.sql`
- Modify: `scripts/release-foreman-check.mjs`, `README.md`, `DEPLOYMENT.md`, `.github/workflows/ci.yml`
- Test: `scripts/field-hover-migration-test.mjs` (new)

**Interfaces:**
- Consumes: `inspection_photos` table from migration 003; Hover tables from 111.
- Produces: columns `hover_slot text`, `blur_score double precision`, `light_score double precision` on `public.inspection_photos`; no new Hover tables; documented head `112_inspection_photos_hover_fields.sql` with 110 migration files.

- [ ] **Step 1:** Write the failing test asserting the new migration file exists, adds exactly those three `alter table public.inspection_photos add column` statements, contains no `create table` for `scan_*`/`scale_anchors`, and that README, DEPLOYMENT, CI and `release-foreman-check.mjs` name head 112 and count 110.
- [ ] **Step 2:** Run `node scripts/field-hover-migration-test.mjs`; expected FAIL.
- [ ] **Step 3:** Add the forward-only migration and update the four governed metadata locations. Do not edit migration 111.
- [ ] **Step 4:** Run `node scripts/field-hover-migration-test.mjs && node scripts/release-foreman-check.mjs && node scripts/gate-registry-integrity-test.mjs`; expected PASS.
- [ ] **Step 5:** Commit: `git add supabase/migrations/112_inspection_photos_hover_fields.sql scripts/release-foreman-check.mjs README.md DEPLOYMENT.md .github/workflows/ci.yml scripts/field-hover-migration-test.mjs && git commit -m "feat(hover): add inspection photo metadata migration 112"`.

### Task 5: Ingest auto-job and metadata mapping

**Files:**
- Create: `lib/hover/field-ingest.ts`
- Modify: `app/api/hover/ingest/route.ts`
- Test: `scripts/field-hover-ingest-test.mjs` (new)

**Interfaces:**
- Consumes: `ScanImage`, `ScaleAnchor` from Task 3; `buildInputManifest` from `lib/hover/manifest.ts`.
- Produces: `anchorIdempotencyKey(workspaceId: string, draftId: string, anchor: ScaleAnchor): string`; `mapInspectionPhoto(photo: InspectionPhotoRow, verifiedGpsInFile: boolean): ScanImage`; `newJobForDraft(draft: InspectionDraftRow): { workspace_id: string; capture_mode: 'exterior'; deliverable: 'full_exterior'; sla_tier: 'visual-twin' }`.

- [ ] **Step 1:** Write the failing test asserting: `mapInspectionPhoto` ignores any client GPS claim and uses the `verifiedGpsInFile` argument, preserves `slot`/`blur_score`/`light_score`, and leaves null scores null; `anchorIdempotencyKey` is stable across calls and changes when value or unit changes; `newJobForDraft` pins the three enum values above. Add a source assertion that `app/api/hover/ingest/route.ts` checks server verification before inserting `scan_images` and calls `buildInputManifest`.
- [ ] **Step 2:** Run `node --experimental-strip-types scripts/field-hover-ingest-test.mjs`; expected FAIL.
- [ ] **Step 3:** Implement the pure helpers, then extend the POST body to accept `inspectionDraftId`: look up the draft, create a job when none exists, upsert `scan_images` from uploaded rows using server-derived GPS status, upsert `scale_anchors` by idempotency key, then call the existing manifest builder. Keep the current `jobId` path unchanged.
- [ ] **Step 4:** Run `node --experimental-strip-types scripts/field-hover-ingest-test.mjs`, `npm run typecheck` and `npm run test:hover`; expected PASS.
- [ ] **Step 5:** Commit: `git add lib/hover/field-ingest.ts app/api/hover/ingest/route.ts scripts/field-hover-ingest-test.mjs && git commit -m "feat(hover): auto-create scan job and map field metadata on ingest"`.

### Task 6: Field upload sends metadata

**Files:**
- Modify: `apps/field/App.tsx` (`syncDraft` query near line 989 and `inspection_photos` upsert near line 1005)
- Test: `scripts/field-hover-upload-test.mjs` (new)

**Interfaces:**
- Consumes: queue columns from Task 1; ingest behavior from Task 5.
- Produces: upsert payload containing `hover_slot`, `blur_score`, `light_score`; a post-upload call to `/api/hover/ingest` with `inspectionDraftId`; no `gps_in_file` field in the outgoing photo payload.

- [ ] **Step 1:** Write the failing source test asserting the queued-photo SELECT includes the three new columns, the upsert object includes them, no `gps_in_file` key is sent from the client, and the sync function calls `/api/hover/ingest` with `inspectionDraftId` after the last photo is uploaded.
- [ ] **Step 2:** Run `node scripts/field-hover-upload-test.mjs`; expected FAIL.
- [ ] **Step 3:** Extend the query and upsert, add the ingest call after the upload loop, and leave metadata local if the network fails (existing retry path remains the authority).
- [ ] **Step 4:** Run `node scripts/field-hover-upload-test.mjs`, `npm run typecheck`; expected PASS.
- [ ] **Step 5:** Commit: `git add apps/field/App.tsx scripts/field-hover-upload-test.mjs && git commit -m "feat(field): upload Hover slot and quality metadata"`.

### Task 7: Full verification and merge

**Files:**
- Modify: `HANDOFF.md`, `.superpowers/sdd/.../progress.md` ledger copy under `docs/superpowers/plans/`
- Test: `npm run test:all`

- [ ] **Step 1:** Run `npm run test:all`; expected `PASS (160+ registered gates + 4 build/release checks)`, exit 0.
- [ ] **Step 2:** Run `npm run test:hover && npm run typecheck && npm run build && npm run release-check`; record exact output and BUILD_ID.
- [ ] **Step 3:** Record the 15-skill audit and evidence in `HANDOFF.md` and a task-specific ledger under `docs/superpowers/plans/`; commit.
- [ ] **Step 4:** Push the branch, verify local/remote SHA match, open a PR, wait for `web`, `mobile`, `migration-safety`, `field-security`, then squash-merge and verify remote `main`.
- [ ] **Step 5:** Report the final SHA and the still-unverified hosted-migration/device evidence. No production-readiness claim.
