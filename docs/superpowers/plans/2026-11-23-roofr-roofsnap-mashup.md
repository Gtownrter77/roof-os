# Roofr + RoofSnap Measurement Mashup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a dedicated second page with two separate measurement uses — Auto (Roofr-like, existing Ollama path) and Manual (RoofSnap-like, hand-traced) — where both produce authoritative, lockable quantities; Manual polygons are persisted and area is server-recomputed so the browser can never supply the number.

**Architecture:** Manual traces are stored as `aerial_measurements` rows with `measurement_source='manual_traced'` plus `roof_planes` rows (human-drawn, accepted). The existing `PATCH /api/measurements/aerial` calibrate/confirm chain supplies scale + top-down + pitch attestations unchanged. A new POST persists the trace; the existing `POST /api/measurements/manual` is generalized so both `ai_formulated` and `manual_traced` sources call one shared pure recompute helper and reject stale client areas. No new math engine, no new pipeline, no paid services.

**Tech Stack:** Next.js App Router + TypeScript, Supabase (Postgres/RLS), existing `calculateCalibratedRoofDraft` / `validateGeometrySuggestion`, Leaflet `ManualDrawingTool`, local Ollama, Node source-contract gates.

**Spec:** `docs/superpowers/specs/2026-11-23-roofr-roofsnap-mashup-design.md`
**Owner ruling:** option (b) — both methods authoritative; `EXACT-WORKFLOW.md:31` amended.

## Global Constraints

- Free/open-source only: no paid imagery, API, GPU, hosted inference, or dependency requiring payment.
- Both Auto and Manual produce authoritative, lockable/sendable quantities through the same review → owner-lock → gated-send chain.
- No client authority: a hand-traced area is never accepted from the browser; area is recomputed on the server from persisted vertices + scale + pitch; stale/client area rejected (tolerance 0.05 sq ft).
- Provenance anchor: a GPS-certified photo (`gps_verified=true`, `gps_address` present, bytes match) is required for any authoritative measurement. No GPS ⇒ evidence only; no measurement starts.
- Attestations before authority: scale calibrated + `orthographic_top_down_confirmed=true` + pitch confirmed (uniform or per-plane reviewed 0–36). Missing ⇒ `Unknown`, unconfirmed, not lockable.
- `Unknown` stays `Unknown`; no guessed values; no dollar amounts in reports.
- `app/api/photo-estimate/report/route.ts` is unchanged.
- No ESX/SKP/DWG binaries or support.
- Migration 113 is forward-only, additive, and follows 112; head becomes `113_manual_traced_measurements.sql`, migration count 111.
- Reuse existing tables and math; do not create a second measurement table or pipeline.
- Every new gate is registered in `package.json` and wired into `.github/workflows/ci.yml` web job; `release-foreman-check` / `gate-registry-integrity-test` / `test-all-coverage-test` must stay green.
- every task ends with a commit; use TDD RED → GREEN.

## Review Focus

- Client submits a fake `roofAreaSqft` that disagrees with persisted geometry → must be rejected as stale. Test: `manual-trace-recompute-test` stale-rejection case + `manual-trace-persistence-test` branch assertion (Task 3).
- Hand-traced polygon is self-intersecting, out of image bounds, or has <3 vertices → must be rejected before persistence. Test: `manual-trace-persistence-test` invalid-geometry cases (Task 4).
- Trace lacks scale calibration or top-down/pitch attestation → must not become authoritative or lockable. Test: `manual-trace-recompute-test` attestation cases (Task 3).
- A different workspace or non-creator reads/attests another tech's trace → RLS + `created_by`/workspace scoping must block. Test: persistence route scoping assertions (Task 4).
- Paid dependency, licensed-imagery source, report-route change, or missing doctrine amendment sneaks in → must be absent. Test: `manual-trace-contract-test` (Task 5).

---

### Task 1: Doctrine amendment + 15-skill ledger

**Files:**
- Modify: `docs/EXACT-WORKFLOW.md:31` and a new short subsection
- Create: `docs/superpowers/plans/2026-11-23-roofr-roofsnap-mashup-ledger.md`
- Test: `scripts/manual-trace-doctrine-test.mjs`

**Interfaces:**
- Consumes: owner decision (b) recorded in the design doc header.
- Produces: `EXACT-WORKFLOW.md` amended line; ledger with all 15 upstream skills, each `performed`/`blocked`/`not triggered` with evidence or precise limitation.

