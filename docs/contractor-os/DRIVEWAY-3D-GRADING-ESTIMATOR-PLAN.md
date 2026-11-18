# BAILEY BOSS / ContractorOS — Driveway Grade, Earthwork and 3D Estimator

**Evidence date:** 2026-11-17  
**Source of truth:** current `Gtownrter77/roof-os` `main`, beginning with merge `e2740b4a7d1ab6319d4c07edd408ffaa1e74a7cd`.  
**Decision:** owner-approved comprehensive ContractorOS dossier remains in force: all 20 AI functions, nine releases, web/mobile, least-privilege governance and manual fallback. This document defines a **new required construction-domain vertical slice**, not a substitute for any existing release.  
**Status:** researched and **pure deterministic quantity kernel implemented on this isolated PR branch with recorded RED→GREEN unit tests**. No connected driveway UI/GIS, mobile workflow, customer estimate or production acceptance is implemented; no customer/site measurements, grades, prices, soil strengths, permits or tonnages invented.

## 1. Contractor outcome and initial use case

Allow a contractor who is remote from a property (e.g., a driveway in Michigan evaluated from outside Atlanta) to enter only the address to **begin** an inspection, research legitimately available public images and terrain context, trace/adjust the driveway in an aerial/map view, identify entrance/bottom drainage issues, review measured elevations or survey inputs, estimate cut/fill/rebuild quantities under an explicit calculation version, view before/after concepts in 3D and prepare a clear **provisional** bid. Work must continue if no aerial image or elevation provider is available, with a manual photo/sketch/field-measurement path that does not secretly pretend an unavailable image exists.

**Release boundary:** Aerial appearance and public DEM slope are not a certified site grade or geotechnical finding. A final earthwork, runoff or road-interface price requires measured control points, cross-sections, local code/right-of-way/culvert requirements, utility locates, locally validated supplier prices and owner authorization; specialist review when safety/structural/drainage design warrants it.

## 2. Fresh 3D plugin/app capability matrix

| App / engine | Verified available capability from inspected tool contract | Use in ContractorOS | Limitation / cost gate |
|---|---|---|---|
| **3D Garden Designer** | Editable 2D measured yard boundaries, paths, landscaping, garden walls, 3D concept link; computes path length and area | Yard/drive concept and landscaping, later retaining walls | **First model is flat ground**; no vertical elevations/cut-fill survey |
| **MimartLabs** | Architectural CAD plans, structural scene objects, walls, dimensions, sections and drawing exports | Sidewalk/retaining-wall structural illustrations, permit packet supplements | CAD scene measurements do not prove surveyed real terrain, US lot data or wall engineering |
| **Blendstra (Blender-based)** | Blender Python scripted geometries, materials, scene and 3D-model renders | Terrain/driveway cross-sections, earthwork animation and proposal visual | Hosted renders can consume quota/charges. Check budget and set max charge to **$0** where supported, or do not invoke |
| **Spline** | Interactive 3D scenes, animation, cameras and publishing tools | Optional phone/web 3D proposal viewer and before/after visuals | Conceptual presentation only; account/quota limits must be checked |
| **kernelCAD** | Parametric BREP CAD parts, checks and fabrication outputs | Drain components, hardware, dimensioned cabinet/hardware features | Free-tier successful generation consumes monthly part quota; not an elevation data source |
| **Flatma** | Panel-based cabinetry construction model with sheet dimensions and cut-style parameters | Cabinets and millwork **later**, not driveway grading | Maximum 1800 mm W × 2200 mm H × 1500 mm D; panel-only |
| **AI Architectures** | House-floor-plan search and CAD drafting | Building-remodel modules later | No field driveway grade survey |
| **convert3d** | Converts existing CAD/3D files to GLB, STEP, STL, etc. | Reuse/export independently verified scene geometry | Converts representation, **not** measurement truth |
| **QGIS / GDAL / MapLibre GL JS** | GIS georeferencing, raster/vector processing, open map rendering | Primary free/open-source geospatial model + imagery/terrain review | Provider data availability, attribution, CRS/vertical datum and licenses must be checked per source |
| **OpenDroneMap (ODM)** | Photogrammetric point cloud, orthophoto, elevation model and 3D model from appropriate overlapping image sets | Optional surveyed/controlled drone photogrammetry later | A single arbitrary photo cannot produce a reliable calibrated DEM; compute/storage demands and AGPL implications require review |

