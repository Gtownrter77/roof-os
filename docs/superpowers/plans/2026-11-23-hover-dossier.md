# Hover Report Dossier (Hover, not Roofr)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce a complete Hover report package from the 8-photo capture ritual through measured 3D model, interactive digital twin, measurement engine, and export formats (PDF, XLS, XML, JSON, ESX, SKP, DWG, DXF), matching Hover's published deliverables and accuracy/timing claims.

**Architecture:** Guided 8-slot mobile capture (8 sides/corners + extras + damage + reference measurement) → cloud ingest & validation (EXIF/GPS, blur/light, immutable manifest) → reconstruction (COLMAP/OpenMVS/Meshroom + gsplat viewer) → constrained bundle adjustment with scale anchors (door/garage/wall/scale-bar + GPS priors) → semantic topology extraction (SAM2/Grounded-SAM2 + custom plane inference: facets, pitch, ridges/hips/valleys/eaves/rakes/soffit/gutters) → measurement engine (facet areas, linear features, pitch, waste factors) → QA/human handoff (multi-check + ≥1 expert review) → report generation → gated exports → design/estimate integration.

**Tech Stack:** Next.js workspace-scoped control plane (Supabase Auth/Postgres/Storage/RLS); field app Expo/RN `apps/field` (camera, offline queue, private storage); orchestrator Temporal preferred / Celery/BullMQ fallback; GPU workers COLMAP/OpenMVS/gsplat/SAM2/Grounded-SAM2; CPU workers report/DXF/XLS; PDF via ReportLab; IfcOpenShell optional; API FastAPI; PostGIS DB; Supabase/Postgres + PostGIS + S3-compatible object store.

**Spec:** `docs/HOVER-PARITY-ROADMAP.md` (§1–§7, §8, §9, §10) — this is the sole source of truth for Hover behavior; reconcile with `ContractorOS_Unified_Master_Dossier.pdf`, `ROOFOS-BUILD-CHECKLIST.md`, `HANDOFF.md`, `CURRENT-STATE.md`, and actual `main` before edits.

## Global Constraints (verbatim from spec/AGENTS.md)

- Free-first, paid-gated: no paid API, licensed data feed, GPU rental, or commercial engine assumed as default. Every such item is a named decision gate with owner approval.
- No second workflow: `docs/EXACT-WORKFLOW.md:3` locks photo-first path (GPS in photo → address from GPS → skyview → wizard → tech lock → owner sequence → gated send). Hover's address-first is an **owner-amendment gate**, not an implementation detail.
- GPS must be **in the photo file**; nearby phone location does not count (`docs/HOVER-PARITY-ROADMAP.md:302-303`).
- Scale must be explicit: every job records anchors used and residuals; if scale cannot be established, job is `Relative only` and cannot publish measurements (`docs/HOVER-PARITY-ROADMAP.md:336-337`).
- AI proposes; humans lock. Preserve Golden Report authority model (`docs/HOVER-PARITY-ROADMAP.md:337`).
- Every job reproducible: inputs, versions, model weights, rules, corrections immutable and auditable (`docs/HOVER-PARITY-ROADMAP.md:338`).
- Paid paths are gates, not defaults. OSS attempted first; escalation explicit and recorded (`docs/HOVER-PARITY-ROADMAP.md:339`).
- No protected imagery scraping/redistribution (`RESEARCH-GIS-NOAA.md:21,27`).
- Free-only AI: browser-local Ollama; no hosted paid chat key (`NO-PAID-AI.md:3-8`).
- Report/estimate discipline: "Unknown" stays `Unknown`; no dollar amounts in reports; drafts not externally sendable (`docs/HOVER-PARITY-ROADMAP.md:251,261`).
- New migrations only; never replay or renumber applied migrations (`MIGRATION-ORDER.md:64-65`).
- Checkpoint law: commit/push/SHA-match after every three verified batches, update `HANDOFF.md`, no merge with pending/failing checks (`UPDATE-CHECKPOINT-LAW.md:3-13`).
- Evidence boundary: local tests/CI do not prove hosted Supabase/RLS, deployment, provider execution, device behavior, or field acceptance (`HANDOFF.md:8-9`, `CURRENT-STATE.md:1`).
- License review required before product use: AGPL (OpenMVS, OpenDroneMap), ODbL (Microsoft footprints), non-commercial Depth Anything weights (`docs/HOVER-PARITY-ROADMAP.md:445-466`).

