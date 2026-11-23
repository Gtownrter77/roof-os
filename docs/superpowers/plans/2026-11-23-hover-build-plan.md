# Hover Build Plan — executable inline implementation

**Spec:** `docs/HOVER-PARITY-ROADMAP.md` (§2.2, §2.4, §4, §5, §6, §7) and
`docs/superpowers/plans/2026-11-23-hover-dossier.md`. The roadmap is `Draft for owner review`
but records the owner's decision: full parity program, all gates, OSS-first, paid paths gated.
Owner directive in `AGENTS.md` controls authority and checkpoint law.

**Executor:** inline (`superpowers:executing-plans`); per-task gate is
`superpowers:test-driven-development`. One whole-branch review at the end.

**Repo conventions (verified):** ESM (`"type": "module"`), Node 26, tests are plain
`scripts/*.mjs` importing `.ts` through `node --experimental-strip-types`. No Jest/Vitest.
`supabase/migrations` head is `110_release_job_safety_hold.sql`; new migration is `111`.
Local `git` remote is `https://github.com/Gtownrter77/roof-os.git`; working branch
`docs/hover-parity-roadmap` from baseline `be5c63c`.

**Global constraints:** free-first/paid-gated; no second workflow (`docs/EXACT-WORKFLOW.md`);
GPS must be in the photo file; explicit scale or `relative-only` with no published measurements;
AI proposes/humans lock; immutable reproducible manifest; no dollar amounts in reports;
`Unknown` stays `Unknown`; drafts not externally sendable; new migrations only; checkpoint after
every three verified batches; local tests do not prove hosted/device/production behavior.

**Shared module layout (all tasks import from here):**
- `lib/hover/types.ts` — canonical entity types and enums.
- `lib/hover/util.ts` — `hashBytes`, `roundTo`, `finite`, `uuid`, `now`.
- `lib/hover/geometry.ts` — `Vec3`, plane fit, polygon area, pitch, edge classification.
- `lib/hover/manifest.ts` — `InputManifest`, `buildInputManifest`, `manifestHash`.
- `lib/hover/scale.ts` — `solveScale`, `MetricTransform`, `canPublish`.
- `lib/hover/topology.ts` — `buildFacetGraph`, `FacetGraph`.
- `lib/hover/measurements.ts` — `RULES_VERSION`, `deriveMeasurements`, `MeasurementSet`.
- `lib/hover/qa.ts` — `LOCK_SEQUENCE`, `applyReviewAction`, `assertPublishable`.
- `lib/hover/report.ts` — `buildReportPackage`.
- `lib/hover/exports.ts` — `generateExport`, `EXPORT_FORMATS`.
- `lib/hover/viewer.ts` — `buildViewerModel`, `viewerCannotMeasure`.
- `lib/hover/design.ts` — `applyDesign`, `designDiff`.
- `lib/hover/estimate.ts` — `buildEstimate`, `estimateFromDesign`.
- `workers/hover/pipeline.ts` — stage runner, adapter contract, manifest reproducibility.

---

## Task 1: Capture schema migration and canonical types

**Interfaces**
- Produces: `supabase/migrations/111_hover_scan_pipeline.sql`; `lib/hover/types.ts`; `lib/hover/util.ts`.
- Consumes: nothing. Defines the entities every later task imports.

**Files**
- `supabase/migrations/111_hover_scan_pipeline.sql` (new; never edit existing migrations)
- `lib/hover/types.ts`, `lib/hover/util.ts` (new)
- `scripts/hover-schema-test.mjs` (new)

**Steps**
1. RED — write `scripts/hover-schema-test.mjs`. Assert the migration file defines
   `scan_jobs`, `scan_images`, `scale_anchors`, `reconstructions`, `measurement_sets`,
   `measurements`, `evidence_links`, `qa_events`, `export_artifacts`; asserts RLS enabled on
   each with `workspace_id` scoped policies; asserts every table has `workspace_id` except
   child tables that join through a parent with `workspace_id`; asserts `111_` prefix is
   greater than the current head `110_`; asserts `types.ts` exports `ScanJob`, `ScanImage`,
   `ScaleAnchor`, `MetricTransform`, `MeasurementRecord`, `MeasurementSet`, `EvidenceLink`,
   `QAEvent`, `ExportArtifact`, `CAPTURE_SLOTS`, `SLA_TIERS`.
   Expected: test fails with `Cannot find module '../lib/hover/types.ts'` or missing migration.