Checked open-source references (license statements in linked repositories, not a procurement promise):
- QGIS GPL-2-or-later: https://github.com/qgis/QGIS
- GDAL MIT/X-style: https://github.com/OSGeo/gdal and https://gdal.org/en/stable/license.html
- MapLibre GL JS BSD-3-Clause: https://github.com/maplibre/maplibre-gl-js
- ODM AGPL-3.0: https://github.com/OpenDroneMap/ODM
- Blender GPL (verify version/binary distribution): https://github.com/blender/blender
- USGS 3DEP data/accuracy context: https://www.usgs.gov/faqs/what-vertical-accuracy-3d-elevation-program-3dep-dems

**Critical terrain limitation:** USGS currently states the multi-resolution 3DEP dynamic elevation service (including some 1 m lidar-derived DEM) has **0.53 m RMSE**; a small driveway drain depression may be much smaller than the data's potential error. Store actual source-specific accuracy and acquisition dates, not a blanket grade certification. Reference: USGS link above. Concept estimates only until field profile/datum independently validated.

## 3. Inputs, trust levels and provenance

| Input | Mandatory recorded fields | Quality class | Fail-closed consequence |
|---|---|---|---|
| Property | normalized address, human-selected geocode, source/date and parcel match | address-only | Start inspection without demanding photo; no numeric area until scale/trace available |
| Aerial/photo | original file or signed/legal image URL, capture date, attribution/terms, resolution/scale and map CRS | image/trace | No fabricated imagery or geometry; manual fallback |
| Terrain | DEM/point-cloud source, point location, acquisition, cell size, horizontal CRS, **vertical datum**, vertical uncertainty | coarse public context | Do **not** label a coarse terrain estimate as field grade |
| Field survey | benchmark/datum, elevation units, station chainage, high/low points, cross-sections, equipment, observer, timestamp, attachments | surveyed/reviewed | Final grade-dependent bid release blocked until accepted |
| Surface | measured driveway stations, width/crossfall, existing asphalt/concrete/gravel thicknesses, repair scope, drainage boundaries and road interface | provisional/reviewed | No blanket depth, slab design or structural conclusion |
| Price | supplier name/region, date, accepted unit, verified delivered/compacted yield or density, haul/disposal rate, labor/equipment, tax and owner margins | owner-priced | No tonnage, total or customer proposal without complete priced items |
| Review | original evidence hash, derivation version, reviewer, decision, correction reason, expected revision and signed approval | approved | Customer-facing amount never self-approves via AI output |

Privacy controls: workspace-scoped authorized read/write, signed storage URLs, source retention/revisions, disabled third-party data upload by default, private addresses not sent to anonymous public search or visualizer without explicit reviewed policy. AI-generated conclusions are suggestions only; deterministic calculations cannot be replaced by model guesses.

## 4. Accurate deterministic quantity engine (no magic densities)

**Segment definition:** measured horizontal length `L_ft`, starting/ending widths `W0_ft, W1_ft`, and reviewed positive construction layer depth `D_in`. A tapered segment:
- `area_ft2 = L_ft × (W0_ft + W1_ft) / 2`
- `volume_ft3 = area_ft2 × D_in / 12`
- `volume_yd3 = area_ft2 × D_in / 324`
- `grade_percent = (elevation_end_ft - elevation_start_ft) / horizontal_run_ft × 100`
- `crossfall_percent` uses measured side-to-side elevations divided by measured width.
- `cut_yd3, fill_yd3`: compute from documented existing and proposed elevation surfaces, station/grid sampling and explicit integration method; **do not** infer earthwork solely from pavement layer volume.
- **Mass in tons requires a signed supplier material unit-weight / yield** tied to moisture/compaction/measurement basis. `tons = cubic_yards × supplier_tons_per_cubic_yard` only with that verified basis. Export each rounding decision and preserve unrounded internal quantities.