## Hover Report Package (exact deliverables per §2.4)

### Roof-only report (roof measurements, material, model, including soffit):
- **Interactive 3D model link** (digital twin)
- **Photo gallery** organized from captured photos
- **Measurement key/glossary**
- **Roof summary and facet tables**
- **Roof measurement dataset:**
  - Pitch-adjusted roof squares
  - Roof facets with area and diagram references
  - Ridges, hips, valleys, eaves, rakes
  - Slope details, facet-by-facet tables
  - Waste-factor table in PDF summary
  - Soffit included

### Full exterior report (adds):
- **Siding summary page**
- **Elevations diagram** with siding segments mapped to 3D model
- **Facade details** separated by siding material, brick, wrap, etc.
- **Openings:** doors, sliding glass doors, windows
- **Gutter systems** and downspout count

### Export formats (explicitly named by Hover, §2.4):
`PDF`, `XLS`, `XML`, `JSON`, `ESX`, `SKP`, `DWG`, `DXF`

### Design and estimate (after measurement):
- 3D design on digital twin: change roof style, siding, colors, windows with real products
- 2D design from photo: realistic editable visualization
- Material lists/estimates from design choices + measurements, multiple comparison lists
- Integrations to estimating, ordering, field tools; insurance workflows; partner wallets/billing

## Review Focus (inputs most likely to bite a person using this software)

1. **Metric scale from 8 casual phone photos** — SfM is projective without constraints; phone GPS metres-accurate; EXIF focal length often unreliable. *Test:* known-length recovery on golden set; failure on missing anchor; reproducibility from manifest.
2. **Roof topology (facets, hips, valleys, rakes, eaves, soffit)** — requires plane fitting + semantics + occlusion reasoning, not just mesh. *Test:* facet area/pitch against ground truth; unknown handling; every measurement has evidence; corrections versioned.
3. **Interior scans** — low light, occlusions, room connectivity, no skyview shortcut; two distinct Hover paths (Universal phone scan and LiDAR). *Test:* benchmark against tape/LiDAR on ≥20 rooms including Hover failure cases.
4. **Repeatable accuracy claim** — needs ground truth, versioned rules, audit trail, human review. *Test:* golden set of ≥50 properties stratified by roof type/material/condition/capture quality/structure; ground truth via tape/laser, RTK drone/terrestrial LiDAR, licensed Hover output.
5. **Hover-speed turnaround** — self-hosted chains can take tens of minutes on GPU hardware; needs orchestration and caching. *Test:* p50 ≤15 min standard, p95 ≤5 min expedited from upload → reviewable measurement set.
6. **Design-to-order ecosystem** — material catalogs, brand products, ESX/Xactimate, ordering. *Test:* design choices deterministically change material quantities and estimate lines with auditable diff.
7. **License contamination** (AGPL/ODbL/non-commercial weights) — legal/product constraint. *Test:* license review at adoption; keep allowed-components ledger.
8. **Splat mistaken for measurement source** — wrong numbers presented confidently. *Test:* enforce measurement records; splat viewer cannot emit dimensions.
9. **Paid gate triggered without approval** — owner authority/cost violation. *Test:* written finding + explicit owner approval before any paid escalation.

## SLA Tiers (from §6.3)

| Tier | Meaning | Human lock required |
|------|---------|---------------------|
| Visual twin | 3D view only, no measurement claims | No measurements allowed |
| Estimated measurements | Metric from anchors, confidence scored | Tech lock required |
| Verified measurements | Benchmark-equivalent, evidence complete | Tech + owner sequence |
| Certified | Survey/LiDAR-backed | Separate external workflow |

## Benchmark Targets (proposed, §6.2 — must be owner-approved)

