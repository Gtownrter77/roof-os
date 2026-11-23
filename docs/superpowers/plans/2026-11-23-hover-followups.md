# Hover parity — remaining verification to-dos

Status after PR #497: the 13-dossier contract implementation is merged to `main`
at `4e9fdfc75e5e73aabd516256db99eed11faec9c7`. Everything below is **not done** and is
not claimed by the merge. These are the gates that separate "tested local contracts" from
"production Hover parity".

## P0 — prove the pipeline can actually run

1. **Install and wire reconstruction binaries.** COLMAP/OpenMVS/Meshroom + gsplat are not present.
   `workers/hover/pipeline.ts` adapters fail closed; the deterministic geometry path is a stand-in.
   Evidence needed: one end-to-end sparse → dense → metric reconstruction from real photos.
2. **Apply migration 111 to a hosted non-production Supabase project.** Local source gates only check
   file order and policy text. Evidence needed: applied migration log plus RLS checks across two workspaces.
3. **Run the four required CI jobs on GitHub for the merged commit.** Local `test:all` passed and the PR
   checks passed; keep the hosted CI record as the release artifact.

## P1 — make the contracts reachable by a user

4. **Wire 8-slot guided capture into `apps/field/App.tsx` and `src/ai/photoAssistance.ts`.** The
   validation contract lives in `lib/hover/capture.ts` but no screen calls it.
5. **Mount `components/hover/MeasurementViewer.tsx` on a web route** and add the design assignment UI.
   Both modules are tested in isolation only.
6. **Connect estimates to the existing approval authority.** `lib/hover/estimate.ts` reuses the
   `assertPublishable` principle, not `lib/estimates/verified-photo-workflow.mjs` itself.
7. **Re-read photo bytes in the ingest route.** It currently builds a manifest from existing rows; the
   byte-verifying authority is still the existing provenance endpoint.

## P2 — prove the product claims

8. **Device capture evidence** on a real phone: GPS-in-file, blur/light rejection, offline retry.
9. **Ground-truth accuracy benchmark** for the 1-inch scale threshold and area/perimeter measurements.
10. **SLA measurement** for upload → reviewable measurement set (≤15 min standard, ≤5 min expedited)
    and reviewer time (≤10 min exterior).
11. **Independent code review.** Reviewer dispatch was blocked by the OpenRouter free-model daily limit;
    the whole-branch review is self-review only.

## Hard invariants to keep when doing this work

- `Unknown` stays `Unknown` — never zero, never priced, never silently dropped.
- GPS must be embedded in the photo file; anchorless jobs are `relative-only` with no published measurements.
- Reports contain no dollar amounts; estimates only use a supplied, validated price book.
- Drafts are not externally sendable; humans lock measurements before reports or estimates.
- ESX/SKP/DWG stay `blocked`/`unsupported` until an owner-approved licensed converter exists.
- Never fabricate a compatible binary or a measurement derived from splats.