- [ ] **Step 1: Write the failing test** `scripts/manual-trace-doctrine-test.mjs`: read `docs/EXACT-WORKFLOW.md`; assert it contains a line permitting "reviewed, server-recomputed" hand measurement; assert it contains the phrase `EXACT-WORKFLOW.md:31 amendment` marker comment or an explicit "Manual" allowance; assert the ledger file exists and contains all 15 skill names from the owner directive (`using-superpowers`, `brainstorming`, `writing-plans`, `using-git-worktrees`, `test-driven-development`, `systematic-debugging`, `executing-plans`, `subagent-driven-development`, `dispatching-parallel-agents`, `requesting-code-review`, `receiving-code-review`, `verification-before-completion`, `finishing-a-development-branch`, `writing-skills`, `diagnosing-superpowers`).
- [ ] **Step 2:** Run `node scripts/manual-trace-doctrine-test.mjs`; expect FAIL (marker/ledger absent).
- [ ] **Step 3:** Amend `docs/EXACT-WORKFLOW.md:31` from "The AI does this work. The tech does not measure by hand on this path." to retain AI-first for Auto but add: "A technician MAY trace roof geometry by hand on this path **only** when the drawn polygons are persisted and the area is recomputed on the server from reviewed geometry, scale and pitch; a client-supplied area is never authoritative." Add a `## Amendment (2026-11-23)` subsection citing owner decision (b). Create the ledger with the 15 entries, honest statuses (brainstorming/writing-plans performed; implementation skills pending with `not triggered` + condition; independent review blocked by free-model daily limit if still applicable).
- [ ] **Step 4:** Run `node scripts/manual-trace-doctrine-test.mjs`; expect PASS.
- [ ] **Step 5: Register gate** add `"test:manual-trace-doctrine": "node scripts/manual-trace-doctrine-test.mjs"` to `package.json`; add `- run: npm run test:manual-trace-doctrine` to the web job in `.github/workflows/ci.yml`.
- [ ] **Step 6: Commit** `git add docs/EXACT-WORKFLOW.md docs/superpowers/plans/2026-11-23-roofr-roofsnap-mashup-ledger.md scripts/manual-trace-doctrine-test.mjs package.json .github/workflows/ci.yml && git commit -m "docs(manual-trace): amend locked workflow for reviewed server-recomputed hand traces"`.

### Task 2: Migration 113 + governance

**Files:**
- Create: `supabase/migrations/113_manual_traced_measurements.sql`
- Modify: `README.md`, `DEPLOYMENT.md`, `.github/workflows/ci.yml`, `scripts/release-foreman-check.mjs`, `scripts/field-hover-migration-test.mjs`
- Test: `scripts/manual-trace-migration-test.mjs`

**Interfaces:**
- Consumes: head `112_inspection_photos_hover_fields.sql`, count 110 (verified).
- Produces: head `113_manual_traced_measurements.sql`, count 111; `inspection_measurements.source_type` accepts `manual_traced`.

- [ ] **Step 1: Write the failing test** `scripts/manual-trace-migration-test.mjs`: read migration 113; assert it drops and re-adds `inspection_measurements_source_type_check` with the full set `manual,device_gps,aerial_provider,photo_inference,ai_formulated,manual_traced`; assert it contains no `create table`; assert governed files (`README.md`, `DEPLOYMENT.md`, `scripts/release-foreman-check.mjs`, `.github/workflows/ci.yml`, `scripts/field-hover-migration-test.mjs`) name head 113 and count 111.
- [ ] **Step 2:** Run `node scripts/manual-trace-migration-test.mjs`; expect FAIL.
- [ ] **Step 3:** Create migration 113: `alter table public.inspection_measurements drop constraint if exists inspection_measurements_source_type_check;` then re-add checking the six values; add a comment on the source column; no table creation. Update governed docs/foreman/CI/field-hover-migration-test to head 113 and count 111 (keep the existing 112-column assertions in field-hover-migration-test intact — only its governed head/count expectations change).
- [ ] **Step 4:** Run `node scripts/manual-trace-migration-test.mjs` and `node scripts/field-hover-migration-test.mjs`; expect PASS for both.
- [ ] **Step 5: Register gate** `"test:manual-trace-migration": "node scripts/manual-trace-migration-test.mjs"` + CI web-job step.
- [ ] **Step 6: Commit** `git add supabase/migrations/113_manual_traced_measurements.sql README.md DEPLOYMENT.md .github/workflows/ci.yml scripts/release-foreman-check.mjs scripts/field-hover-migration-test.mjs scripts/manual-trace-migration-test.mjs package.json && git commit -m "feat(manual-trace): migration 113 allows manual_traced source type"`.

