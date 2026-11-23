# Hover Parity Program — Reverse-Engineered Workflow, Current-State Gap, and Full Roadmap

**Status:** Draft for owner review — not an approved implementation plan  
**Date:** 2026-11-23  
**Prepared in:** worktree `/home/rlongmbox/projects/roof-os-hover-parity`, branch `docs/hover-parity-roadmap`  
**Baseline:** `be5c63c` (`main`, 2026-11-23 local checkout)  
**Owner decision recorded in this session:** **Full parity program, all gates** — exterior + interior + design + estimates, with paid/licensed components named as explicit later gates. Free/open-source software and GitHub repos remain the core wherever they can carry the workflow.  
**Evidence boundary:** Source and public-web research only. No production database, live provider, physical-device, or deployed-SHA verification was performed for this report. Statements about RoofOS runtime behavior are repository-document claims unless marked otherwise.

---

## 0. How to read this document

This report answers five questions:

1. What exactly does Hover do, step by step, from photos to a finished report and estimate?
2. What does RoofOS already have that maps to that flow?
3. Where can free/open-source software reproduce the flow, and where can it not?
4. What architecture and data model would let RoofOS reach parity rather than approximate it?
5. What is the phased roadmap, with acceptance tests, cost gates, and honest risk?

Two disciplines apply throughout:

- **Free-first, paid-gated.** No paid API, licensed data feed, GPU rental, or commercial engine is assumed as "just part of the stack." Every such item is a named decision gate with an owner approval requirement.
- **Evidence before claims.** A capability is described as `Implemented (source)`, `Implemented (verified)`, `Experimental`, `Planned`, or `Unknown`. A passing local source check is not proof of production behavior.

---

## 1. Executive summary

### 1.1 The blunt verdict

Hover's public story is simple — "take eight photos, get a measured 3D model and a report in minutes." The engineering underneath is not simple. It is a combination of:

- a **constrained capture ritual** (eight fixed side/corner views, extra photos allowed, separate orders per structure),
- a **learned prior over 10M+ homes plus a proprietary spatial database**,
- **metric scale recovery** from visual cues such as a standard-size front door, reinforced by an explicit reference measurement when those cues are obscured,
- **semantic topology extraction** (roof facets, pitch, ridges, hips, valleys, eaves, rakes, soffit, gutters, openings, siding segments),
- **productized QA and human handoff**, then
- **design → estimate → export** in PDF/XLS/XML/JSON/ESX/SKP/DWG/DXF.

A free/open-source stack can reproduce the *shape* of that workflow today. It cannot yet reproduce Hover's *repeatability from casual eight-photo input* with no reference object and no human correction. The gap is not the viewer, not the PDF, and not the queue. The gap is **metric scale + topology + QA under uncontrolled input**.

Therefore the recommended centerline — matching the owner's choice — is a **full parity program with all gates**:

- Build the OSS core: guided capture, COLMAP/OpenMVS reconstruction, plane/semantic measurement, splat viewer, DXF/PDF/XLS/JSON exports, Temporal/Celery orchestration, Supabase/PostGIS system of record.
- Treat **reference-length capture, QA, and an audit trail** as first-class product requirements, not as a workaround.
- Add **interior scans** as a separate but parallel track with two sub-paths (Universal phone scan and LiDAR), because the geometry/occlusion problem is harder and Hover ships both.
- Define **explicit gates** for licensed imagery, property/parcel data, commercial photogrammetry, Xactimate/ESX compatibility, and GPU capacity when OSS evidence fails.
- Measure parity with a benchmark, not with adjectives: facet-area error, pitch error, linear-feature error, time-to-report, and human-minutes-per-job.

### 1.2 What RoofOS has that actually matters

RoofOS is not starting from zero. It already has the *business spine* that many photo-to-model startups lack:

- Workspace-scoped Next.js control plane on Vercel with Supabase Auth/Postgres/Storage and RLS.
- Field app in `apps/field` (Expo/React Native) with inspection photos, offline queue, categories, and private Storage upload paths.
- A locked workflow doctrine in `docs/EXACT-WORKFLOW.md`: GPS embedded in the photo → address derived from it → **skyview** → measurement wizard → tech judgment → owner-defined approval sequence → send.
- A report authority standard in `GOLDEN-REPORT.md`: sourced claims, `Unknown` instead of guessing, technician verification, signatures, manager approval, and "AI observes, humans authorize."
- Price books, retailer reference pricing, estimate approval gates, and an AI receptionist/automation layer.

That means the parity program is **not** "build a roofing app." It is "replace the skyview-only measurement step with a ground-photo 3D measurement pipeline, keep the authority gates, and extend the same evidence model to interior and design."

### 1.3 What will be hardest

| Hardest thing | Why | OSS status |
|---|---|---|
| Metric scale from 8 casual phone photos | SfM is projective without constraints; phone GPS is metres-accurate, EXIF focal length is often unreliable | Partial: COLMAP + reference length + GPS priors can work, but needs productized constraint solving |
| Roof topology (facets, hips, valleys, rakes, eaves, soffit) | Requires plane fitting + semantics + occlusion reasoning, not just a mesh | No single OSS model; must assemble SAM2/Grounded-SAM2 + custom plane inference |
| Interior scans | Low light, occlusions, room connectivity, no skyview shortcut; two distinct Hover paths (Universal phone scan and LiDAR) must both be accounted for | Public docs now mapped (§2.5); OSS productization still weakest, especially connected-room and low-light handling |
| Repeatable accuracy claim | Needs ground truth, versioned rules, audit trail, human review | Must be built; not present in OSS repos |
| Hover-speed turnaround | Hover processes in minutes at consumer scale | Self-hosted chains can take tens of minutes on GPU hardware; needs orchestration and caching |
| Design-to-order ecosystem | Material catalogs, brand products, ESX/Xactimate, ordering | Commercial/data problem, not reconstruction |

---

## 2. Hover workflow, decomposed

All facts in this section are drawn from Hover's own public pages and help center unless marked otherwise. They are **claims about Hover's published process**, not independently verified internal architecture.

### 2.1 The four-step public flow

Hover's `how-it-works` page states:

1. **Take some photos** — a few photos create an accurately measured 3D model.
2. **Better measurements** — the pro gets a detailed report of accurate measurements.
3. **Dream and design** — the homeowner and pro design on a 3D model, selecting materials.
4. **Fair estimation** — the pro uses design choices and measurements to estimate quickly.

The roofing page restates this as **Capture → Process → Measure → Build**, and describes the output as "production-ready roof measurements" derived from a "guided smartphone photo scan in minutes," backed by a dataset built on 10+ million homes and a proprietary spatial database.

### 2.2 Exterior capture: the exact ritual

From `help.hover.to` exterior-scan and photo articles:

- **Minimum 8 photos**, one of each **side** and one of each **corner**.
- The app shows a **grid**; the user taps a photo spot and can add multiple photos per spot. No hard limit on total photos.
- Choose deliverable before capture: **Roof only**, **Full exterior**, or **Photos only / save now, order later**.
  - Roof only: roof measurements, material, and model, including soffit.
  - Full exterior: roof plus elevations, openings, gutters, downspout count, siding.
  - Photos only: capture now, order 3D data later; no cost until submitted.
- Property details captured at project start: name, address, claim/lead number, billing wallet, deliverable type.
- Multiple structures (sheds, barns, detached garages) are **separate orders / separate buildings**.
- After the 8 required photos, **damage/extra photos** can be added to the gallery; they are explicitly **not used to build the 3D model**.
- Before submitting: choose **standard or expedited** delivery, billing wallet, internal notes.
- **Reference measurement** is explicitly requested when visual scale cues are obscured. Hover says it uses image data such as a **standard-size front door** to determine scale, and asks for a reference such as wall width, front door/garage door width and height when foliage or other obstruction hides the cue.

That last bullet is the most technically important public statement Hover makes. It confirms that Hover's accuracy depends on a metric anchor, not on magic.

### 2.3 Processing: what is public and what is not

Publicly stated:

- Photos are automatically uploaded to the cloud.
- "Patented technology" transforms them into a fully measured, customizable 3D model.
- A proprietary spatial database and 10M+ home dataset inform measurements.
- The user is notified when the model is ready.
- Standard vs expedited delivery speeds exist.

Not publicly documented in the sources reviewed:

- The precise photogrammetry/SfM algorithm or neural architecture.
- Exact human-in-the-loop QA steps.
- Numeric accuracy tolerance (e.g., ±% per facet).
- Exact standard turnaround SLA in hours.
- Whether the "3D model" is a mesh, splat, parametric reconstruction, or hybrid.

Any roadmap claim that depends on those unknowns is marked `Unknown` and must be validated against a real Hover output during the benchmark phase.

### 2.4 Deliverables and exports

**Roof measurement dataset** (from `measurements/roof` and the measurement PDF article):

- Pitch-adjusted roof squares.
- Roof facets with area and diagram references.
- Ridges, hips, valleys, eaves, rakes.
- Slope details, facet-by-facet tables.
- Waste-factor table in the PDF summary.
- Soffit included in roof-only scope.
- Gutters and downspout count in full exterior.
- Custom line segments drawn anywhere for user-defined measurements.

**Full exterior adds:**

- Siding summary page.
- Elevations diagram with siding segments mapped to the 3D model.
- Facade details separated by siding material, brick, wrap, etc.
- Openings: doors, sliding glass doors, windows.
- Gutter systems.

**Report package:**

- Link to interactive 3D model.
- Photo gallery organized from the captured photos.
- Measurement key/glossary.
- Roof summary and facet tables.
- Elevations and siding breakdowns.

**Export formats explicitly named by Hover:** `PDF`, `XLS`, `XML`, `JSON`, `ESX`, `SKP`, `DWG`, `DXF`.

**Design and estimate:**

- 3D design on the digital twin: change roof style, siding, colors, windows with real products.
- 2D design from a photo: realistic editable visualization in seconds.
- Material lists / estimates generated from design choices and measurements, with multiple comparison lists.
- Integrations to estimating, ordering, and field tools; insurance workflows; partner wallets/billing.

### 2.5 Interior workflow — Universal and LiDAR paths

Interior is **better documented than the first draft of this report assumed**. Hover's help center describes two distinct paths, both of which matter for parity.

**Universal interior scan (any smartphone/tablet, ~15 minutes of capture):** the app guides the user to add a project, choose **Interior**, enter property info and floor count, optionally add damage photos, then **label and scan each space**. Large rooms are captured by tracing the perimeter; small rooms use doorway/up-down "paint" motions. Connected rooms and photo trails are captured in sequence, hallways are treated as their own spaces, and the phone stays up when entering the next room. Levels are reviewed/added before submission. Documented outputs: room measurements for cabinets, walls, windows, openings and doors; **2D and 3D sketch floor plans**; localized damage photos; and a **360° virtual walkthrough**. Hover says interior sketches/measurements can be imported into Xactimate and Cotality/CoreLogic workflows. Turnaround is square-footage dependent; spaces under **1,000 sq ft are typically returned within ~3 hours**. The app may ask for a reference measurement during upload. [Official help doc]

**LiDAR interior scan (iPhone 12 Pro+ / iPad Pro 2020+, ~15 minutes):** produces a **real-time model during capture**, with calibration and white-line wall outlines shown in the app. The user rotates and zooms to confirm walls, openings, and cabinets are represented correctly, can add photos, and handles each level as a separate project. Rooms should "touch" so the capture stays connected. After upload, Hover says measurements, model, walkthrough and photos arrive in **about a minute**; an automatic photo mode can create a photo mesh. [Official help doc]

**Interior constraints and economics:** entrances/paths must be clear, lights on, windows uncovered, high ceilings painted up/down, hallways scanned alone, and all four walls kept in frame where possible. If Hover cannot generate a full model, **incomplete rooms are not charged**, but a rescan is a **new, separately billed project**. The measurement PDF's second page lists incomplete rooms and rescan guidance.

**Accuracy claim (marketing, not independent):** a Hover-published 2025 carrier pilot of 100 interior spaces reports **97.74% floor-area** and **96.73% wall-area** accuracy versus adjusters' alternative method. No public methodology, sample disclosure, or LiDAR ground truth was found; treat as `Hover self-reported`. [Official marketing]

For parity, this changes Phase 6 from "generic interior spike" to a **two-track requirement**: a Universal-style phone-photo path must exist for all devices; a LiDAR-assisted path is an optional accelerator gated on device availability and sensor APIs. Both must emit the same room/opening measurement schema. A real Hover interior sample is still required in Phase 0 to lock the exact field set and report layout.

### 2.6 Text sketch of the Hover flow

```text
[Lead / homeowner]
        |
        v
[Guided mobile capture]  <-- 8 side/corner slots + extras + reference measurement
        |
        v
[Cloud ingest + validation]  <-- EXIF/GPS, blur/light checks, project metadata
        |
        v
[Photo -> measured 3D model] <-- proprietary CV + 10M-home prior + spatial DB
        |
        +--> [Interactive 3D digital twin] ----> [Material/design selection]
        |                                               |
        v                                               v
[Measurement engine] --------------------------> [Estimate / material list]
        |
        v
[Report: PDF + XLS + XML + JSON + ESX + SKP + DWG + DXF]
        |
        v
[Field / claim / order / partner integrations]
```

**Alternate input path (not in the diagram):** Hover also accepts **blueprints** — `PDF`, `DWG`, `DXF` — via web "New construction" or mobile "Start → Upload Blueprints." It requires elevations for front/back/left/right and floor plans for every level, with legible measurements even for Roof-Only jobs. Hover states most such jobs return in **as little as 24 hours** (~48 hours for 10,000–50,000 sq ft), with pricing starting around **$55** and billing by processed size; no expedited option is documented for blueprints. This matters for RoofOS because it is a **non-photographic input that can seed the same measurement schema** and can act as ground truth or a fallback when field capture is impossible. Interior blueprint upload was described as testing-only via support. [Official help doc]

### 2.7 What the public patents disclose about processing

The "black box" is partly illuminated by Hover-assigned patents. These are disclosures of *concepts*, not proof that the exact patented steps run in production, but they align with the public capture rules:

- **US9437033B2** (priority 2008-11-05, granted 2016-09-06): ground-level images of building sides/corners → 3D dense point cloud → architectural feature and planar façade recognition → textured façade geometry → correlation with orthogonal imagery for **geo-positioning, scale and rotation**. Scale comes from known-size cues such as front-door sill-to-knob height, siding width, brick size, and door/window proportions. Plane fitting is RANSAC-like. Roofs may be flat/untextured or textured depending on imagery. This is the technical reason corner shots and visible reference elements are mandatory.
- **US10776999B2**: textured 3D models from ground imagery with key façade features, geometry planes, geo-positioning, scaling and texturing.
- **US10861224B2 / US11935188B2 ("3D building analyzer")**: constructing a **labeled and dimensioned** building model from directed mobile capture, labeling architectural elements with identifiers and measurements.
- **US10902672B2 / US11276229B2**: scaling by deriving dimensional ratios, matching elements to industry-standard sizes, and averaging/refining scale factors from relative error.
- **US11113877B2**: simplifying planar/surface geometry from a point cloud using ground, orthographic or oblique images, then scaling/texturing.
- **US11721066B2 / US12573144B2 ("materials auto-populator")**: extracting dimensions from a scaled model, matching manufacturer products, preference-driven selection lists, auto-ordering and delivery tracking — direct evidence that the measurement model is intended to feed commerce, not just a PDF.

The defensible conclusion: Hover's moat is a **mature photogrammetry + scale + labeling + prior-data pipeline plus workflow breadth**, not a single magic neural network. Public sources do **not** disclose exact production ML architecture, confidence thresholds, human-QA rates, correction frequency, per-feature error distributions, or server latency by project type. All of those are `Unknown` and are benchmark targets, not assumptions.

### 2.8 Accuracy, turnaround, and claim caveats

