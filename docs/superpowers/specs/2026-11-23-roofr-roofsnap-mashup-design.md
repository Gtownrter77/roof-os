# Design — Roofr + RoofSnap measurement mashup as a second form

**Status:** Design chosen by owner 2026-11-23 — option (b), both methods authoritative; executable plan pending
**Date:** 2026-11-23
**Baseline:** RoofOS `main` at `48e3786078b533ab6244d43a345ac95f0fc2b455`
**Owner decision 2026-11-23:** option (b) — hand-traced Manual may produce lockable/sendable quantities. This explicitly amends `EXACT-WORKFLOW.md:31`.
**Source design:** `docs/ROOFR-ROOFSNAP-MEASUREMENT-PARITY.md` (draft, owner review)
**Locked doctrine:** `docs/EXACT-WORKFLOW.md`

## Intent

Add a **second measurement form** that combines the two reference products' methods on one screen:

- **Auto** (Roofr-like): an automated facet/edge suggestion that a technician reviews before it becomes a quantity.
- **Manual** (RoofSnap-like): orthogonal/right-angle tracing with an explicit scale anchor and facet pitch labels.

Both methods feed the **one** existing measurement pipeline and both produce authoritative, lockable/sendable quantities (owner decision (b), 2026-11-23). The one workflow amendment is that hand-tracing is now permitted on the locked path — `EXACT-WORKFLOW.md:31` changes from "the tech does not measure by hand" to an explicit allowance for reviewed, server-recomputed human traces. Everything else holds: free/open-source only, AI proposes / humans lock for the Auto path, `Unknown` stays `Unknown`, no dollar amounts in reports, no second workflow, no fake ESX/SKP/DWG binaries.

## Goals

1. A dedicated second page with two separate uses (owner ruling) that lets a technician start from a certified photo and choose Auto or Manual.
2. Auto runs the existing local-Ollama suggestion path (`AutoMeasurementTool` + `lib/ai/local-vision-browser`) and the existing `/api/measurements/aerial` → `/api/measurements/manual` (ai_formulated) authoritative path unchanged.
3. Manual uses the existing `ManualDrawingTool` with orthogonal snapping and scale anchor entry; the drawn polygons are **persisted** and the area is **recomputed on the server** — never accepted from the client — through a new `manual_traced` source type and a new route/section that mirrors the existing ai_formulated recompute (`calculateCalibratedRoofDraft`, `/api/measurements/manual:141-177`).
4. Both methods write to `inspection_measurements`, go through the same wizard math, technician review, owner lock sequence, and gated send. Manual quantities are authoritative and lockable (owner decision (b)).
5. Scale, top-down orthographic, and pitch attestation are required before a Manual trace becomes authoritative; per-plane pitch labels feed mixed-pitch calculation. Missing attestation ⇒ `Unknown`, never a guessed value.
6. Where free imagery or local AI cannot support a measurement, the form returns `Unknown` / disables the affected quantity. It never fabricates a value.

## Non-goals

- No address-first intake. The address is always read from GPS embedded in a certified photo, per `docs/EXACT-WORKFLOW.md`. Typing a bare address to start is explicitly out.
- **Owner decision (b) amends `EXACT-WORKFLOW.md:31`** so reviewed, server-recomputed hand-traces may become authoritative — this is the single doctrine change in scope; no other line of the locked workflow is altered.
- No licensed or paid imagery, no paid API, no GPU rental, no hosted AI inference. Local Ollama and free OAM/OSM sources only, exactly as the codebase uses today.
- We do not purchase a vendor product to get a capability. Where a Roofr/RoofSnap capability would otherwise require buying a service, we study its published behavior and build our own free/open-source equivalent. This applies to software capabilities only (see Constraints).
- No new measurement pipeline, no new report/estimate authority, no changes to `app/api/photo-estimate/report/route.ts`.
- No ESX/SKP/DWG support or binaries — remains `blocked`/`unsupported` until owner approval and a licensed converter.
- No second approval/send workflow.

## Anti-goals (what would make this a failure)

- A form that lets unreviewed AI geometry become an approved quantity.
- A form that accepts a client-supplied scale, GPS, or address as authoritative.
- Any path that turns `Unknown` into a guessed number, or prints a dollar amount in a report.
- Any paid dependency introduced directly or transitively.

## Constraints