| Metric | Definition | Parity target |
|--------|------------|---------------|
| Facet area error | abs(pred − truth)/truth per facet | median ≤ 3%, p90 ≤ 8% |
| Pitch error | degrees from truth | median ≤ 2°, p90 ≤ 5° |
| Linear feature error | ridge/eave/rake/valley length | median ≤ 2%, p90 ≤ 6% |
| Scale residual | anchor residual in inches | ≤ 1 in on good anchor |
| Time-to-report | upload → reviewable measurement set | ≤ 15 min standard, ≤ 5 min expedited |
| Human minutes | reviewer time to accept/correct | ≤ 10 min exterior |
| Publish rate | jobs passing metric QA without manual measurement | ≥ 80% ideal-capture set |

## Task Summary (testable deliverables)

| # | Component | Files | Test |
|---|-----------|-------|------|
| 1 | Capture schema migration (`scan_jobs`, `scan_images`, `scale_anchors`, `reconstructions`, `measurement_sets`, `measurements`, `evidence_links`, `qa_events`, `export_artifacts`) | new migration | slot completeness; GPS-in-file rule; reference anchor stored; offline retry; workspace isolation |
| 2 | Field UI: 8 slots + extras + damage + reference measurement | `apps/field/App.tsx`, `src/ai/photoAssistance.ts` | GPS validation, blur/light checks, resumable upload, checksum |
| 3 | Ingest function: immutable input manifest (EXIF/GPS, hash, job record) | `app/api/photo-provenance/verify/route.ts` | server re-reads bytes, extracts GPS/address, hashes, sets `gps_verified` |
| 4 | Reconstruction pipeline (COLMAP/OpenMVS/Meshroom + gsplat) | GPU worker services | sparse/dense geometry; `metric_status` enforcement; VGGT fallback |
| 5 | Constrained bundle adjustment with scale anchors | GPU worker services | known-length recovery; GPS priors weighted; residuals ≤ 1 in |
| 6 | Semantic topology (SAM2/Grounded-SAM2 + custom plane inference) | measurement engine service | facet graph; ridges/hips/valleys/eaves/rakes/soffit/gutters; openings |
| 7 | Measurement engine (facet areas, pitch, linear features, waste) | `lib/measurements/calibrated-roof-draft.ts`, `purchasable-roofing.ts` | facet area/pitch against ground truth; waste factors; versioned ruleset |
| 8 | QA/human handoff (multi-check, expert review, lock sequence) | `app/api/photo-estimate/report/route.ts`, lockout sequences | corrections versioned; every measurement has evidence; owner-defined sequence |
| 9 | Report generation (PDF, XLS, XML, JSON) | CPU worker services | exports reproduce from versioned ruleset; claims trace to measurements |
| 10 | Export formats (ESX, SKP, DWG, DXF — gated) | CPU worker services | format validation; no fake compatible exports |
| 11 | 3D viewer (splat + measurement overlay + evidence links) | `apps/web` components | viewer shows measurements; evidence-photo links; no dimension emission from splat |
| 12 | Design/material assignment (glTF materials on mesh segments) | web app + measurement service | design choices → deterministic material quantities + estimate diff |
| 13 | Estimate generation (measurement set + price books + retailer refs) | `lib/estimates/verified-photo-workflow.mjs` | no AI-written money; approval gates reused; audit trail |

## Execution Handoff

Plan saved to `docs/superpowers/plans/2026-11-23-hover-dossier.md`.

**Execution approach:** 
- **Subagent-driven** (recommended) — fresh subagent per task, reviewer between steps, whole-branch review at end. Tasks are interdependent, many need independent confirmation, mistake cost = rebuild.
- **Native** — I implement in-session, one fresh reviewer at end. Cheaper/faster.

Choose one.

---
*Self-review checklist:*
1. Spec coverage — every §1–§7 requirement mapped? List gaps.
2. Step scan — each step lets implementer write exactly one reasonable thing?
3. Type consistency — method signatures match across tasks?
4. Review focus — 9 items listed, each gets test pinned to owning task?
5. Proportion — plan length vs spec; replace bodies with signatures/test names.