Constraints: finite, positive spans/widths, bounded depth and plausible grade checks with configurable warning thresholds (do not invent regional code limits); identical station coverage and closed/valid non-overlapping footprints; source unit conversions with tests; no negative/as-designed impossible materials; protect existing slope-calculation rules from unrelated roofing changes. Preserve the distinction between construction aggregate, spoil haul, concrete, asphalt and drainage gravel quantities. Never turn a prior "150 lb" input into dozens of tons without units, measured depth and density validated.

## 5. Application flow

```text
Address first (no mandatory photo)
  → verified parcel + legal imagery lookup or unavailable/manual fallback
  → driveway footprint & width/stations drawn and owner-edited
  → existing DEM context overlaid, accuracy/vertical datum shown
  → local field elevations and known benchmark recorded/accepted
  → station profile & bottom-drainage/road-interface hazard review
  → design alternative revision (patch, mill/overlay, excavate/rebase, full rebuild)
  → deterministic cut/fill/pavement/drainage quantity ledger
  → local supplier prices/yields, labor, equipment and haul
  → provisional bid (pending), owner approval/release (if evidence adequate)
  → optional 3D comparison, printable evidence/quantities and next inspection action
```

**Michigan field prompts (not assumptions):** road apron ownership/right-of-way and municipal/county permit responsibility; catch basin, roadside ditch or culvert condition; utility locate before ground disturbance; freeze-thaw/heave and subbase conditions; runoff routing so no unapproved discharge onto street/neighbor. Check exact municipality/county before citing code or assigning a permit requirement. Show alternatives separately with engineering caveats, not one fabricated turnkey cost.

## 6. Efficient implementation phases and repositories

1. **R1-contracts:** create versioned evidence, measurement/grade authority, benchmark and proposal status contracts that reuse the ContractorOS control-plane tables *only when the actual active schema is verified*. Migration 102 is source-only currently; neither it nor draft 103 may be assumed applied.
2. **R2-grade kernel [source implemented; CI gate still applies]:** `lib/measurements/driveway-earthwork.ts` is an isolated, strictly measured, no-pricing math helper: tapered segment area/volume; benchmark-based grade; explicit constant-elevation survey-cell cut/fill; supplier evidence + matching volume basis before tonnage. `scripts/driveway-earthwork-test.mjs`, `npm run test:driveway-earthwork`, and the dedicated/final web CI jobs enforce regressions. The helper does **not** fetch imagery, read the user's survey, drive a UI or approve an estimate.
3. **R2-GIS interface:** address-first property selection; licensed/attributed raster/footprint lookup; owner outline and stations; USGS 3DEP context with cell size/error displayed; map coordinate conversion and source-state unavailable fallback. Reuse existing MapLibre/Turf dependencies, avoid new paid APIs.
4. **R2/R3-review:** web UI for approved elevation benchmark, station geometry, design choices, cut/fill review, quantities and corrections; original versions never overwritten. Offline/mobile input sync and conflict resolution share same domain math.
5. **R3-R5-commercial/workflow:** alternative estimate pricing from real local suppliers, actual truck/haul/disposal rates, labor/equipment and overhead, owner-rule approvals, contract revision, production readiness and vendor/order workflows.
6. **3D presentation adapter:** optional **deterministically scaled** terrain mesh from measured/declared surfaces, profile station labels and elevation-uncertainty banner; export GLB for a viewer and optionally Spline/Blendstra. Rendered appearance must not upgrade provenance. No paid render calls without owner approval or explicit $0 budget.
7. **Follow-on domains:** reuse geometry/evidence engine for retaining walls, drainage, landscaping/earthworks, then cabinet measurement/cutlists through Flatma/kernelCAD. Each requires its own load/support/utility/engineering verification and unit rules.