- **Free-only, hard gate.** `package.json` gains no dependency that requires payment. Imagery stays on the existing free candidates (OpenAerialMap STAC, OSM via Nominatim/Overpass). The draft parity doc names licensed imagery (Nearmap/Planetary) and paid roof-plane providers as owner-gated — those gates are **closed** by the owner's "no paid" ruling.
- **Read-and-rebuild applies to software, not data.** Owner ruling 2026-11-23: where a Roofr/RoofSnap *capability* would otherwise need a paid product, we study its published behavior and build our own free equivalent (this is the whole parity program's method). But a third-party **data asset** cannot be recreated by reading about it — fresh licensed aerial imagery and proprietary roof-plane datasets are data, not code. Free sources resolve to `Unknown` for anything they cannot support; no data gate is opened by this ruling.
- **Imagery is candidate-only.** Per `lib/measurements/aerial-provider.ts` and `app/api/measurements/property/route.ts`, free imagery is a candidate source, never authority; OSM footprint is not roof surface area; Google raster may locate but never seed a measurement. This is already enforced — the new form must not weaken it.
- **Owner authorization for auto.** `enable_auto_photo_measurements` workspace toggle (default off, owner-only) still gates every auto path, including `/api/measurements/aerial` and `/api/photo-provenance/verify`.
- **Provenance anchor.** Certified photo bytes + server-verified embedded GPS/address remain the only starting key. Device geolocation alone is rejected (`scripts/photo-skyview-handoff-test.mjs`).
- **One pipeline.** All three product modes in the draft doc write the same measurement records; the new form is a fourth entry point into that same pipeline, not a new one. Manual reuses the existing `calculateCalibratedRoofDraft` recompute — no second math engine.
- **No client authority, including Manual.** A hand-traced area is never accepted from the browser. Vertices, scale, and per-plane pitch are persisted; the server recomputes area and rejects stale/client-supplied values (mirroring `/api/measurements/manual:162-166`). This is what makes a Manual quantity safe to be authoritative under (b).
- **Review/authority chain.** Technician confirmation of scale + pitch + top-down orthographic, then owner lock sequence and gated send, unchanged. A Manual trace must pass the same attestations before it is authoritative.
- **Migration governance.** New migration follows 112 (next head 113), forward-only, additive, with head/count governance updated in every governed location. Hosted application remains a separate approved deployment (UNVERIFIED).

## Approaches considered

| Approach | What it is | Trade-off | Verdict |
|---|---|---|---|
| 1. Adapter inside the locked photo-first path | New form on a certified photo; Auto and Manual methods feed existing routes and gates | Cannot type a bare address; no "<60s order" claim | **Selected** — only approach compatible with the locked workflow and "no paid" |
| 2. True address-first second workflow | Type address → pin → imagery → auto/manual → report | Directly amends `EXACT-WORKFLOW.md`; needs licensed imagery to be useful | Rejected — paid imagery required, owner ruled no paid, and needs explicit workflow amendment |
| 3. Presentation-only second form | Tabbed Auto/Manual screen relabeling today's tools | Smallest, but not a real mashup | Rejected — does not deliver the two vendor methods |

Owner approved planning with approach 1 on 2026-11-23; "no paid" ruling confirmed approach 1 as the only viable path.

## How it will be built (decided)

### Surface

- **Owner ruling 2026-11-23: a separate page with separate uses.** The mashup gets its own dedicated route, not an embedded section of `/measure`. Auto and Manual are two distinct *uses* (separate flows), not tabs in one blended form. Placement is therefore no longer a builder call.
- New dedicated page, e.g. `app/measure/mashup/page.tsx`, with a new client component, e.g. `components/RoofrRoofsnapForm.tsx`. It reuses `AutoMeasurementTool` and `ManualDrawingTool` rather than reimplementing them.
- Each use starts from an already-certified photo (`photoId` / `inspectionId`) passed in from the existing flow — the new page does **not** reimplement photo upload or provenance verification (builder ruling on builder-check Q4).
- The page shows the source photo's provenance status (bytes certified, embedded GPS/address present) read from the existing verify endpoint. No GPS ⇒ evidence-only notice; no measurement starts (per `EXACT-WORKFLOW.md:10`), auto disabled.

### Auto method (Roofr-like)

- Calls the existing local-Ollama analysis (`analyzeRoofImageWithLocalOllama`) through `AutoMeasurementTool`; result lands in the existing `GeometrySuggestion` contract (`lib/ai/geometry-contract.ts`).
- Non-authoritative by construction: suggestion planes/edges/objects carry review status; only after technician review, scale calibration, top-down + pitch attestation, and `/api/measurements/aerial` server recomputation does a quantity become confirmed.
- If Ollama is unavailable (e.g. Android without local service), the tool already falls back to manual tracing — preserved.

### Manual method (RoofSnap-like) — authoritative under (b)

- Uses `ManualDrawingTool` with orthogonal/right-angle snapping behavior (the existing trace-geometry snapping is the base; builder to verify and extend minimally rather than replace).
- The drawn polygons are **persisted** (new `manual_traced` source type + storage, forward-only migration 113) with vertices, scale anchor, and per-plane pitch. The browser's preview area is never trusted — the server recomputes via `calculateCalibratedRoofDraft` and rejects stale/client-supplied values (mirror `/api/measurements/manual:141-177`).
- Explicit scale anchor: pixels-per-foot from a known real length, entered by the technician, then attested. Per-plane facet pitch labels feed a mixed-pitch calculation (reuse `reviewed_pitch_rise_per_12` semantics); unreviewed linear features (gutter/ridge/eave/rake/valley) stay null.
- Attestation gate before authority: scale calibrated + `orthographic_top_down_confirmed` + pitch confirmed (uniform or per-plane reviewed). Without these the trace remains `Unknown`/unconfirmed and cannot be locked/sent.
- Result goes through the identical review → owner-lock → gated-send chain and the same wizard math as Auto.

### Shared, unchanged

- Wizard math (`lib/measurements/calibrated-roof-draft.ts`, `purchasable-roofing.ts`): 100 sf = 1 sq, whole/.33/.66 displays, 10 sq default / 6 sq owner toggle, no fractional bundles.
- API routes `/api/measurements/aerial`, `/api/measurements/manual`, `/api/measurements/property`, `/api/photo-provenance/verify` — reused. The manual route is extended with a `manual_traced` recompute branch (mirroring its existing `ai_formulated` branch); the aerial route and verify endpoint are unchanged. `app/api/photo-estimate/report/route.ts` unchanged.
- Golden report, estimate draft, lock sequence, send gate — unchanged.

### Tests (governed gates)

- Source/behavior contract test asserting: the dedicated page + two separate uses exist; Manual vertices/scale/pitch are persisted and area is server-recomputed (never client-accepted); stale client area is rejected; attestation gating; `EXACT-WORKFLOW.md` amendment present; migration 113 head/count governance; auto gated by owner toggle and certified provenance; no address-only start; no paid dependency or licensed-imagery reference; `Unknown` preserved; no ESX/SKP/DWG claim; unchanged report route untouched.
- Server recompute test: hand-traced polygons + scale + per-plane pitch → `calculateCalibratedRoofDraft` authoritative area; mismatched client area rejected; unattested trace stays unconfirmed.
- Existing suites to re-run: `npm run test:hover` (no Hover regression), `npm run test:all`, `npm run typecheck`, root `npm run build`, `npm run release-check`, field `npx tsc --noEmit` (the last CI failure mode).

## What is left to the builder

- Minimum orthogonal-snapping extension needed in `lib/measurements/trace-geometry.ts` (if any) after reading it fully — no speculative rewrite.
- Whether the new form needs a distinct route test file registered in `package.json` and wired into CI (expected yes, following the field-hover gates).
- All of the above goes into a writing-plans task list before code is touched. Page placement is settled (dedicated page, separate uses).

## Free-only verification checklist

- `git diff` against baseline contains no new paid/licensed/commercial dependency or API key requirement.
- No source string introduces a paid imagery provider as an enabled source.
- No change to `app/api/photo-estimate/report/route.ts`.

## Builder-check review — resolved

A fresh engineer reviewed the design before planning and found six gaps. Owner decided 2026-11-23: **option (b), both methods authoritative.** Resolution of all six:

1. **Manual authority vs. the locked path → (b).** `EXACT-WORKFLOW.md:31` is amended to permit reviewed, server-recomputed hand-traces. Explicit owner sign-off recorded at the top of this doc.
2. **Authoritative area source → in scope.** New `manual_traced` source type, persisted polygons, and server-side recompute (reusing `calculateCalibratedRoofDraft`); client-supplied area is rejected as stale. Forward-only migration 113.
3. **Per-plane facet pitch → persisted and authoritative.** Reuses `reviewed_pitch_rise_per_12` semantics for mixed-pitch calculation.
4. **Photo upload/provenance → builder ruling:** new page receives a certified `photoId`/`inspectionId`; no full ingest flow.
5. **No-GPS Manual → builder ruling:** evidence only, no measurement starts (`EXACT-WORKFLOW.md:10`); cannot be saved as a quantity or sent. (This is unchanged by (b) — authority still requires a GPS-certified source photo.)
6. **Review/calibration/attest chain → builder ruling:** the new page hands geometry to the existing `/measure` review chain rather than duplicating it; it is an entry point, not a self-contained authority flow.

## Owner decisions — status

1. ✅ Manual authority: **(b) both authoritative** (doctrine amendment signed off).
2. ✅ Manual source type + persisted polygons + server recompute: approved as part of (b).
3. ✅ Approach 1 + separate page/separate uses: approved. Free-only ruling excludes approach 2.

No blocking owner decisions remain. Executable plan via `writing-plans` is the next step.

## Owner rulings recorded during design

- **No paid services** (2026-11-23): free/open-source only; no paid imagery, API, GPU, or hosted inference. This excluded approach 2.
- **Read-and-rebuild instead of buying** (2026-11-23): where a vendor capability would need a paid product, study its published behavior and build our own free equivalent. Bounded to software capabilities — data assets (licensed imagery, proprietary plane datasets) remain out and resolve to `Unknown`, not guessed.

## 15-skill audit

Recorded in the work-package ledger created at implementation start, per the owner's standing superpowers directive. At design stage: `using-superpowers`, `brainstorming` performed; `writing-plans` pending approval; others assessed at implementation.