2. GREEN — add the migration with 9 tables, `uuid` PKs, `workspace_id uuid not null`,
   `created_at timestamptz default now()`, `alter table ... enable row level security`,
   and `create policy` statements using `workspace_id = (select workspace_id from ...)` or a
   helper matching existing repo style. Add types with the exact fields in the spec §4.3 plus
   `CAPTURE_SLOTS` (8 named side/corner slots) and `SLA_TIERS`.
   Expected: test passes; `node --experimental-strip-types scripts/hover-schema-test.mjs` green.
3. GREEN — add `lib/hover/util.ts` with `hashBytes(bytes: Uint8Array): string` (SHA-256 hex),
   `roundTo(n, digits)`, `finite(n)`, `uuid()`, `now()` and test them in the same script
   (known SHA-256 of `"abc"` is `ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad`).
   Expected: test passes with that exact hash.
4. Commit `feat(hover): add scan schema migration and canonical types`.
5. Verify whole task script again and append ledger line.

---

## Task 2: Guided capture contract and image-quality validation

**Interfaces**
- Consumes: `CAPTURE_SLOTS`, `ScanImage`, `ScaleAnchor` from Task 1.
- Produces: `lib/hover/capture.ts` exporting `validateCapture(images, anchors)`, `CaptureValidation`,
  `classifySlot`, `assessImageQuality`. Consumed by Task 3.

**Files**
- `lib/hover/capture.ts`, `scripts/hover-capture-test.mjs`

**Steps**
1. RED — write tests: exactly 8 model images filling all 8 slots is `complete`; a missing slot is
   incomplete with the slot named; a duplicate slot is rejected; `role: 'damage'` images do not
   fill slots and are excluded from model geometry; `gpsInFile: false` on any model image fails the
   locked path; blur/light metadata below threshold yields `quality: 'recapture'`; a reference
   anchor of kind `bar|door|garage|wall` with a positive observed value is stored; anchors with
   non-positive values rejected.
   Expected: fails, module missing.
2. GREEN — implement `validateCapture` returning
   `{ complete, missingSlots, rejectedImages, quality, anchorsAccepted, reason }`, with
   thresholds `blurScore >= 0.6`, `lightScore >= 0.4`, and GPS-in-file mandatory for
   `role: 'model'`. Damage/evidence images never count toward slots.
   Expected: all assertions pass.
3. Commit `feat(hover): add guided capture validation`.

---

## Task 3: Ingest immutable input manifest

**Interfaces**
- Consumes: `validateCapture` from Task 2; `ScanImage`, `ScaleAnchor`, `hashBytes`, `manifestHash`.
- Produces: `lib/hover/manifest.ts` exporting `buildInputManifest`, `verifyManifest`, `InputManifest`.
  Consumed by Tasks 4, 5, 12.

**Files**
- `lib/hover/manifest.ts`, `scripts/hover-manifest-test.mjs`,
  `app/api/hover/ingest/route.ts` (thin wrapper reusing existing provenance semantics)

**Steps**
1. RED — tests: manifest contains `jobId`, `workspaceId`, sorted image entries with `sha256`,
   `byteSize`, `slot`, `role`, `gpsInFile`, `exif`; `manifestHash` is stable under input
   reordering; changing a byte changes the hash; `verifyManifest` rejects a tampered hash;
   reject when `validateCapture` fails; the API route refuses a job whose workspace does not
   match the authenticated workspace (contract test on the exported helper, not a live server).
   Expected: fails, module missing.
2. GREEN — implement deterministic canonical JSON (sorted keys, sorted images by `sha256`),
   SHA-256 over canonical bytes; `verifyManifest` recomputes; route exports
   `assertWorkspaceMatch(jobWorkspace, callerWorkspace)` used by the test.
   Expected: passes.
3. Commit `feat(hover): add immutable input manifest and ingest route`.

---

## Task 4: Reconstruction adapter contract and pipeline stage runner

**Interfaces**
- Consumes: `InputManifest` from Task 3.
- Produces: `workers/hover/pipeline.ts` exporting `runPipeline`, `StageResult`, `Adapter`, plus
  `lib/hover/reconstruction.ts` exporting `ReconstructionRecord`, `inferReconstruction`. Consumed
  by Tasks 5, 6.