### Task 3: Shared authoritative recompute helper

**Files:**
- Create: `lib/measurements/authoritative-recompute.ts`
- Test: `scripts/manual-trace-recompute-test.mjs`

**Interfaces:**
- Consumes: `calculateCalibratedRoofDraft`, `CalibratedRoofDraft`, `ReviewedPlane` from `lib/measurements/calibrated-roof-draft.ts`.
- Produces: `recomputeAuthoritativeArea(input: AuthoritativeRecomputeInput): CalibratedRoofDraft` where `AuthoritativeRecomputeInput = { planes: ReviewedPlane[]; scaleReferencePixels: number; scaleReferenceFeet: number; uniformPitchRisePer12: number; uniformPitchConfirmed: boolean; clientAreaSqft?: number | null }`. Throws `RangeError` when `clientAreaSqft != null && Math.abs(clientAreaSqft - derived.roofAreaSqFt) > 0.05`; passes `orthographicTopDownConfirmed:true, geometryConfirmed:true` to the draft calculator.

- [ ] **Step 1: Write the failing test** `scripts/manual-trace-recompute-test.mjs` (run with `node --experimental-strip-types`): import `recomputeAuthoritativeArea`; assert (a) two accepted planes with scale 100px/10ft and uniform pitch 4/12 yield a positive `roofAreaSqFt` matching `calculateCalibratedRoofDraft`; (b) a `clientAreaSqft` off by >0.05 throws `/stale/i`; (c) `uniformPitchConfirmed:false` with a plane missing pitch throws; (d) a self-intersecting polygon throws; (e) `uniformPitchConfirmed:true` with conflicting per-plane pitch throws.
- [ ] **Step 2:** Run `node --experimental-strip-types scripts/manual-trace-recompute-test.mjs`; expect FAIL (module missing).
- [ ] **Step 3:** Implement `recomputeAuthoritativeArea` in `lib/measurements/authoritative-recompute.ts` as a thin wrapper over `calculateCalibratedRoofDraft` + stale check; import as `./calibrated-roof-draft.ts` (match repo `.ts`-extension convention).
- [ ] **Step 4:** Run `node --experimental-strip-types scripts/manual-trace-recompute-test.mjs`; expect PASS.
- [ ] **Step 5: Register gate** `"test:manual-trace-recompute": "node --experimental-strip-types scripts/manual-trace-recompute-test.mjs"` + CI step.
- [ ] **Step 6: Commit** `git add lib/measurements/authoritative-recompute.ts scripts/manual-trace-recompute-test.mjs package.json .github/workflows/ci.yml && git commit -m "feat(manual-trace): shared server recompute with stale-area rejection"`.

### Task 4: Manual-trace persistence route + input validation

**Files:**
- Create: `lib/measurements/manual-trace-input.ts`, `app/api/measurements/manual-trace/route.ts`
- Test: `scripts/manual-trace-persistence-test.mjs`

**Interfaces:**
- Consumes: `validateGeometrySuggestion`, `GEOMETRY_CONTRACT_VERSION` from `lib/ai/geometry-contract.ts`; `isUuid`, `readJson`, `requireWorkspaceMember` from `lib/api-security.ts`; `getSupabaseEnv`, `createClient`; `isCertifiedPhotoContent` from `lib/photo-provenance-integrity.mjs`.
- Produces: `validateManualTraceInput(body): ManualTraceInput` where `ManualTraceInput = { inspectionId: string; photoId: string; imageWidth: number; imageHeight: number; planes: Array<{ vertices: Point[]; pitchRisePer12: number | null }>; scaleReferencePixels: number; scaleReferenceFeet: number }`. POST `/api/measurements/manual-trace` responds 201 `{ measurement: { id: string; measurement_source: 'manual_traced'; status: 'draft'; calibration_status: 'calibrated' } }`.