| Published claim | Source status | How this report treats it |
|---|---|---|
| "As few as 8 photos"; "~285 measurements per project" | Hover marketing | Accepted as positioning; benchmark must measure our own count |
| "Within 2–5% accuracy"; "Haag Engineering recognition" | Hover marketing; no public Haag report, sample size or methodology found | `Hover claims` — not an independent benchmark |
| "Typically delivered in minutes" | Hover roofing marketing | Conflicts with other Hover sources (see below) |
| "Within a couple of hours" | Hover blog | Secondary Hover statement |
| "Within 24 hours" (multifamily); ~1 h Roof-Only / ~2 h Complete for expedited | Hover help | More operational; still workload-dependent |
| ~12 h Starter, ~4 h Pro/Business, ~2 h Enterprise | Third-party 2026 review | Secondary; not authoritative |
| Interior pilot 97.74%/96.73% | Hover case study, unnamed carrier | Self-reported |

There is **no single authoritative public SLA**. The safe characterization: standard turnaround is workload-, complexity-, quality- and plan-dependent; expedited has narrower targets but still varies for large/complex structures. Our benchmark must therefore record **p50/p95 time-to-reviewable-set** rather than compare against one marketing number.

### 2.9 Pricing and ecosystem (the cost ceiling)

Current public pricing: **Starter** pay-per-project (first three free), **Pro** $999/year ($20 off each project, expedited, 2D Design, Estimates, Agreements, CRM integrations), **Business** $2,999/year (flat rates, up to 10 branches, SSO), **Enterprise** custom. Listed exterior per-project prices: Simple (≤4 facets) $59/$39/$79, Average (5–8) $99/$79/$79, Complex (9+) $139/$119/$79 for Starter/Pro/Business. Expedited is listed as $39 Starter and $19 Pro/Business, while a help article says $40 with membership discount — a live inconsistency, like the roofing page's "$99/month" versus the pricing page's annual-only Pro. Interior starts at **$29** for rooms up to 200 sq ft, up to **$89** for open-concept over 600 sq ft.

Developer/ecosystem surface: **OAuth 2.0 REST API, webhooks, capture requests/jobs, JSON/PDF/XLSX/XML/3D/SKP/ESX/FML/wireframe/rotated-image exports, Instant Design images/leads, inspections, estimates, agreements, scope of loss, organizations/users/wallets/payments, blueprint upload**, plus guides for Zapier, Salesforce, MCP and ChatGPT/Cursor-oriented access. Named integrations include AccuLynx, JobNimbus, ServiceTitan, Salesforce, Zoho, CompanyCam, JobTread, Leap, SumoQuote, Builder Prime, ProLine, RoofLink, One Click Contractor, Verisk Xactimate/XactAnalysis/XactRemodel, Cotality, Roof Hub, myABCsupply, QXO, Belgard and SketchUp. This is the **breadth benchmark**: exterior parity alone is not product parity.

---

## 3. RoofOS current state

### 3.1 Source baseline and authority

Repository docs declare the current GitHub `main` as `764976f...` with CI run `44984769341` passing five required jobs; the local checkout used for this report is `be5c63c`. Docs explicitly warn that many dated checkpoints are historical and must not be treated as current deployment evidence. Production schema parity, deployed SHA, live provider execution, physical-device behavior, live two-workspace isolation, and backup/restore remain **unverified** in the repository's own words.

The owner directive in `AGENTS.md` names the approved `ContractorOS_Unified_Master_Dossier.pdf` and original source requirements as the source of truth for product scope. This report does **not** replace that dossier. Before any implementation, each roadmap item must be reconciled against the dossier, `ROOFOS-BUILD-CHECKLIST.md`, `HANDOFF.md`, `CURRENT-STATE.md`, and actual `main`.

### 3.2 Capability inventory relevant to Hover parity