**Files**
- `workers/hover/pipeline.ts`, `lib/hover/reconstruction.ts`, `scripts/hover-pipeline-test.mjs`

**Steps**
1. RED — tests: pipeline runs stages `validate -> reconstruct -> scale -> segment -> measure -> qa -> render -> report` in order; a stage failure stops later stages and records the failing stage; retries happen at most 2 times with the same manifest hash; an adapter missing its required external binary returns `available: false` and never fabricates geometry; replaying the same manifest produces identical stage outputs for deterministic adapters; `inferReconstruction` marks `metric_status: 'relative-only'` when no metric transform exists.
   Expected: fails, module missing.
2. GREEN — implement a stage runner with an `Adapter` interface
   `{ name, version, available(): boolean, run(manifest, ctx): Promise<StageResult> }`, a
   deterministic fixture adapter for tests, and CLI adapter skeletons for `colmap`,
   `openmvs`, `gsplat` that check `command -v` before running. No paid/GPU dependency is default.
   Expected: passes; no external binary is invoked by the test.
3. Commit `feat(hover): add reconstruction adapter contract and pipeline runner`.

---

## Task 5: Constrained scale solver and metric-status enforcement

**Interfaces**
- Consumes: `ScaleAnchor`, `ReconstructionRecord`, `InputManifest`.
- Produces: `lib/hover/scale.ts` exporting `solveScale`, `MetricTransform`, `canPublish`.
  Consumed by Tasks 6, 7, 8.

**Files**
- `lib/hover/scale.ts`, `scripts/hover-scale-test.mjs`

**Steps**
1. RED — tests: a 10 ft door anchor measured as 120.2 units yields scale ≈ 0.083194 ft/unit with residual ≤ 1 inch; two disagreeing anchors produce a weighted mean and record both residuals and disagreement; GPS anchors are down-weighted relative to a placed scale bar; no anchor yields `metricStatus: 'relative-only'` and `canPublish === false`; a residual > 1 inch on the best anchor yields `metricStatus: 'failed'`; output includes `anchorsUsed`, `residualsIn`, `gpsDownweighted`, `reprojectionErrorPx`.
   Expected: fails, module missing.
2. GREEN — implement weighted least squares over anchors (weights `bar: 1.0, door: 0.8, garage: 0.8, wall: 0.5, gps: 0.05, footprint: 0.2`), convert residual to inches, enforce the 1-inch publish threshold, return `relative-only` when no usable anchor.
   Expected: passes.
3. Commit `feat(hover): add constrained scale solver`.

---

## Task 6: Semantic topology and facet graph

**Interfaces**
- Consumes: `ReconstructionRecord`, `MetricTransform` from Tasks 4, 5.
- Produces: `lib/hover/geometry.ts` and `lib/hover/topology.ts` exporting `Vec3`, `fitPlane`,
  `polygonArea`, `pitchFromNormal`, `buildFacetGraph`, `FacetGraph`. Consumed by Task 7.

**Files**
- `lib/hover/geometry.ts`, `lib/hover/topology.ts`, `scripts/hover-topology-test.mjs`

**Steps**
1. RED — tests: `fitPlane` recovers z=0 for four coplanar points and returns null for degenerate input; `polygonArea` of a unit square is 1; `pitchFromNormal` of a 6-in-12 plane is ≈ 26.565°; `buildFacetGraph` derives eave/rake/ridge/hip/valley from plane intersections on a two-plane gable; soffit facets are emitted separately; openings and gutters are emitted with `Unknown` when semantics are unavailable rather than guessed; a facet without evidence reference is rejected.
   Expected: fails, modules missing.
2. GREEN — implement 3D vector math, least-squares plane fit, Newell polygon area, pitch from normal, pairwise plane intersection classification by angle and shared-edge geometry, and `FacetGraph` with `facets`, `edges`, `openings`, `soffits`, `gutters`, `sourceReconstructionId`.
   Expected: passes.
3. Commit `feat(hover): add roof topology extraction`.

---

## Task 7: Measurement engine with versioned rules

**Interfaces**
- Consumes: `FacetGraph` (T6), `MetricTransform` (T5), `InputManifest` (T3).
- Produces: `lib/hover/measurements.ts` exporting `RULES_VERSION`, `deriveMeasurements`,
  `MeasurementSet`, `pitchAdjustedSquares`, `wasteTable`. Consumed by Tasks 8, 9, 10, 11, 12, 13.