Use a single GitHub repo, no local Chromebook clone except SD3 on the actual user device, no second company app, no premium/geospatial API fees or hosted 3D compute without a price check. Never downgrade the dossier's 20 AI functions or nine releases to a smaller optional feature set.

## 7. Test-first acceptance and blocked release gates

| Test case | Required evidence |
|---|---|
| Address-only property | UI starts without photo and clearly says unavailable when no usable imagery |
| Geometry | Self-intersection/overlap, wrong CRS/units, stale edits, duplicate/split planes and bad scale refused |
| Elevation | Unspecified/mismatched vertical datum, DEM out of coverage, stale/missing survey and high uncertainty block release |
| Quantity | Rectangular/tapered footprint, crossfall, profile grade, layer conversion, station cut/fill verified by independent fixtures |
| Aggregate haul | `tons` unavailable with no verified compacted/material yield; prevent lb/ton/yd³ confusion |
| Scope/approval | Outside-workspace requests denied, stale revisions denied, duplicate save idempotent, paused mandate blocks effects |
| Corrections | Human overwrite creates a version; owner takeover, offline reconnect, restore/replay preserve originals |
| Price | No customer quote without local date-stamped rates, waste/contingency assumptions and review |
| 3D integrity | Model units match numeric geometry; any exaggeration is visually marked and excluded from material takeoff |
| Release | Build/typecheck/CI, synthetic RLS and live approved staging, device test, backup+rollback, field benchmark, licensed imagery, owner acceptance separately captured |

**Operational status:** the pure math fixtures are source-level tested only; every genuine site, GIS, UI, mobile, cross-workspace and commercial acceptance case remains **unverified** for a driveway. Existing roof/CRM CI cannot substitute for those. A successful source-only vertical slice is not a finished remote driveway estimate.

## 8. Superpowers applicability (no skipped skill names)

This document is a scoped design/implementation plan; it is *not* evidence of execution of all skill actions.

| Upstream Superpowers skill | This slice status |
|---|---|
| using-superpowers | Prior full 15-skill source review referenced; requirements applied |
| brainstorming | Owner's existing approved dossier and driveway intent used, no fresh mockup sign-off |
| writing-plans | This dependency/acceptance roadmap authored |
| using-git-worktrees | Local SD3 inaccessible through GitHub connector; separate GitHub branch used instead |
| test-driven-development | **Performed for the pure math sub-slice:** initial test/CI-only PR head `ee709177b48ad237f806bfd75599dc11aa335d49` failed exactly with ERR_MODULE_NOT_FOUND at `earthwork-precision` job `134173178277` before implementation; after implementing module at `d92c161eba1570187f079195380a41d54612490e`, the same isolated test passed. This is unit-source evidence, not field verification |
| systematic-debugging | Capability boundaries audited; no failed driveway runtime investigated |
| executing-plans | Partial: implemented tested R2 pure calculation kernel; geospatial sourcing, actual grade capture and estimate workflow remain to be built |
| subagent-driven-development | No independent implementer dispatched; blocked/not claimed |
| dispatching-parallel-agents | Not used; dependent grading/evidence kernel must be implemented in order |
| requesting-code-review | New PR + CI is a gate, not an independent review |
| receiving-code-review | Not triggered without actual reviewer comments |
| verification-before-completion | RED and GREEN isolated CI verified for synthetic math only; latest PR full CI, field and authenticated runtime remain separate pending gates |
| finishing-a-development-branch | PR verification/merge to be recorded against exact head |
| writing-skills | No reusable `SKILL.md` added |
| diagnosing-superpowers | Not requested; no forensics run |

**Source of evidence:** GitHub merger docs, inspected installed plugin action descriptions, and the four open-source projects linked above. Keep each label honest; do not mark field-tested, code-implemented, deployed or vendor-priced without specific evidence.
