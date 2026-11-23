# Whole-branch review — Hover parity build

Scope: `be5c63c..6df512d` on `docs/hover-parity-roadmap`.
Spec: `docs/HOVER-PARITY-ROADMAP.md` §§2.2, 2.4, 4, 5, 6, 7 and
`docs/superpowers/plans/2026-11-23-hover-dossier.md`.
Executor: inline. Review: self-review with independent reviewer dispatch blocked by the
OpenRouter free-model daily limit recorded in `progress.md`. No reviewer is claimed to have run.

## Spec coverage (13 dossier deliverables)

| # | Dossier deliverable | Landed code | Contract test | Status |
|---|---------------------|-------------|---------------|--------|
| 1 | Nine workspace-scoped tables + schema | `supabase/migrations/111_hover_scan_pipeline.sql`, `lib/hover/types.ts` | `hover-schema-test.mjs` | Pass |
| 2 | Guided capture validation (8 slots, GPS-in-file, blur/light, reference) | `lib/hover/capture.ts` | `hover-capture-test.mjs` | Pass — contract only, field UI not wired |
| 3 | Immutable input manifest | `lib/hover/manifest.ts`, `app/api/hover/ingest/route.ts` | `hover-manifest-test.mjs` | Pass — new route, existing provenance route untouched |
| 4 | Reconstruction adapter + stage runner | `workers/hover/pipeline.ts`, `lib/hover/reconstruction.ts` | `hover-pipeline-test.mjs` | Pass — contract/adapters, no GPU worker service |
| 5 | Constrained scale solver, 1-inch threshold | `lib/hover/scale.ts` | `hover-scale-test.mjs` | Pass |
| 6 | Semantic topology / facet graph | `lib/hover/geometry.ts`, `lib/hover/topology.ts` | `hover-topology-test.mjs` | Pass — deterministic geometry, no SAM2 model |
| 7 | Versioned measurement engine | `lib/hover/measurements.ts` | `hover-measurements-test.mjs` | Pass — new module, legacy kernel untouched |
| 8 | QA locks + publish gate | `lib/hover/qa.ts` | `hover-qa-test.mjs` | Pass — existing report authority deliberately untouched |
| 9 | PDF/XLS/XML/JSON reports | `lib/hover/report.ts` | `hover-report-test.mjs` | Pass — serializers, no worker service |
| 10 | Gated ESX/SKP/DWG + real DXF | `lib/hover/exports.ts` | `hover-exports-test.mjs` | Pass — no fake compatible binaries |
| 11 | 3D viewer model + overlay | `lib/hover/viewer.ts`, `components/hover/MeasurementViewer.tsx` | `hover-viewer-test.mjs` | Pass — component not mounted in a route |
| 12 | Design/material assignment + diff | `lib/hover/design.ts` | `hover-design-test.mjs` | Pass — logic only, no design UI |
| 13 | Measurement-driven estimates | `lib/hover/estimate.ts` | `hover-estimate-test.mjs` | Pass — new module, legacy approval authority reused by gate, not wired |

## Review focus — implied inputs and failure modes

Each line names an input/condition a reasonable user would expect to be handled and the test
that pins it. These are the nine highest-risk silent failures in this spec.

1. **Model photo without embedded GPS** → locked path rejects it; `hover-capture-test.mjs`, `hover-manifest-test.mjs`.
2. **Manifest byte tampering / row reordering** → hash changes on tamper, not on reorder; `hover-manifest-test.mjs`.
3. **No usable scale anchor** → `relative-only`, no measurement records, no publish; `hover-scale-test.mjs`, `hover-measurements-test.mjs`, `hover-viewer-test.mjs`.
4. **Unknown measurement** → stays `null`/`Unknown`, never zero; never blocks publish, never becomes a priced line; `hover-measurements-test.mjs`, `hover-qa-test.mjs`, `hover-report-test.mjs`, `hover-estimate-test.mjs`.
5. **Measurement without evidence** → publish gate throws; `hover-measurements-test.mjs`, `hover-qa-test.mjs`.
6. **Missing or wrong owner lock / unlocked set** → no report lock, no estimate; `hover-qa-test.mjs`, `hover-estimate-test.mjs`.
7. **Licensed export requested without approval/converter** → explicit `blocked`/`unsupported`, never a fake binary; `hover-exports-test.mjs`.
8. **Dollar amount leaking into a report** → all four report serializers reject `$`/USD wording; `hover-report-test.mjs`.
9. **Malformed price-book entry** → whole estimate rejected, no AI-written money; `hover-estimate-test.mjs`.

## Type consistency

Interfaces were consumed in dependency order: `types.ts` → capture → manifest → pipeline/
reconstruction → scale → geometry/topology → measurements → qa → report/exports/viewer/design →
estimate. `npm run typecheck` passes on the final branch (after fixing two XLS row joins in
`report.ts`). Cross-task field names (`manifestHash`, `metricStatus`, `setId`, `sourceRefs`,
`rulesetVersion`, `facetGraphRef`, `designHash`) are consistent.

## Disclosed gaps — not production parity

- No GPU worker services, COLMAP/OpenMVS/gsplat binaries, SAM2 segmentation or VGGT fallback are
  installed; adapters fail closed and the deterministic geometry path is a stand-in.
- Field app (`apps/field/App.tsx`) and `photoAssistance.ts` were not modified. The 8-slot capture
  contract exists as `lib/hover/capture.ts` but is not wired into a screen.
- Ingest route builds a manifest from existing rows; it does not re-read photo bytes from private
  storage itself. The existing provenance route remains the byte-verifying authority.
- Web routes do not mount `MeasurementViewer`; there is no design UI.
- Estimates do not call `lib/estimates/verified-photo-workflow.mjs`; they reuse its approval
  *principle* via `assertPublishable`, not its implementation.
- No hosted/Supabase migration application, device capture test, staging run, ground-truth
  accuracy benchmark, SLA measurement or production evidence was produced. Local tests do not
  prove any of those.
- Push/merge to `main` requires GitHub credentials unavailable in this environment.

## Verification evidence

Recorded in the SDD ledger (`progress.md`) and `HANDOFF.md`: all 13 hover contract tests pass;
`npm run typecheck` passes; `npm run release-check` passes; `npm run build` and `npm run test:all`
were started in the final gate and their outcomes are recorded in `HANDOFF.md` when completed.