**Files**
- `lib/hover/measurements.ts`, `scripts/hover-measurements-test.mjs`

**Steps**
1. RED — tests: a 1000 sq ft plan facet at 6-in-12 yields roof area ≈ 1118.03 sq ft = 11.18 squares; facet area error against a 100 sq ft truth is ≤ 3% on the golden fixture; pitch error ≤ 2°; linear features (ridge/eave/rake/valley) lengths match fixture within 2%; waste factors table has entries for shingle/tile/metal/membrane; a `relative-only` transform produces no measurement records; every record has at least one evidence link; `Unknown` values remain `Unknown` (null) rather than 0.
   Expected: fails, module missing.
2. GREEN — implement ruleset with `RULES_VERSION = '1.0.0'`, pitch-adjusted area
   `planArea * sqrt(1 + (rise/12)^2)`, squares `/100`, waste multipliers, linear feature
   aggregation, evidence links, confidence summary, and `status: 'draft'`.
   Expected: passes.
3. Commit `feat(hover): add versioned measurement engine`.

---

## Task 8: QA, human lock sequence, and publish gate

**Interfaces**
- Consumes: `MeasurementSet` (T7), `MetricTransform` (T5).
- Produces: `lib/hover/qa.ts` exporting `LOCK_SEQUENCE`, `applyReviewAction`, `assertPublishable`,
  `QAEvent`. Consumed by Tasks 9, 10, 11, 13.

**Files**
- `lib/hover/qa.ts`, `scripts/hover-qa-test.mjs`, `app/api/photo-estimate/report/route.ts` (extend
  only if the exported helper contract needs wiring; no authority bypass)

**Steps**
1. RED — tests: default sequence is `['tech_lock', ...ownerDefinedLocks]` where owner-defined
   locks come from the job, not a hardcoded ladder; a `correct` action creates a `QAEvent` with
   `before`/`after`/`reason` and a new measurement version preserving the original; `accept` by
   an unauthorized role is rejected; a draft with `relative-only` status cannot be locked;
   `assertPublishable` throws when any required lock is missing or any record lacks evidence;
   `Unknown` records never block but are carried forward as `Unknown`.
   Expected: fails, module missing.
2. GREEN — implement immutable event log, versioned corrections (`correctionOf` chain), role
   checks, and publish gate. No new send path; reuse Golden Report authority.
   Expected: passes.
3. Commit `feat(hover): add QA lock sequence and publish gate`.

---

## Task 9: Report package generation (PDF, XLS, XML, JSON)

**Interfaces**
- Consumes: locked `MeasurementSet` (T8), `RULES_VERSION` (T7), `InputManifest` (T3).
- Produces: `lib/hover/report.ts` exporting `buildReportPackage`, `ReportPackage`. Consumed by Task 10.

**Files**
- `lib/hover/report.ts`, `scripts/hover-report-test.mjs`

**Steps**
1. RED — tests: package contains 3D model link, photo gallery, measurement glossary, roof
   summary, facet tables, pitch-adjusted squares, waste-factor table, and soffit row for
   `roof_only`; `full_exterior` adds siding summary, elevations, facade details, openings,
   gutters and downspout count; JSON and XML round-trip to the same measurement set; XLS is a
   deterministic spreadsheet serialization (no binary dependency required for the contract);
   PDF is generated from a deterministic text layout with a content hash; no dollar amounts
   appear anywhere; `Unknown` values render as `Unknown`.
   Expected: fails, module missing.
2. GREEN — implement serializers with canonical ordering and a `contentHash`; return
   `{ format, content, contentHash, rulesetVersion }[]`. No third-party paid library; pure
   deterministic writers.
   Expected: passes.
3. Commit `feat(hover): add report package generation`.

---

## Task 10: Gated professional export formats (ESX, SKP, DWG, DXF)

**Interfaces**
- Consumes: locked `MeasurementSet` (T8), `ReportPackage` (T9).
- Produces: `lib/hover/exports.ts` exporting `EXPORT_FORMATS`, `generateExport`, `gatedFormats`.

**Files**
- `lib/hover/exports.ts`, `scripts/hover-exports-test.mjs`