- [ ] **Step 1: Write the failing test** `scripts/manual-trace-persistence-test.mjs` (source/behavior contract, with a stubbed Supabase client like the existing route tests if present): assert the route verifies photo workspace + inspection + bucket + `upload_status` + `gps_verified` + `gps_address` + `isCertifiedPhotoContent` before any insert; asserts it inserts `aerial_measurements` with `measurement_source:'manual_traced', status:'draft', calibration_status:'calibrated'` and computed `pixels_per_foot`; inserts `roof_planes` with `is_suggested:false, review_status:'accepted', confidence:'high', reviewed_pitch_rise_per_12` from input; asserts vertices are validated via `validateGeometrySuggestion` and non-finite/out-of-bounds/<3-vertex polygons are rejected; asserts scoping `.eq('workspace_id', workspaceId)` and `created_by:user.id` on every write; asserts no client `roofAreaSqft` is read or stored by this route.
- [ ] **Step 2:** Run `node scripts/manual-trace-persistence-test.mjs`; expect FAIL.
- [ ] **Step 3:** Implement `validateManualTraceInput` (bounds via `validateGeometrySuggestion` with image width/height; per-plane pitch `null` or 0–36; scale pixels 0–200000, feet 0–10000) and the POST route following the certified-photo checks in `app/api/measurements/aerial/route.ts:118-143`, persisting the trace for the existing attest chain.
- [ ] **Step 4:** Run `node scripts/manual-trace-persistence-test.mjs`; expect PASS.
- [ ] **Step 5: Register gate** `"test:manual-trace-persistence": "node scripts/manual-trace-persistence-test.mjs"` + CI step.
- [ ] **Step 6: Commit** `git add lib/measurements/manual-trace-input.ts app/api/measurements/manual-trace/route.ts scripts/manual-trace-persistence-test.mjs package.json .github/workflows/ci.yml && git commit -m "feat(manual-trace): persist hand-traced polygons with certified-photo checks"`.

### Task 5: Generalize manual route for manual_traced authority

**Files:**
- Modify: `app/api/measurements/manual/route.ts`
- Test: `scripts/manual-trace-manual-route-test.mjs`

**Interfaces:**
- Consumes: `recomputeAuthoritativeArea` (Task 3), the `manual_traced` source written by Task 4.
- Produces: `POST /api/measurements/manual` accepts `sourceType:'manual_traced'` with `sourceReference:'manual-trace:<uuid>'`, writes `inspection_measurements.source_type='manual_traced', confidence='high'`, null linear features, `pitch` uniform or `'mixed'`.

- [ ] **Step 1: Write the failing test** `scripts/manual-trace-manual-route-test.mjs` (source/behavior contract): assert the route has one branch handling both `ai_formulated` and `manual_traced`, that `manual_traced` requires a `manual-trace:<uuid>` reference and `measurement_source='manual_traced'`, requires `status='confirmed'` + `calibration_status='confirmed'` + `orthographic_top_down_confirmed=true`, calls `recomputeAuthoritativeArea` with the client area for stale rejection, sets `source_type='manual_traced'` and `confidence='high'`, and nulls all five linear features; assert existing `ai_formulated` behavior is preserved (same source reference `aerial-geometry:<uuid>`).
- [ ] **Step 2:** Run `node scripts/manual-trace-manual-route-test.mjs`; expect FAIL.
- [ ] **Step 3:** Refactor the existing `ai_formulated` branch in `app/api/measurements/manual/route.ts:113-178` into a parameterized branch driven by `const isManualTraced = body.sourceType === 'manual_traced'` and `const isFormulated = body.sourceType === 'ai_formulated'`: choose reference prefix (`manual-trace` / `aerial-geometry`) and expected `measurement_source`, keep the existing attestation checks, load persisted `roof_planes`, call `recomputeAuthoritativeArea` (replace the inline `calculateCalibratedRoofDraft` + stale check), and set confidence `high` for manual_traced / formulation confidence for ai_formulated. Keep insertion logic and all other behavior identical.
- [ ] **Step 4:** Run `node scripts/manual-trace-manual-route-test.mjs`, `node --experimental-strip-types scripts/manual-trace-recompute-test.mjs` and `node scripts/hover-estimate-test.mjs`; expect PASS (no regression).
- [ ] **Step 5: Register gate** `"test:manual-trace-manual-route": "node scripts/manual-trace-manual-route-test.mjs"` + CI step.
- [ ] **Step 6: Commit** `git add app/api/measurements/manual/route.ts scripts/manual-trace-manual-route-test.mjs package.json .github/workflows/ci.yml && git commit -m "feat(manual-trace): authoritative manual_traced quantities in manual route"`.