| Area | RoofOS today (source/documented) | Evidence state | Hover equivalent |
|---|---|---|---|
| Web control plane | Next.js app, workspace-scoped auth/RLS, leads/jobs/calendar/tasks | Implemented (source), not live-verified | Project hub, pro workspace |
| Field app | Expo/RN `apps/field`: camera/photo capture, albums/categories, offline queue, verification, manual measurements, private Storage uploads | Implemented (source); store build/release artifact exists, physical-device behavior unverified | Guided capture app |
| Inspection photos | Photos tied to inspection, categories, source attribution | Implemented (source) | Gallery + evidence |
| Measurement path | `docs/EXACT-WORKFLOW.md`: GPS embedded in photo → address → **skyview** → wizard measures skyview with formulas (100 sf = 1 sq, whole/.33/.66 displays, 10 sq replacement start, 6 sq owner-toggle) → drawing + measurements + estimate | Documented locked path; implementation depth not independently verified in this report | Ground-photo 3D measurement |
| Report authority | `GOLDEN-REPORT.md`: every claim sourced or `Unknown`; AI non-authoritative; technician verification; required signatures; manager approval; no AI-written money | Implemented as doctrine/source | Hover measurement PDF (different authority model) |
| Estimates | Price books, tax rates, retailer reference pricing (Home Depot/Lowe's, provenance/weekly refresh), approval gates | Implemented (source) | Estimate/material list |
| Exports | Existing PDF/report pipeline; exact DXF/SKP/ESX status not established | Unknown | PDF/XLS/XML/JSON/ESX/SKP/DWG/DXF |
| 3D / photogrammetry / measurement AI | No evidence in reviewed docs of SfM, mesh, 3D viewer, roof facet extraction, or photogrammetric measurement | Not present in reviewed sources | Core Hover engine |
| Interior scans | Not present in reviewed sources | Not present | Hover interior |
| AI use | Receptionist, inspection quality agent, bounded agents, skyview wizard; AI observations explicitly non-authoritative | Implemented (source) | Hover proprietary CV (authoritative within their process) |

### 3.2.1 Source evidence register

A read-only code audit of `/home/rlongmbox/projects/roof-os` produced the following exact-location evidence. None of these paths were executed; they establish **implemented source**, not field or production verification.

| Capability | Evidence (file:line) | State |
|---|---|---|
| Next 16.4.6 / React 19 / Supabase / Stripe / Twilio / Turf / Leaflet / MapLibre | `package.json:179-194` | Source |
| No `three`, `react-three-fiber`, `pdf-lib`, `jspdf`, `xlsx`, `exceljs`, `gltf`, `dxf`, `skp` dependency | `package.json:6-177`, `:195-205` | Source (absence) |
| Expo 57 / RN 0.86 field app with Image Picker, Location, SQLite, File System, NetInfo | `apps/field/package.json:6-26` | Source |
| 108 migration SQL files; head `110_release_job_safety_hold.sql`; duplicate `021`–`023` prefixes | `supabase/migrations/` | Source |
| Field JPEG EXIF GPS stamping + local verification + client-ID queue | `apps/field/App.tsx:732-854`, `:746-807`, `:196-198`, `:960-1050` | Source; device unverified |
| Server re-reads image bytes, extracts GPS/address, hashes bytes, sets `gps_verified` | `app/api/photo-provenance/verify/route.ts:57-103` | Source |
| Service-role-only GPS certification; owner-only enablement; default OFF | `supabase/migrations/105_photo_gps_automation_authority.sql:23-62`; `app/api/photo-to-report/route.ts:42-52` | Source |
| Photo-to-report packet refuses to fabricate geometry, quantities, damage, coverage, code or prices | `app/api/photo-to-report/route.ts:12-14`, `:75-112` | Source |
| Bounded local vision analysis with contract validation and unsafe-claim rejection | `app/api/photo-estimate/analyze/route.ts:1-20`, `:268-293`; `lib/ai/unsafe-claims.ts:8-31` | Source; provider unverified |
| 2D geometry contract: polygons, edges, objects, roof squares/pitch/ridge/valley formulation fields; rejects malformed/self-intersecting/out-of-bounds polygons | `lib/ai/geometry-contract.ts:10-37`, `:44-109` | Source |
| Human scale calibration, top-down confirmation, pitch confirmation, accept/reject/edit suggestions | `app/measure/page.tsx:429-445`, `:639-795`; `app/api/measurements/manual/route.ts:21-140` | Source |
| Golden Report: 12 ordered sections, source labels, no dollar amounts or unconfirmed AI output; tech + current manager approval; signatures | `lib/reports/golden-report.mjs:1-56`; `app/api/photo-estimate/report/route.ts:65-114`, `:133-259`; `supabase/migrations/042_golden_report_review_controls.sql:1-27` | Source |
| Ridge/rake/valley/fascia/soffit and aerial roof measurement are `Unknown` unless separately verified | `app/api/photo-estimate/report/route.ts:133-145` | Source |
| Strict estimate kernel: roof squares only from `eaveLf × rafterLf × slopeMultiplier × waste`, plus gutter LF; price `null` | `lib/estimates/verified-photo-workflow.mjs:15-65`; `app/api/estimates/draft/route.ts:81-125` | Source |
| DB triggers require technician-approved photo-workflow source and manager approval | `supabase/migrations/038_estimate_packet_photo_workflow_source.sql:42-105`; `supabase/migrations/080_estimate_packet_manager_gate.sql:1-35` | Source |
| Exports are lead CSV, internal review JSON/CSV, VR walkthrough JSON, sketch PNG, browser print — no PDF/XLS/DXF/SKP | `app/export/page.tsx:13-35`; `lib/agent5/export.ts:10-20`, `:152-156`; `app/sketch/page.tsx:188-200`; `app/photo-estimate/page.tsx:431` | Source |
| Explicitly non-submittable: not ESX-compatible, not insurer-submittable, externally blocked | `lib/agent5/export.ts:1-20`; `scripts/supplement-review-ui-test.mjs:37`, `:69` | Source |
| Prototype/non-authoritative screens: `/ar` concept preview, `/drone` unconnected, `/pitch-gauge` redirects, `/vr` no 3D model, `/quantum` returns `Unknown`, `/pricing-config` PROTOTYPE, `/sign` no legal e-sign, `/integrations` all Unknown | `app/ar/page.tsx:17-18`, `:43-45`; `app/drone/page.tsx:8-17`; `app/pitch-gauge/page.tsx:43-45`; `app/vr/page.tsx:59-77`, `:97-104`; `app/quantum/page.tsx:20-30`; `app/pricing-config/page.tsx:155-186`; `app/sign/page.tsx:20-30`; `app/integrations/page.tsx:9-18`, `:29-41` | Source |
| Manual photo-verify checklist: 10 required categories incl. interior-ceiling/attic; quality `Not assessed` | `app/photo-verify/page.tsx:16-35`, `:37-64` | Source |
| Field albums only `general/before/damage/measurements/completed`; helper says local checklist only, no image inspection | `apps/field/App.tsx:173-174`, `:1285-1301`; `apps/field/src/ai/photoAssistance.ts:19-85` | Source |
| 108 migration count and head name consistent with README claim | README + `supabase/migrations/` | Source cross-check |

**Assessment from the audit:** RoofOS is a **review-gated roofing inspection and documentation system with emerging 2D AI measurement assistance**, not a photo-to-3D platform. Its chain currently reaches `capture → private storage → provenance → 2D suggestion/manual measurement → review → report/estimate packet`; it does not reach `guided capture → multi-view scan → photogrammetric 3D → automatic facet measurement → complete takeoff → design visualization → professional exports → external ecosystem integration`. This is a stronger foundation than a greenfield clone because provenance, authority boundaries, measurement governance and report discipline already exist.

### 3.3 The locked workflow is an asset, not an obstacle

`docs/EXACT-WORKFLOW.md` says: "This is the locked path. Do not invent a second one." That path is:

1. GPS must be **in the photo file**; nearby phone location does not count.
2. Address is read from the photo GPS, not typed.
3. Address is sent to **skyview** (top-down view).
4. A wizard measures the skyview with established formulas and returns drawing, measurements, and estimate.
5. Tech reviews and tags a lock only if correct.
6. Owner sets the approval sequence (no fixed ladder); each step is a lock.
7. Send only after all required locks; email or text.

This maps surprisingly well onto a Hover-style system if we treat the new 3D engine as a **replacement for step 3–4 only**, while preserving steps 1–2 (evidence provenance), 5 (human judgment), 6 (owner-configurable authority), and 7 (gated send). The parity program must not create a "second app" that bypasses those locks.

**Ruling for the roadmap:** the 3D measurement pipeline feeds the existing authority chain. It does not replace technician verification or owner sequence.

### 3.4 Gap list

| # | Gap | Severity | Notes |
|---|---|---|---|
| G1 | No ground-photo multi-view reconstruction | Critical | Skyview is single top-down imagery, not 8-view 3D |
| G2 | No metric-scale constraint solver / reference-length capture | Critical | Hover explicitly uses door/reference scale |
| G3 | No roof facet/pitch/hip/valley extraction | Critical | Core deliverable |
| G4 | No 3D web viewer / digital twin | High | Needed for design and trust |
| G5 | No material assignment on 3D geometry | High | Needed for design-to-estimate |
| G6 | No interior scan flow | High | Required by full parity choice |
| G7 | No DXF/SKP/ESX/XML/JSON exporters | Medium | Hover exports these; RoofOS status unknown |
| G8 | No benchmark/ground-truth harness | Critical | Cannot claim accuracy without it |
| G9 | No GPU worker tier | High | Local dev machine has no usable GPU (see §8) |
| G10 | No licensed data/commercial gate definitions | Medium | Needed for parity where OSS fails |

---

## 4. Target architecture

### 4.1 Principles

1. **Measurements are data, not pixels.** Store dimensions as versioned, sourced records with confidence and evidence references. The 3D model is a view over those records, not the source of truth.
2. **Scale must be explicit.** Every job records which anchors were used and their residuals. If scale cannot be established, the job is marked `Relative only` and cannot publish measurements.
3. **AI proposes; humans lock.** Preserve the RoofOS Golden Report authority model.
4. **Every job is reproducible.** Inputs, versions, model weights, rules, and corrections are immutable and auditable.
5. **Paid paths are gates, not defaults.** OSS is attempted first; escalation is explicit and recorded.

### 4.2 Component map

```text
apps/field (Expo)
  - GuidedCaptureScreen (8 slots + extras + reference measurement)
  - ImageQualityCheck (blur/light/EXIF/GPS)
  - OfflineUploadQueue (SQLite, checksum, resumable)
        |
        v
Supabase Storage (private, workspace-scoped)
        |
        v
Ingest API / Edge Function
  - EXIF parse, GPS validation, job record, immutable input manifest
        |
        v
Orchestrator (Temporal preferred; Celery/BullMQ fallback)
  - validate -> reconstruct -> scale -> segment -> measure -> QA -> render -> report
        |
        +--> GPU workers: COLMAP, OpenMVS/Meshroom, gsplat, SAM2/Grounded-SAM2
        +--> CPU workers: report generation, DXF, XLS, thumbnails
        +--> Postgres/PostGIS: jobs, measurements, footprints, audit
        |
        v
Measurement service
  - plane fitting, facet graph, linear features, pitch, openings
  - outputs MeasurementRecord[] with confidence + evidence
        |
        v
Web app (Next.js)
  - 3D viewer (splat + measurement overlay)
  - Review/correction UI with lock gating
  - Design/material assignment
  - Estimate generation from measurements + price books
  - Export center (PDF/XLS/XML/JSON/DXF; gated SKP/ESX)
```

### 4.3 New data entities (minimum)

| Entity | Purpose | Key fields |
|---|---|---|
| `scan_jobs` | One property structure capture | workspace_id, property_id, status, capture_mode (exterior/interior), provider_path (oss/commercial), created_by |
| `scan_images` | Immutable input manifest | job_id, storage_path, sha256, exif_json, gps_in_file, slot, role (model/evidence/damage), captured_at |
| `scale_anchors` | Metric constraints | job_id, kind (door/wall/bar/gps/footprint), observed_value, unit, source, confidence, residual |
| `reconstructions` | Versioned geometry outputs | job_id, engine_versions, manifest_hash, mesh_url, splat_url, metric_status |
| `measurement_sets` | Versioned measurement result | job_id, ruleset_version, status, confidence_summary, locked_by, locked_at |
| `measurements` | Individual facts | set_id, type (facet_area/pitch/ridge/...), value, unit, source_refs, confidence, correction_of |
| `evidence_links` | Traceability | measurement_id -> image_id/region/plane_id/model_version |
| `qa_events` | Human review trail | set_id, reviewer, action (accept/correct/reject), before/after, reason |
| `export_artifacts` | Generated deliverables | set_id, format, path, ruleset_version, sha256, created_at |

These tables must use **new migrations only**; the repo's migration ledger and protected workflow apply. Never edit applied migrations.

### 4.4 Pipeline stages and failure behavior

| Stage | Input | Output | On failure |
|---|---|---|---|
| Capture validation | images + EXIF | accepted/rejected images | Prompt recapture; never guess |
| Scale solving | anchors + camera priors | metric transform + residuals | `Relative only`; block measurement publish |
| Reconstruction | accepted images | sparse/dense geometry | VGGT fallback; otherwise manual measure |
| Semantics | geometry + images | roof/wall/opening masks | Mark `Unknown`; human annotates |
| Measurement | masks + planes + anchors | MeasurementRecord[] | Human measurement path remains available |
| QA | measurement set | accepted/corrected | Owner-defined lock sequence |
| Render/export | accepted set | 3D view + report | Retry; keep last good artifact |

---

## 5. Open-source stack catalog

The following is a condensed catalog from the dedicated stack research stream. Licenses and maturity are as reported in that research; verify at adoption time.

### 5.1 Capture and upload

| Component | License | Fit | Failure mode |
|---|---|---|---|
| Expo Camera / expo-image-picker | OSS ecosystem (verify package terms) | Guided 8-slot UI, EXIF/GPS fields | EXIF/GPS can be stripped or mutated; copy local URI immediately |
| react-native-vision-camera | MIT | On-device guidance, high-res frames | More native build complexity |
| react-native-exify | MIT | Read/write metadata | Android 10+ GPS redaction; handle `ACCESS_MEDIA_LOCATION` |
| SQLite upload queue pattern (e.g. Expo-imagesync demos) | Demo; productionize | Offline retry, backoff, checksum | Not a hardened sync service |

### 5.2 Reconstruction

| Component | License | Role | Notes |
|---|---|---|---|
| COLMAP | BSD | Geometric backbone: feature matching, SfM, bundle adjustment | Best default; needs overlap/texture; scale requires constraints |
| OpenMVS | AGPL-3.0 | Dense mesh/texture after COLMAP | AGPL obligations for distributed derivatives |
| Meshroom / AliceVision | MPL-2.0 | Node-based photogrammetry pipeline | CUDA/NVIDIA oriented; heavier packaging |
| OpenDroneMap / WebODM | AGPL-family | Aerial/drone orthomosaic, DEM, meshes | Heavier; better for aerial than 8 ground photos |
| VGGT | Code commercial-friendly since 2025; checkpoint licenses vary | Fast initializer/fallback | Metre-scale errors reported on large sets; not a measurement source |
| DUSt3R / MASt3R | CC-BY-4.0 / Dune license | Sparse-view fallback | Scale ambiguity; license caution |
| gsplat / Nerfstudio splatfacto | Apache-2.0 | Visual digital twin | Splats are presentation, not metrology |

**Rule:** train splats for viewing; measure from constrained mesh/planes.

### 5.3 Semantics and measurement

| Component | License | Role | Notes |
|---|---|---|---|
| SAM2 / Grounded-SAM-2 | Apache-2.0 | Roof/wall/opening segmentation | Masks are pixels, not dimensions |
| GroundingDINO | Apache-2.0 | Text-prompted object proposals | Domain validation needed |
| Depth Anything V2 | Code Apache-2.0; some weights non-commercial | Relative/metric depth aid | Check weight license for commercial use |
| Metric3D | BSD code; weight terms vary | Metric depth with known intrinsics | Wrong focal length corrupts results |
| RID / RID2 roof datasets | LGPL-3.0 / CC-BY-4.0 | Roof/superstructure training seed | Aerial domain shift vs ground photos |
| RoofSense / RoofNet | MIT / mixed dataset terms | Material classification | Dataset licenses can block commercial use |
| DeepRoofPlane | GPL-3.0 | Plane segmentation from point clouds | Aging dependencies |

There is **no open "Hover measurement model."** The measurement engine must be custom code: plane fitting, facet graph construction, intersection-derived ridges/hips/valleys, and rule-based takeoff math with unit tests.

### 5.4 Viewer, reports, infrastructure

| Layer | Choice | Notes |
|---|---|---|
| 3D viewer | SuperSplat Viewer (MIT), GaussianSplats3D (MIT), Babylon.js/3D Tiles for context | Add separate measurement overlay; do not measure in splat |
| DXF | ezdxf (MIT) | 2D measured plans; geometry not BIM |
| PDF | ReportLab (BSD-3-Clause) | Report generation; design your own QA |
| XLS/XML/JSON | Python libs / internal schema | Versioned schema required |
| IFC | IfcOpenShell (LGPL-3.0) | Only if BIM handoff is required |
| Orchestration | Temporal (MIT) preferred; Celery (BSD) or BullMQ (MIT) alternatives | Temporal for durable multi-stage jobs |
| Storage/DB | Supabase/Postgres + PostGIS, S3-compatible object store | Keep media out of Git/LFS |
| Free-tier reality | GitHub Actions has no useful GPU; LFS 10 GiB storage/10 GiB bandwidth | Production media/GPU needs separate infrastructure |

### 5.5 Reference/property data

OSM/Overpass, Microsoft US/Global Building Footprints, Google Open Buildings, OpenBuildingMap, county assessor data, NASA GIBS. Treat as **weak priors only**. Watch ODbL/share-alike and license conflicts (Microsoft footprint licensing differs between sources).

---

## 6. Accuracy and timing strategy

### 6.1 Scale anchors, in priority order

1. **Known reference length in scene** — door, garage door, wall run, deck rail, placed scale bar. Hover's own docs validate this approach.
2. **Accurate intrinsics** — EXIF focal length must be converted with sensor/crop knowledge; device calibration table recommended.
3. **GPS/GNSS priors** — weak (phone GPS often 3–10 m); use as weighted prior, not truth.
4. **Parcel/footprint geometry** — constrains outline/orientation, not eaves or pitch.
5. **Known verticals/levels** — ground plane, floor heights, door height.
6. **Survey control** — RTK/total station/scale bar for defensible work.

Every job must emit: anchors used, residuals, disagreement between anchors, reprojection error, GPS down-weighting flag, and final `metric_status` of `metric | relative-only | failed`.

### 6.2 Benchmark design

Create a golden set of **at least 50 properties** before claiming parity, stratified by:

- roof type: gable, hip, complex, flat, multi-facet;
- material: shingle, tile, metal, membrane;
- condition: foliage obstruction, snow, solar panels, steep back sides;
- capture quality: ideal 8-photo, extra photos, poor overlap, missing GPS;
- structure: single, detached garage, multi-structure.

Ground truth:

- tape/laser measurements for reference lengths and key facets;
- RTK drone or terrestrial LiDAR where available;
- licensed Hover output for the same property (obtained as a comparison artifact, not reverse-engineered code).

Metrics:

| Metric | Definition | Parity target (to be confirmed with owner) |
|---|---|---|
| Facet area error | abs(pred − truth)/truth per facet | median ≤ 3%, p90 ≤ 8% |
| Pitch error | degrees from truth | median ≤ 2°, p90 ≤ 5° |
| Linear feature error | ridge/eave/rake/valley length | median ≤ 2%, p90 ≤ 6% |
| Scale residual | anchor residual in inches | ≤ 1 in on good anchor |
| Time-to-report | upload → reviewable measurement set | ≤ 15 min standard, ≤ 5 min expedited |
| Human minutes | reviewer time to accept/correct | ≤ 10 min exterior |
| Publish rate | jobs passing metric QA without manual measurement | ≥ 80% ideal-capture set |

These targets are **proposed**, not yet owner-approved. They exist to make the parity conversation measurable.

How they relate to published Hover claims: Hover says "2–5%" for roof measurements but publishes no sample size or per-feature distribution, and no public Haag report was obtainable; the interior pilot's 97.74% floor / 96.73% wall figures are self-reported against an unnamed carrier's adjusters. Our median ≤3% facet-area target is therefore **at least as tight as the headline claim**, while p90 ≤8% acknowledges the tail that Hover's marketing does not publish. Time-to-report targets (≤15 min standard, ≤5 min expedited) sit inside the *faster* end of Hover's inconsistent public statements (minutes to 24 hours; ~1–2 h expedited) and must be validated against a real Hover job during Phase 0 before being treated as competitive. If Phase 0 shows Hover's actual p95 is materially slower, the SLA target should be reset from evidence rather than marketing.

### 6.3 SLA tiers (recommended)

| Tier | Meaning | Human lock required |
|---|---|---|
| Visual twin | 3D view only, no measurement claims | No measurements allowed |
| Estimated measurements | Metric from anchors, confidence scored | Tech lock required |
| Verified measurements | Benchmark-equivalent, evidence complete | Tech + owner sequence |
| Certified | Survey/LiDAR-backed | Separate external workflow |

This preserves the Golden Report rule: unknown facts say `Unknown`.

---

## 7. Full roadmap — all gates

Each phase ends with a reviewable artifact and a go/no-go gate. No phase assumes paid spend unless the gate is explicitly approved.

### Phase 0 — Discovery and ground truth (2–4 weeks)

**Goal:** Replace assumptions about Hover output with samples and establish a benchmark.

- Obtain one Hover exterior and one Hover interior sample output (PDF + JSON/XLSX/export formats if available) for a property we can measure independently. Request both Universal and LiDAR interior examples where possible.
- Archive the exact Hover JSON schema (`roof_facets`, `ridges_hips`, `valleys`, `rakes`, `gutters_eaves`, `pitch`, `waste_factor` for exterior; `floor_area`, `ceiling_edges`, `floor_edges`, `doors`, `windows`, `walls` for interior) so our measurement schema can be shaped to match rather than invented.
- Reconcile this report with `ContractorOS_Unified_Master_Dossier.pdf`, `ROOFOS-BUILD-CHECKLIST.md`, `HANDOFF.md`, `CURRENT-STATE.md`, and `main`.
- Build the golden-set protocol and data-capture consent form.
- Reproduce the existing RoofOS skyview path end to end in a fresh environment; document exact code paths (§3.2.1 is the starting map).
- Verify field app photo EXIF/GPS behavior on a real device (currently unverified), including Android 10+ GPS redaction risk.
- Decide whether blueprint upload (PDF/DWG/DXF) is an in-scope alternate input for Phase 1 or a later gate.

**Exit gate:** benchmark spec approved; Hover sample artifacts archived; source-of-truth reconciliation recorded.

### Phase 1 — Guided capture and ingest (3–5 weeks)

**Goal:** Capture eight structured views plus a reference measurement, with provable provenance.

- Add `scan_jobs`, `scan_images`, `scale_anchors` via new migration.
- Field UI: 8 side/corner slots, extras, damage photos, reference-measurement prompt, blur/light checks.
- Preserve and verify EXIF/GPS; reject photos without GPS on the locked path (per `EXACT-WORKFLOW.md`).
- Offline queue, checksum, resumable upload to private Storage.
- Ingest function builds immutable input manifest.

**Tests:** slot completeness; GPS-in-file rule; reference anchor stored; offline retry; workspace isolation.

**Exit gate:** 20 successful real-device captures with valid manifests; no secret files committed.

### Phase 2 — Reconstruction spike and metric scale (4–8 weeks)

**Goal:** Prove a measured 3D model is possible from our captures.

- COLMAP SfM with EXIF parsing and camera sharing groups.
- OpenMVS or Meshroom dense stage; gsplat for viewing.
- Constrained bundle adjustment with scale anchors and weighted GPS priors.
- `metric_status` enforcement: relative-only jobs cannot publish measurements.
- VGGT fallback for failures (license-checked checkpoint only).

**Tests:** known-length recovery on golden set; failure on missing anchor; reproducibility from manifest.

**Exit gate:** ≥ 60% of ideal captures reach `metric` status with ≤ 1 in anchor residual.

### Phase 3 — Measurement engine and evidence model (6–10 weeks)

**Goal:** Turn geometry into Hover-style facts.

- Plane fitting and facet graph; derive pitch, ridges, hips, valleys, eaves, rakes.
- SAM2/Grounded-SAM2 for openings, siding, gutters, soffit.
- Rules engine for pitch-adjusted squares and waste factors, versioned and unit-tested.
- `measurement_sets`, `measurements`, `evidence_links` tables.
- Human correction UI that creates `qa_events` and preserves before/after.

**Tests:** facet area/pitch against ground truth; unknown handling; every measurement has evidence; corrections versioned.

**Exit gate:** benchmark targets from §6.2 met on the ideal-capture subset.

### Phase 4 — Viewer, review locks, and exports (4–6 weeks)

**Goal:** Make the result usable and consistent with RoofOS authority.

- Splat/mesh viewer with measurement overlay and evidence-photo links.
- Material assignment on mesh segments (glTF materials).
- Review UI implementing `EXACT-WORKFLOW.md` locks and owner-defined sequence.
- Exporters: PDF, XLS, XML, JSON, DXF. SKP/ESX/DWG gated pending licensing evaluation.
- Golden Report integration: sourced claims, `Unknown`, signature, manager approval.

**Tests:** lock sequence cannot be bypassed; report claims trace to measurements; exports reproduce from versioned ruleset.

**Exit gate:** a complete job can be reviewed, locked, exported, and sent without leaving RoofOS.

### Phase 5 — Design and estimate integration (4–6 weeks)

**Goal:** Close the "Dream and design → Fair estimation" half of Hover.

- 2D design from a captured photo (material/color preview).
- 3D design on the digital twin with per-segment materials.
- Estimate generation from measurement set + existing price books + retailer references.
- Multiple comparison estimates; no AI-written money amounts.
- Approval gates reused from existing estimate flow.

**Exit gate:** design choices deterministically change material quantities and estimate lines with an auditable diff.

### Phase 6 — Interior scans (6–12 weeks, gated research first)

**Goal:** Full-parity interior coverage.

- Spike: reproduce Hover interior output shape from a real sample; lock the field set from the Hover JSON reference (`name`, `floor_area`, `ceiling_edges`, `floor_edges`, `max/min_ceiling_height`, `combined_walls_doors_windows_openings_area`, `doors`, `windows`, `openings`, `walls`).
- **Track A — Universal (mandatory):** room-by-room phone scan with perimeter tracing for large rooms, doorway up/down "paint" for small rooms, hallway-as-own-space, connected-room/photo-trail rules, low-light guidance, and a per-level review step. This must work on any device.
- **Track B — LiDAR (optional accelerator):** evaluate iPhone Pro/iPad Pro LiDAR APIs for real-time wall outlines and room connectivity; emit the same schema as Track A. Gate on device availability, not on product necessity.
- Interior reconstruction: room segmentation, wall/floor/ceiling planes, cabinets and openings; 2D sketch plus 3D walkthrough presentation.
- Interior measurement rules and report sections; same Golden Report authority model; incomplete rooms explicitly reported as `Unknown` rather than estimated.
- Benchmark against tape/LiDAR on at least 20 rooms, including the Hover failure cases (disconnected rooms, high ceilings, dark interiors).

**Gate:** if OSS interior accuracy cannot meet the target, escalate to a licensed scanner/sensor gate (paid, approval required). Report incomplete rooms and require a new scan rather than billing/accepting a partial model — matching Hover's own rescan economics.

### Phase 7 — Scale, reliability, and cost controls (ongoing)

- Temporal workflows, retries, GPU autoscaling, model caching.
- Dataset flywheel: corrections become evaluation/training data with consent.
- Cost per job dashboard; free-tier limits monitored.
- Security: RLS preserved, signed links, no public buckets, no security disablement to pass tests.

### Phase 8 — Commercial/data gates (approval required)

| Gate | What it buys | When to trigger | Approval |
|---|---|---|---|
| Commercial photogrammetry (Metashape/Pix4D/RealityScan/Postshot) | Stable geometry where OSS fails | < 80% publish rate after Phase 3 | Owner, paid |
| Licensed aerial/imagery (EagleView/Nearmap/Maxar) | Current high-res roof/property data | Coverage or freshness gap | Owner, paid |
| Property/parcel APIs (commercial aggregate, USPS) | Address/attribute completeness | Manual address gaps | Owner, paid |
| Google Solar Building Insights | Roof segment prior where coverage exists | Weak SfM properties | Owner, terms review |
| Xactimate/ESX-compatible tooling | Insurance workflow compatibility | Carrier requirement | Owner, paid/licensed |
| GPU capacity (self-hosted or rented) | Turnaround parity | p95 > SLA | Owner, budget |
| RTK/LiDAR sensor | Certified tier | Certified product requirement | Owner, capital |

No gate is automatic. Each requires a written finding that OSS failed the benchmark, an estimated cost, and explicit owner approval.

---

## 8. Cost and infrastructure reality

### 8.1 Local environment measured in this session

| Resource | Observed | Implication |
|---|---|---|
| CPU | 2 cores, Intel Celeron N4000 @ 1.10 GHz | No local SfM/dense reconstruction |
| RAM | 2.7 GiB total, ~0.9 GiB available | COLMAP/OpenMVS infeasible locally |
| GPU | None (`nvidia-smi` absent) | No local gsplat/SAM2 training or inference |
| Disk | 16 GB total, ~7 GB free | Cannot hold image/mesh corpora |
| Docker | Not installed | Self-hosting stack not runnable here |
| Node | v26.13.1 | Fine for repo tooling |

**Conclusion:** all reconstruction work must run on a separate GPU-capable environment. GitHub Actions free tier is for tests/builds, not reconstruction. This is a hard constraint, not a preference.

### 8.2 Free-tier envelope

- GitHub Free: source, CI for lint/tests/builds, small fixtures only. LFS 10 GiB storage + 10 GiB monthly bandwidth; hosted runners have no useful GPU.
- Supabase free tier: suitable for prototype data volume, not large media or GPU workloads.
- Self-hosted Supabase Docker needs roughly 12 GB images, ~1.5 GB idle RAM, 40 GB disk — beyond the current dev machine.
- OSS licenses are free in money but not in obligation: AGPL (OpenMVS, ODM), ODbL (footprints), non-commercial weights (some Depth Anything variants), Dune license (MASt3R) require review before product use.

### 8.3 Cost model shape (no prices assumed)

```
per job cost = storage + GPU-minutes(SfM + dense + splat + inference) + CPU-minutes(report)
             + optional licensed data/API fees (gated)
```

Track it from Phase 1. Parity is meaningless if each job costs more than Hover's price.

**Published price ceiling (public Hover list prices, accessed 2026-11-23):** exterior projects **$39–$139** depending on plan and facet complexity, interior **$29–$89**, blueprint jobs from **~$55**, expedited **+19 to +40**, with Pro $999/year and Business $2,999/year subscriptions altering effective unit cost. First three Starter projects are free. No prices are adopted here — these are the **competitive reference** the cost model must beat or match. A self-hosted chain that costs $60+ in GPU time per exterior job is not parity even if its numbers are perfect. This is why §7 Phase 7 makes cost-per-job a first-class gate and why paid escalation (Phase 8) requires a written finding that OSS failed the benchmark *and* a cost comparison against this ceiling. Public Hover pricing pages disagree with each other (annual vs "$99/month" Pro, $19 vs $40 expedited), so the ceiling must be re-verified against an authenticated account before it drives a spend decision.

---

## 9. Risk register

| Risk | Impact | Mitigation |
|---|---|---|
| Hover output cannot be obtained for benchmark | Cannot verify parity claims | Gate Phase 0; use public PDF examples + independently measured property |
| EXIF/GPS stripped by field app | Breaks locked path and scale | Real-device test in Phase 0; explicit recapture/fallback |
| Reference measurement not collected | No metric scale | Mandatory UI step; block publish |
| Splat mistaken for measurement source | Wrong numbers presented confidently | Enforce measurement records; splat viewer cannot emit dimensions |
| License contamination (AGPL/ODbL/non-commercial weights) | Legal/product constraint | License review at adoption; keep an allowed-components ledger |
| AI report writes money | Violates Golden Report | Estimator uses rules + human-approved prices only |
| Paid gate triggered without approval | Owner authority/cost violation | Written finding + explicit approval; no auto-fallback |
| Interior remains unverified | Full parity claim false | Phase 6 research gate; downgrade to `Visual only` if unresolved |

---

## 10. Immediate next 30 days

1. Approve this report as the program charter, or mark corrections.
2. Reconcile it with the approved dossier and build checklist (owner directive).
3. Obtain Hover exterior + interior sample outputs; archive in `docs/evidence/hover-parity/`.
4. Create the benchmark spec and golden-set capture protocol.
5. Implement Phase 1 capture/ingest behind a feature flag, test-first, in a new worktree.
6. Run `npm run test:reliability` and the repo's full checks before any merge; keep the checkpoint law.

---

## 11. Work-package skill audit ledger

Owner directive: review every upstream Superpowers skill at the start of each work package. Local inventory reviewed from the installed Superpowers package (15 skills) plus two RoofOS-local skills discovered in this worktree.

| Skill (source) | Reviewed | Applied action / evidence | Status | Blocker / next action |
|---|---|---|---|---|
| using-superpowers (upstream) | Yes | Skill check before research; announced brainstorming, firecrawl, dispatching-parallel-agents, worktrees, reliability, verification | performed | none |
| brainstorming (upstream) | Yes | Reconciled request with repo; laid out three roadmap stances; owner chose full parity with all gates | performed | design doc approval pending |
| writing-plans (upstream) | Yes | Used its structure for phase tasks, acceptance gates, and file/data model decisions; no implementation plan committed yet | performed | After approval, produce `docs/superpowers/plans/...` |
| using-git-worktrees (upstream) | Yes | Native worktree tool failed twice; git fallback created `/home/rlongmbox/projects/roof-os-hover-parity` on `docs/hover-parity-roadmap`; session moved there | performed with fallback | Native tool failure recorded as ruling |
| test-driven-development (upstream) | Yes | This work package writes no production code; TDD applies to each later implementation task, RED→GREEN must be recorded there | not triggered | Trigger at Phase 1 |
| systematic-debugging (upstream) | Yes | No bug under investigation; root-cause method reserved for pipeline failures | not triggered | Trigger on first failed benchmark/test |
| executing-plans (upstream) | Yes | No approved execution method chosen for implementation; this report is not plan execution | not triggered | Owner chooses inline vs subagent after approval |
| subagent-driven-development (upstream) | Yes | Reviewed gates; no implementation plan exists yet. Research subagents were used under dispatching, not as implementers | not triggered | Trigger when plan approved |
| dispatching-parallel-agents (upstream) | Yes | Three independent research streams dispatched in parallel: Hover workflow, RoofOS audit, OSS stack. All three returned; Hover and RoofOS findings integrated into §2.7–§2.9 and §3.2.1 | performed | none |
| requesting-code-review (upstream) | Yes | No implementation diff to review; a reviewer should check this report against the dossier | not triggered | Request review after owner approval |
| receiving-code-review (upstream) | Yes | No review feedback received yet; will verify against code/dossier before acting | not triggered | Trigger on feedback |
| verification-before-completion (upstream) | Yes | Ran `node scripts/reliability-check.mjs` → 14/14 PASS; no completion/deployment claims made | performed | Full repo checks before merge |
| finishing-a-development-branch (upstream) | Yes | Work is a draft in a worktree; no merge/PR request yet | not triggered | Owner chooses integration after review |
| writing-skills (upstream) | Yes | No SKILL.md authored or edited; RoofOS-local skills were read only | not triggered | none |
| diagnosing-superpowers (upstream) | Yes | No session-failure complaint under investigation | not triggered | none |
| reliability (RoofOS local) | Yes | Applied evidence-gating: source-tested vs database-tested declared; no security changes | performed | Database verification remains separate |
| verification (RoofOS local) | Yes | Deterministic check executed locally: 14 PASS, exit 0 | performed | Hosted-DB path not run |

**Rulings recorded:**

- `Ruling: Native worktree creation failed twice — use git worktree fallback at a sibling path — avoids modifying main's .gitignore for a docs-only work package; cost is harness-managed cleanup not being available.`
- `Ruling: Treat the new 3D pipeline as a replacement for skyview measurement only, not a second workflow — preserves the locked EXACT-WORKFLOW authority chain; cost is that skyview-specific codepaths need explicit adaptation.`
- `Ruling: Splats are presentation, meshes/planes are measurement — prevents visually plausible but unverifiable dimensions; cost is maintaining two representations.`

---

## Appendix A — Sources

### Hover (all accessed 2026-11-23)
- [S1] Exterior scans — https://help.hover.to/en/articles/9185612-exterior-scans
- [S2] Exterior photo best practices — https://help.hover.to/en/articles/9201273-exterior-photo-best-practices
- [S3] Adding reference measurements — https://help.hover.to/en/articles/9189711-adding-reference-measurements-for-exterior-projects
- [S4] Common exterior scan questions (construction) — https://help.hover.to/en/articles/13168720-common-exterior-scan-questions-from-construction-pros
- [S5] Common exterior scan questions (insurance) — https://help.hover.to/en/articles/13996006-common-exterior-scan-questions-from-insurance-pros
- [S6] How to upload a blueprint — https://help.hover.to/en/articles/6383819-how-to-upload-a-blueprint
- [S7] On-demand expedited — https://help.hover.to/en/articles/9033659-on-demand-expedited-ode
- [S8] Roofing contractors — https://hover.to/for/roofing-contractors
- [S9] Roof measurements — https://hover.to/measurements/roof
- [S10] Measurements — https://hover.to/measurements/
- [S11] Understanding Hover's measurement PDF — https://help.hover.to/en/articles/1215021-understanding-hover-s-measurement-pdf
- [S12] JSON measurement reference — https://developers.hover.to/reference/get-json-measurements.md
- [S13] Developer usage instructions — https://developers.hover.to/docs/usage-instructions
- [S14] Developer llms.txt — https://developers.hover.to/llms.txt
- [S15] Pricing — https://hover.to/pricing/
- [S16] Integrations — https://hover.to/integrations
- [S17] Interior scan — Universal — https://help.hover.to/en/articles/9264961-how-to-scan-an-interior-space-universal
- [S18] Interior scan — LiDAR — https://help.hover.to/en/articles/9268585-how-to-scan-an-interior-space-lidar
- [S19] Interior best practices — https://help.hover.to/en/articles/9426874-best-practices-for-scanning-interiors
- [S20] US9437033B2 — https://patents.google.com/patent/US9437033B2/en
- [S21] US10776999B2 — https://patents.google.com/patent/US10776999B2/en
- [S22] US10861224B2 — https://patents.google.com/patent/US10861224B2/en
- [S23] US10902672B2 — https://patents.google.com/patent/US10902672B2/en
- [S24] US11113877B2 — https://patents.google.com/patent/US11113877B2/en
- [S25] US11721066B2 — https://patents.google.com/patent/US11721066B2/en
- [S26] US12573144B2 — https://patents.google.com/patent/US12573144B2/en
- [S27] Roofing Contractor, connected platform, 2026-01-15 — https://www.roofingcontractor.com/articles/101753-hover-launches-connected-visual-ai-platform
- [S28] Roofing Contractor, 30-minute squares, 2018-03-01 — https://www.roofingcontractor.com/articles/92737-hover-launches-solution-to-deliver-roof-squares-within-minutes
- [S29] Interior accuracy carrier case study, 2025-06-13 — https://hover.to/blog/interior-accuracy-and-roi-convince-a-leading-carrier-to-choose-hover
- [S30] Hardie Designer press release, 2025-04-23 — https://www.prnewswire.com/news-releases/james-hardie-debuts-hardie-designer-powered-by-hovers-ai-technology-302435260.html
- [S31] Estimate on Demand, report comparison — https://estimateondemand.com/roof-measurement-reports-accuracy-roofers/
- [S32] Roofing Software Guide, Hover Review 2026 — https://roofingsoftwareguide.com/reviews/hover-review/
- [S33] MarketScale, Trussi integration — https://www.marketscale.com/industries/engineering-and-construction/hover-3d-roof-measurements-now-flow-straight-into-trussi-roofing-estimates
- [S34] Hover blog, aerial vs Hover — https://hover.to/blog/aerial-roof-measurements-vs-hover-accurate
- Also: https://hover.to/how-it-works/ , https://hover.to/product

### RoofOS repository
- `README.md`, `CURRENT-STATE.md`, `PRODUCT-VISION.md`, `GOLDEN-REPORT.md`
- `docs/EXACT-WORKFLOW.md`
- `AGENTS.md` (owner directive, 2026-11-16)
- `.agents/skills/reliability/SKILL.md`, `.agents/skills/verification/SKILL.md`

### Open-source stack (from dedicated research stream)
- Reconstruction: colmap/colmap, cdcseacave/openMVS, alicevision/meshroom, OpenDroneMap/ODM, facebookresearch/vggt, naver/dust3r, naver/mast3r, nerfstudio-project/gsplat
- Semantics: facebookresearch/segment-anything-2, IDEA-Research/Grounded-SAM-2, idea-research/groundingdino, DepthAnything/Depth-Anything-V2, YvanYin/Metric3D, TUMFTM/RID, DimitrisMantas/RoofSense
- Viewer/export: playcanvas/supersplat-viewer, mkkellogg/GaussianSplats3D, mozman/ezdxf, ReportLab, IfcOpenShell
- Infrastructure: temporalio/temporal, celery/celery, taskforcesh/bullmq, supabase self-hosting docs, GitHub billing/free-tier docs
- Reference data: microsoft/USBuildingFootprints, microsoft/GlobalMLBuildingFootprints, Google Open Buildings, OpenBuildingMap, Overpass API, NASA GIBS, county assessor open data examples

### Commercial gates (named, not adopted)
- Agisoft Metashape, Pix4D,Capturing Reality, Postshot
- EagleView Property Data API, Nearmap APIs, Maxar/Vantor imagery
- Google Solar API Building Insights
- Xactimate/ESX-compatible tooling

## Appendix B — Open questions for the owner

1. Are the proposed parity targets in §6.2 acceptable, or should they be tighter/looser?
2. Do we already possess a licensed Hover account/output to use as benchmark evidence — exterior PDF and JSON, interior Universal and LiDAR samples?
3. Which jurisdiction's building-code and insurance-report rules must the report satisfy first, and is the insurance workflow an early gate given Hover's Xactimate/Cotality position?
4. Is interior parity a launch requirement or a Phase 6 follow-on despite the "all gates" decision?
5. What is the maximum approved monthly spend before a paid gate needs re-approval?
6. Should blueprint upload (PDF/DWG/DXF) be in Phase 1 as a non-photographic input and ground-truth source, or deferred?
7. Do we accept Hover's published $39–$139 exterior / $29–$89 interior price range as the competitive ceiling, or do we target a lower price point?
8. Is Legal review required before adopting AGPL-licensed OpenMVS/ODM, ODbL building footprints, or non-commercial Depth Anything weights?
9. Who owns the benchmark ground truth and signs off on "parity achieved" — engineering, the technician review role, or the owner sequence?