**Steps**
1. RED — tests: `EXPORT_FORMATS` equals `PDF, XLS, XML, JSON, ESX, SKP, DWG, DXF`; DXF output
   starts with `0\nSECTION` and contains `LINE` entities for measured edges; DWG output is an
   explicit `UNSUPPORTED` result unless a licensed converter is approved (no fake binary); SKP
   is `UNSUPPORTED` unless SketchUp exporter approved; ESX is `UNSUPPORTED` unless Xactimate
   compatibility approved; every gated format requires `ownerApproval` token and returns
   `blocked` otherwise; all outputs carry `rulesetVersion` and `contentHash`.
   Expected: fails, module missing.
2. GREEN — implement DXF (real, deterministic ASCII DXF R12 subset) and explicit gated stubs for
   the rest. No "fake compatible" exports.
   Expected: passes.
3. Commit `feat(hover): add gated professional exports`.

---

## Task 11: 3D viewer model with measurement overlay (presentation only)

**Interfaces**
- Consumes: `FacetGraph` (T6), `MeasurementSet` (T7), `InputManifest` (T3).
- Produces: `lib/hover/viewer.ts` exporting `buildViewerModel`, `viewerCannotMeasure`; web
  component `components/hover/MeasurementViewer.tsx`.

**Files**
- `lib/hover/viewer.ts`, `components/hover/MeasurementViewer.tsx`, `scripts/hover-viewer-test.mjs`

**Steps**
1. RED — tests: viewer model contains mesh facets, splat URL placeholder, measurement overlay
   entries with `evidenceImageId`, and clickable evidence links; `viewerCannotMeasure` is true
   and the viewer exposes no function that returns a dimension from splat data; a `relative-only`
   job renders the mesh but no measurement overlay.
   Expected: fails, module missing.
2. GREEN — implement the model builder and a React component that renders the overlay from
   measurement records only. No `three`/splat dependency required for the contract test.
   Expected: passes.
3. Commit `feat(hover): add measurement viewer overlay`.

---

## Task 12: Design and material assignment with auditable diff

**Interfaces**
- Consumes: locked `MeasurementSet` (T8), `FacetGraph` (T6), viewer model (T11).
- Produces: `lib/hover/design.ts` exporting `applyDesign`, `designDiff`, `MaterialSelection`.

**Files**
- `lib/hover/design.ts`, `scripts/hover-design-test.mjs`

**Steps**
1. RED — tests: selecting a shingle product on facet `f1` changes only that facet's material;
   a design with no changes yields an empty diff; quantities recompute deterministically from
   measurement areas and the selected material's waste factor; changing roof style changes the
   facet graph reference and records it in the diff; 2D photo design and 3D twin design emit the
   same selection schema; no dollar amounts in the design object.
   Expected: fails, module missing.
2. GREEN — implement immutable design application and a structural diff of
   `{ facetId, field, before, after }` entries.
   Expected: passes.
3. Commit `feat(hover): add design material assignment`.

---

## Task 13: Estimate generation from measurements + price books

**Interfaces**
- Consumes: locked `MeasurementSet` (T8), `DesignSelection` (T12), existing
  `lib/estimates/verified-photo-workflow.mjs` authority rules.
- Produces: `lib/hover/estimate.ts` exporting `buildEstimate`, `estimateFromDesign`.

**Files**
- `lib/hover/estimate.ts`, `scripts/hover-estimate-test.mjs`

**Steps**
1. RED — tests: estimate lines come only from measurement records and a supplied price book;
   a design change deterministically changes quantities and the estimate diff; no AI-written
   money — malformed price entries are rejected; price book provenance and timestamp are
   recorded; an unlocked measurement set or missing owner lock produces no estimate; multiple
   comparison estimates are emitted as separate named variants; audit trail includes ruleset
   version, manifest hash, design hash and price-book hash.
   Expected: fails, module missing.
2. GREEN — implement deterministic line generation with `price: null` fallback and explicit
   rejection of unknown prices; reuse existing approval gates; no new send path.
   Expected: passes.
3. Commit `feat(hover): add measurement-driven estimate generation`.

---

## Final gate

- Run every `scripts/hover-*-test.mjs`, `npm run typecheck`, `npm run build`, repo `release-check`.
- Whole-branch review against `docs/HOVER-PARITY-ROADMAP.md` Review Focus §1 (the 9 inputs in the dossier).
- Checkpoint law: push after each 3 tasks; verify `git rev-parse HEAD` equals `git ls-remote`;
  update `HANDOFF.md` with SHA, checks, blockers, next action.
- Merge to `main` only after checks are green; user has explicitly authorized "in github main".