### Task 6: Dedicated page with two separate uses

**Files:**
- Create: `app/measure/mashup/page.tsx`, `components/RoofrRoofsnapForm.tsx`
- Test: `scripts/manual-trace-ui-test.mjs`

**Interfaces:**
- Consumes: POST `/api/measurements/manual-trace` (Task 4); `PATCH /api/measurements/aerial`; POST `/api/measurements/manual` (Task 5); `AutoMeasurementTool`, `ManualDrawingTool`.
- Produces: a dedicated route with two distinct flows; no address-only start.

- [ ] **Step 1: Write the failing test** `scripts/manual-trace-ui-test.mjs` (source contract): assert `app/measure/mashup/page.tsx` exists and is a client page; assert `components/RoofrRoofsnapForm.tsx` exists, renders both `AutoMeasurementTool` and `ManualDrawingTool`, exposes two distinct uses (separate `mode` branches, not one blended form), reads `photoId`/`inspectionId` from query params (no typed address), calls `/api/measurements/manual-trace` then the existing `PATCH /api/measurements/aerial` attest calls then `/api/measurements/manual` with `sourceType:'manual_traced'`; asserts auto use still gates on owner toggle + verified provenance; asserts no string importing a paid imagery provider.
- [ ] **Step 2:** Run `node scripts/manual-trace-ui-test.mjs`; expect FAIL.
- [ ] **Step 3:** Implement the page and component: two separate `mode` flows (`'auto' | 'manual'`) sharing a certified-photo header showing provenance status; Manual flow collects vertices via `ManualDrawingTool`, scale anchor, per-plane pitch, POSTs to `/api/measurements/manual-trace`, then drives the existing attest + save calls; Auto flow delegates to the unchanged existing path. No new authority UI is duplicated.
- [ ] **Step 4:** Run `node scripts/manual-trace-ui-test.mjs` and `cd apps/field && npx tsc --noEmit` (field app must stay green); expect PASS.
- [ ] **Step 5: Register gate** `"test:manual-trace-ui": "node scripts/manual-trace-ui-test.mjs"` + CI step.
- [ ] **Step 6: Commit** `git add app/measure/mashup/page.tsx components/RoofrRoofsnapForm.tsx scripts/manual-trace-ui-test.mjs package.json .github/workflows/ci.yml && git commit -m "feat(manual-trace): dedicated mashup page with separate auto and manual uses"`.

### Task 7: Whole-branch verification, PR and merge

**Files:**
- Modify: `HANDOFF.md` (evidence + final merge SHA), ledger status updates.

**Interfaces:**
- Consumes: all prior tasks on the feature branch.
- Produces: merged `main` at a recorded squash SHA with local/remote match.

- [ ] **Step 1:** Run `node scripts/release-foreman-check.mjs`, `node scripts/gate-registry-integrity-test.mjs`, `node scripts/test-all-coverage-test.mjs`; expect PASS. Fix any gate-wiring gap before proceeding.
- [ ] **Step 2:** Run `npm run test:all`; expect `PASS (172 registered gates + 4 build/release checks)` (six new gates added to 166). Run `npm run test:hover` (13/13), `npm run typecheck` (PASS), `cd apps/field && npx tsc --noEmit` (exit 0), `npm run build` (record `BUILD_ID`), `npm run release-check` (PASS).
- [ ] **Step 3:** Update `HANDOFF.md` and the ledger with evidence (gate counts, BUILD_ID, field tsc, doctrine amendment, free-only checklist). Keep UNVERIFIED list: hosted migration 113 application, real-device capture/calibration, staging parity, ground-truth benchmark, SLA evidence, independent reviewer run.
- [ ] **Step 4:** Commit evidence, push the feature branch via the classic PAT (`/tmp/opencode/.ghpat`, value never printed), verify local/remote SHA match, open a PR to `main`, and wait for required checks `web`, `mobile`, `migration-safety`, `field-security` all `success`.
- [ ] **Step 5:** Squash-merge, fetch, reset local `main` to `origin/main`, verify merge SHA = remote `main` = local `main`, append final SHA to `HANDOFF.md`/ledger, remove the temp PAT file. Commit any final doc SHA update if needed and verify tree clean.
