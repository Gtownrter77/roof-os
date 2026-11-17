# BAILEY BOSS — Dossier 1 × Dossier 2: Complete Reconciliation and Roof Measurement Engineering Addendum

**Audit date:** 2026-11-17  
**Authority:** Dossier 1 remains the controlling approved scope. This document is a proposed **additive R2 measurement specification**, not a rewrite of the master, a proprietary Roofr disclosure, a production certification, or authorization to deploy.  
**Repository:** `Gtownrter77/roof-os`, inspected `main` baseline `29f9e323fa4906a891baec201ced024f87d4101b`.  
**Source 1:** Owner-supplied `ContractorOS_Unified_Master_Dossier.pdf` (16 pages, §§1–38; SHA-256 `55a6ec2dce61299cf9eee47c2276c66f6436510713f1aea3e29cb2e6a605f5e3`). Its own preface calls it a *proposed consolidated implementation baseline* and disclaims line-by-line reconciliation; the owner nevertheless mandates its full functional scope.  
**Source 2:** User-supplied `roofr_measurement_master_dossier.md` (17 sections; 467 physical lines plus display newline / ~468 viewed; SHA-256 `43c6fcf84d3bf567604dba8bdc70bf3c20657b35328c1348fe19af8814e5d3ac`). This source has **no demonstration of access to Roofr proprietary internals**. Its proprietary implementation claims are unverified, even when feasible in principle.  
**Evidence types:** `OWNER_SPEC` required behavior; `MATH_VERIFIED` independently calculated with WGS84 ellipsoid and UTM 14N overlap; `SOURCE_VERIFIED` path inspected on exact main; `EXTERNAL_PUBLIC` vendor/government documentation; `UNVERIFIED` unsupported claim; `PROPOSED` engineering specification, not running product; `LIVE/FIELD_UNVERIFIED` no authenticated field proof.

## Executive decision

**Dossier 2 can enrich Dossier 1's R2 inspection → geometry → estimate flow, but cannot fill Dossier 1's broader enterprise/governance scope. Adopt the measurement *requirements* and corrected independent mathematics; discard fabricated-looking internal stack details, unusable example geometry, licensing violations, and performance/compliance promises.**

- **Preserved from Dossier 1:** all 24 work packages (§30), 20 AI functions (§17), nine integrated releases (§31), owner quantity rules (§11), action authority, evidence lineage, retained revisions, web + mobile, recovery, no-paid requirement. No requirement is quietly made optional.
- **Useful from Dossier 2 after correction:** address/imagery/parcel sourcing, source quality metadata, per-plane segmentation candidates, roof topological graph, pitch per plane, manual calibrated trace and snapping, geometric holes and edges, multi-angle occlusion handling, measured LiDAR/DSM only when fit for purpose, reversible revisions, measurement report and read-only integration contracts.
- **Not adopted as fact:** React/Vite/Express/GraphQL, Celery/Redis/Kubernetes/Istio/EKS/GKE, model IDs and scores, team/measurement IDs, exact PUT endpoint or webhooks, proprietary image subscriptions, SOC 2 status, Roofr engineering claims, guarantees of RPO/RTO or centimeter accuracy. Dossier 1 already specifies architecture in *roles*, not verified vendors.
- **Source-only implementation currently exists**, but is neither proof of field precision nor full R2 acceptance. Do not claim this review implemented roof inference, licensed universal aerial coverage, edge classification, operational AI, production migrations, or an authorized estimate.

## A. Dossier 1 audit — every section accounted for

| Dossier 1 § | Governing requirement / evidence state | Contribution of Dossier 2 | Decision |
|---|---|---|---|
| 1 | One unified owner-directed enterprise; OWNER_SPEC | Roof GIS is one submodule only | **Preserve** |
| 2 | AI throughout lifecycle, deterministic controls | Segmentation, measurement, review candidates | **Expand R2 only** |
| 3 | Roofing + exterior services, funding, people, all business functions | Roof detail does not cover finance/field/other domains | **Preserve** |
| 4 | Nine logical architecture responsibilities | Geospatial capture/model subpipeline | **Map into current stack** |
| 5 | Candidate component register, license review | Names proprietary paid tools and elaborate cloud stack | **Do not inherit stack** |
| 6 | Approved integrations, costs, terms, fallbacks | Imagery and parcel source contracts | **Add rights and attribution gates** |
| 7 | Illustrative repo structure | No runnable verified repo supplied by D2 | **Keep existing roof-os** |
| 8 | Revisioned records, evidence/assumption states | Geometry provenance and corrected/reviewed version fields | **Strengthen source lineage** |
| 9 | Property/building/roof/plane/edge etc. | Geometry graph, penetrations, source imagery metadata | **Extend typed records** |
| 10 | Distinguish request/approval, proposal/agreement and related states | 'Save' is not approved measurement | **Preserve strict states** |
| 11 | Exact owner estimating rules | Pitch-area math and field waste only; D2 generic 'hip & valley' disagrees | **Owner rules win** |
| 12 | Manufacturer identifier, packaging and compatibility | D2 infers 3 bundles/square | **Require exact product coverage** |
| 13 | Consequential approval, pricing, limits, revisions | Measurement is preparation not external commitment | **Preserve authority** |
| 14 | Workflow trigger, error, recovery, cancellation, duplicate handling | Image/AI/manual workflow stages | **Add exceptional paths** |
| 15 | Lead/inspection/estimate/proposal state machines | Draft vs review vs released geometry distinctions | **Bind to existing states** |
| 16 | W01–W12 end-to-end workflows | W02 evidence and W03 geometry/estimate enriched | **No replacement of W01–W12** |
| 17 | All **20 mandatory AI functions** | AI-04 evidence and AI-05 geometry; supports AI-06 estimating | **All 20 remain** |
| 18 | Enterprise missions and capability improvement | Source data may inform a roof inspection mission | **No automatic autonomy** |
| 19 | Scope-bound action gateway | Measurement save/export/report actions need exact versions | **Add version+approval checks** |
| 20 | Event identity and eventual reconciliation | Proposed `measurement.completed` event | **Emit only after actual reviewed transition** |
| 21 | Durable AI task plans, budget, stop conditions | Inference/rectification retries | **Preserve failure/stop semantics** |
| 22 | Bounded workers and model routing | Optional CV and geospatial jobs | **Don't mandate proprietary models** |
| 23 | Participant workspaces / offline / accessibility | Inspector trace UI and evidence viewer | **Use shared records + mobile fallback** |
| 24 | Capability-specific authority | Human review is evidence, not owner approval to price/order | **Preserve** |
| 25 | Security/privacy & untrusted inputs | Imagery rights and tenant-stable asset IDs | **Protect provenance; verify access** |
| 26 | Isolated engineering factory and evaluated tests | Independent geometry fixtures / instrumented CV tests | **Test first, no fake test oracle** |
| 27 | Release, operations, rollback | Imagery provider outages/degraded source state | **No invented uptime guarantees** |
| 28 | Unit, integration, permission, adversarial, recovery, economics tests | Concrete roof-math fixtures and corrupted imagery | **Add specific cases** |
| 29 | Measured acceptance outcomes, no invented targets | Confidence calibration, error distribution, coverage tracking | **Define targets from owner/field baseline** |
| 30 | **24 mandatory work packages** | Only WP07–08 directly strengthened; data feeds WP09 and other domains | **All 24 remain** |
| 31 | **Nine mandatory releases** | R2 strengthened, R1 evidence contract dependency, later releases unchanged | **All nine remain** |
| 32 | Customer→evidence→reviewed measurements→editable sketch→estimate→approval | Concrete diagram/measurement requirements | **Bind to same first slice** |
| 33 | Owner configuration, jurisdiction, methods, budget, acceptance | Owner pitch/edge rules, imagery rights and review tolerances still to configure | **Mark unresolved as blocked** |
| 34 | Twelve baseline acceptance conditions | R2 must pass field and owner acceptance, not just CI | **Unchanged** |
| 35 | Handover and demonstrated restore | Export/measurement report and reproduction evidence | **Require operational demonstration** |
| 36 | Continuing assessed capability development | Better roof CV is a future controlled candidate | **Govern improvements** |
| 37 | Evidence-based technology-blocked decisions | Absent LiDAR/imagery is a provider/access issue, not universal impossibility | **Graceful manual fallback** |
| 38 | One coherent system with real verified work | No new separate SaaS/backend | **Preserve** |

**Dossier 1 audit limitation:** The PDF is a consolidated *requirements plan*, not a fully detailed geometry standard, accepted data model, procurement decision, measured benchmark or demonstration that every original earlier conversation sentence was captured. Dossier 2 helps with geometry specificity but cannot close its commercial, security, release or operational acceptance gaps.

## B. Dossier 2 section-by-section forensic audit

| Dossier 2 § | Verdict | Exact disposition |
|---|---|---|
| 1. Architecture | **UNVERIFIED** | Plausible industry pattern; asserted Roofr SPA/framework, microservices, paid providers and databases lack source evidence. Reuse existing Next.js/Supabase layout; isolate only proved bottlenecks. |
| 2. Automated pipeline | **PARTIAL** | Address, roof facets, candidate classification, DSM/point cloud plane fitting make engineering sense. Must not infer Roofr uses named models. DEM generally represents ground, not roof; roof returns/registered DSM needed. No arbitrary 'exact' pitch from uncertain data. |
| 3. Manual editor | **PARTIAL** | Shoelace, snapping, local transforms, undo/redo good. Requires validated coordinate units, shared projection, edge type, holes, overlap and revision-aware ownership. `O(log n)` collision claims ignore result count/worst cases. |
| 4. 'Exact enterprise payload' | **FAIL** | Fictional-looking IDs/path/model versions, internally inconsistent GPS, plan and surface areas and edge lengths. Should be *synthetic negative test*, never a valid measurement oracle or asserted Roofr API. |
| 5. Performance | **UNVERIFIED** | Client caching and optimistic interactions sensible; 'zero latency' and guaranteed sub-millisecond spatial lookup false as unconditional guarantees. Index choice benchmarked by workload. |
| 6. Geometry proofs | **FAIL/PARTIAL** | Point-in-polygon method valid for point test but centroid containment does not prove polygon hole fits. Bézier arc-length Gaussian quadrature incorrectly integrates **squared** speed. Correct formulas in section C. |
| 7. Security | **UNVERIFIED** | Workspace roles, signed assets, append-only audit sensible as *requirements*, not evidence Roofr implemented them. Signing also does not grant imagery usage rights; storage access/RLS need live tests. |
| 8. Occlusion/reconciliation | **PARTIAL** | Secondary authorized imagery and versioned manual corrections useful. Do not arbitrarily decrement ML scores after edits; mark modified, reviewed, provenance and derived confidence separately. |
| 9. Glossary | **PASS with nuance** | Roofing vocabulary and square=100 sq ft correct; clarify plan vs slope edge lengths and product-specific packaging. |
| 10. Webhooks/workers | **PROPOSAL ONLY** | Events, dedupe, retry and correlation useful; reported actual webhook and Celery topology unproven. Signed event example is not a real endpoint or demonstrated delivery. |
| 11. Production infrastructure | **REJECT AS BLUEPRINT** | Kubernetes/service mesh/multi-region S3 promises lack evidence and contradict no-fee constraint. Build to observed load, not fictitious enterprise infrastructure. |
| 12. Generative AI/drone roadmap | **CONDITIONAL** | Conversational measurement explanation and authorized drone photos/photogrammetry may help. Drone model accuracy and allowed airspace/photography must be validated; no assumed centimeter result. |
| 13. Disaster recovery | **REJECT CLAIMS** | RPO <5s, RTO <60s, 7-year immutable backups are unproven operational promises, not backed by architecture, service evidence or budget. Define achievable RPO/RTO and exercise restore. |
| 14. Compliance | **REJECT CERTIFICATION CLAIMS** | GDPR/CCPA, AES/TLS, SOC 2 II, Vanta/Drata statements cannot establish a certification or lawful retention. Treat as controls to research/implement, never advertising claims. |
| 15. Partner ecosystem | **CONDITIONAL** | Estimate/ERP/export bridges are valid business needs under D1. Real partner APIs, terms, licensed ESX format and write permissions must be separately verified. |
| 16. Coordinate formulas | **FAIL/PARTIAL** | Plane normal/pitch concept valid with axis/orientation checks. Web Mercator pixel formulas mix radians with meters, missing radius normalizations, and cannot be used as written. |
| 17. Solar, thermal, lifecycle | **RESEARCH PROPOSAL** | Potential additional business capabilities; not proven to be Roofr internals, nor accurate without validated weather, obstruction, materials and uncertainty. No silent addition to mandatory owner scope. |

## C. Independent reproducible measurement findings

**Method:** WGS84 geodesic polygon areas and segment lengths via `pyproj.Geod(ellps="WGS84")`, and EPSG:32614 local UTM polygon overlap via `shapely` on the supplied example, 2026-11-17. Small geodesic-versus-grid differences are normal; differences of tens/hundreds of feet or areas of thousands of square feet are not.

| D2 specimen field | Claim | Independently computed | Assessment |
|---|---:|---:|---|
| Facet alpha plan area | 1,250 sq ft | **2,020.88 sq ft** from vertices | Reject fixture |
| Facet beta plan area | 1,100 sq ft | **2,084.03 sq ft** from vertices | Reject fixture |
| Ridge line from provided endpoints | 45.25 ft | **78.93 ft** plan geodesic | Reject fixture |
| Valley line from provided endpoints | 18.30 ft | **69.42 ft** plan geodesic (true 3D may be longer) | Reject fixture |
| Eave line from provided endpoints | 112.50 ft | **69.45 ft** plan geodesic | Reject fixture |
| Front/rear polygon interior overlap | No overlap acknowledged | **~1,010 sq ft** in common projected frame | Hard stop |
| Sum reported raw plan areas | Report uses 2,326 sq ft | **2,350 sq ft** from reported plane metrics, before 24 sq ft penetration | Reconciliation required |
| Sum reported pitched plane areas | Report uses 2,533.04 sq ft | **2,557.04 sq ft** from 1,397.54+1,159.50, before penetration | Reconciliation required |

The master summary appears to subtract the 24.00 sq ft chimney once from the total *plan* area (2,350→2,326) and again as 24.00 sq ft from total *sloped* area (2,557.04→2,533.04). That mixes area bases unless different, explicitly reviewed cutout definitions happened to yield the same numeric size. If 24 sq ft is **horizontal** opening area on the 6/12 facet, the matching surface opening is **26.83 sq ft**; on 4/12 it is **25.30 sq ft**. The source does not identify the penetration's plane or measurement basis. Polygon shape overlap makes the entire specimen invalid regardless of this secondary problem.

**Correct individual multipliers:** 6/12 yields `sqrt(1+(6/12)^2)=1.1180339887`; 4/12 yields `sqrt(1+(4/12)^2)=1.0540925534`. These formula outputs match D2's *independently asserted* facet areas to rounding, but do not validate their inputs or geography.

**Bundles:** The example's 84 bundles follows approximately `ceil(27.86 × 3)`. D1 specifically requires actual manufacturer/package coverage, field waste separately, ridge/hip cap `ceil((hip + ridge ft)/20)` bundles and starter `ceil(approved starter ft/110)` bundles, **no extra cap/starter waste**. Never assume 3 field bundles per square as a universal rule, nor 'hip & valley = 15%' against the owner's 15% *hip roof* field-waste rule.

**Grid versus geodesic:** WGS84 geodesic areas above ≠ UTM polygon areas by sub-foot-scale local projection distortion. The overlap (~1,010 sq ft) is from UTM projected geometry; either approach decisively invalidates the specimen.

## D. Corrected algorithm contract — authoritative BAILEY candidate, not Roofr internal source

1. **Property and licensed imagery:** Address → geocode with confidence/source → select exact property/building → display actually available, authorized raster + acquisition date, CRS, GSD/resolution, attribution, license, imagery reference and limitations. Footprint source is *not* itself roof surface or pitch. If unavailable, show **UNAVAILABLE** with manually calibrated user imagery or reviewed dimensions as an alternate; never invent tiles or force photo if lawful address imagery exists.
2. **Common geometry reference:** Validate EPSG/CRS, `[longitude,latitude]` versus `[latitude,longitude]`, datum and units at every ingress. Use a coherent local projected plane or WGS84 geodesic calculations for plan distances/areas; explicit calibration for image pixels. Never use degrees as feet or silently apply one global scale to mixed imagery.
3. **Plane topology:** Each facet is a validated non-self-crossing, nonduplicate polygon with unique stable IDs and an immutable source revision. Pairwise plane interiors may **not overlap**; exact shared boundary metadata is maintained separately from external perimeter. Gaps/holes/occlusion must be resolved or flagged. Shared plan boundary is **not automatically classified** as ridge, valley or hip.
4. **Pitch:** Each reviewed plane has a `rise/12` value and evidence/source status. Apply per-plane `A_surface_i = A_plan_i × sqrt(1 + (rise_i/12)^2)`. A roofwide pitch may apply only with explicit documented uniformity confirmation. Unknown pitch yields **blocked** or conspicuously **provisional**, never a hidden default.
5. **Openings and penetrations:** Represent each chimney/skylight cutout with closed topologically valid polygon, explicitly mapped to owning plane and stated projection/area basis. Test complete containment, intersection, duplicates and area subtraction with a robust polygon Boolean operation; *centroid inside* alone is insufficient. Deduct on the correct sloped surface basis only when the estimating rule permits that deduction.
6. **Edges:** Per edge specify one of eave/rake/ridge/hip/valley/step/counter/flashing/unknown with source, confidence, start/end geometry and **plan versus measured true-length** method. Unknown types block eave, hip/cap and gutter totals. Do not derive ridge/valley/gutter from generic polygon perimeter.
7. **Waste and package quantities:** Use D1 owner rule version, roof classification, mixed-roof treatment, reviewed external edges, actual product coverage, special conditions and packaging. Preserve measured, adjusted, rounded, ordered and received quantities as distinct records. Require unresolved rules to remain blocked/provisional.
8. **Human correction:** Candidate → edited/unreviewed → reviewed → quantity calculated → owner/role-approved → released revision. Preserve raw model outputs, new human geometry and reason; modification invalidates previous approval. Do **not** subtract a magic amount from a probabilistic 'confidence score' and call it recalibrated.
9. **Persistence and authorization:** Workspace-scoped ownership, record identity, expected revision, source license references, review actor/time, idempotency key, correction chain and audit trail. UI preview quantities are not trusted server-side; recompute from persisted source and refuse stale preview.
10. **Reporting:** Accurate source legend, facet and edge table, true/plan areas, excluded/unknown sections, scale and uncertainty, rule/product/version trace and explicit **PROVISIONAL/REVIEWED/APPROVED** status. Only released report should trigger approved proposal workflow. PDF generation or webhook delivery alone is not certification.
11. **Terrain/3D:** Grade uses validated vertical datum and measured/suitable points. A bare-earth DEM cannot provide rooftop pitch. Use DSM/building-classified lidar/drone photogrammetry when actually available and validated; otherwise flag **not measured**. 3D display never upgrades a speculative measurement into verified evidence.
12. **Operational fallback:** Network outage, expired tiles, changed license/price, image canopy/shadow, wrong building, concurrent edits, partial worker failure, wrong workspace and rollback must each have explicit safe outcomes. No external orders, insurance submission, customer promises, or prod writes under unverified geometry.

### Formula corrections

- **Mercator:** `x_m=R λ_rad`, `y_m=R ln(tan(π/4+φ_rad/2))`; with `W=256·2^z`, `x_px=W(x_m+πR)/(2πR)`, `y_px=W(πR-y_m)/(2πR)`. The D2 expressions use `+π` beside `x_m,y_m` measured in **meters**, which is dimensionally wrong. Keep latitudes in valid Mercator range and track tile size/projection.
- **Plane normal:** With `n=(P2−P1)×(P3−P1)` in consistent 3D units, take `θ=acos(|n_z|/||n||)` for physical slope independently of arbitrary vertex winding. `pitch_rise_per_12 = 12 tan(θ)`; reject near-vertical/degenerate or unsupported surfaces. Report uncertainty and evidence.
- **Curved edges:** Correct cubic-Bézier arc length `L=∫_0^1 ||B'(t)|| dt ≈ Σ w_i ||B'(u_i)||`. D2's `Σ w_i ||B'||²` is mathematically incorrect; units are distance squared rather than distance.
- **Plan and pitched totals:** `A_plan = Σ valid_nonoverlapping_plan_areas`; `A_roof = Σ (A_plan_i − A_plan_openings_i)·sqrt(1+(p_i/12)^2)` when subtraction is reviewed/allowed. No mixing area bases or double subtraction.
- **Imager's stated pixel size:** D2's GSD interval is plausible for Austin at zoom 19–21 (~0.258 to 0.0645 m/px) but zoom does **not establish image native resolution or roof-measurement accuracy**. Display native GSD, transform error and source acquisition evidence separately.

## E. Public-source verification and license/cost boundary

- Official Roofr publicly advertises reports with aerial imagery, roof surface/pitch/edges and do-it-yourself tracing. This **confirms product behavior**, not the D2 author's private implementation or actual endpoints: https://roofr.com/measurements ; https://roofr.com/measurement-reports ; https://roofr.com/product-blog/the-new-roofr-measurement-reports-page-ready-to-level-up-your-measurements .
- Google's published Maps Platform policies expressly restrict tracing/digitizing from satellite imagery and extracting derived terrain/3D models. **Do not design commercial BAILEY roof polygon extraction against those Google tiles** without a legal permission that expressly authorizes it: https://developers.google.com/maps/faq .
- USGS notes its 3DEP dynamic DEM has **0.53 m aggregate RMSE vertical accuracy**, varying by region/source/cover; this does not certify a particular roof or driveway grade. Roof point clouds/DSM and local survey error must be independently assessed: https://www.usgs.gov/faqs/what-vertical-accuracy-3d-elevation-program-3dep-dems?items_per_page=6&page=1&qt-news_science_products=0 .
- Commercial Nearmap/CoreLogic/Regrid/Esri/Bing terms/credentials/availability and any ESX/carrier format rights are **not verified free**. No subscription, token request, credit consumption, extra GitHub Actions, GPU job, paid API fallback or production migration was authorized by this audit.
- AI model weights/data license, drone footage rights, site field safety and permit/jurisdiction are separate gates. The fact that a project is on GitHub does not alone establish an open-source license.

## F. Present implementation vs proposed specification (source-only)

| Exact `main` source | Observed evidence | Missing acceptance |
|---|---|---|
| `app/api/measurements/property/route.ts` | Authenticated address geocode, OpenAerialMap candidate lookup, OpenStreetMap low-confidence building footprints; source returns explicit unavailable conditions | Real licensed usable imagery at requested addresses, GSD/orthorectification evidence, provider use and field comparison |
| `lib/measurements/aerial-provider.ts` | Fallback helper currently defaults `requiresInspectionPhoto:true`; conflicts with desired universal address-first behavior when lawful aerial imagery is available | Reconcile provider decision, photo-as-one-fallback not universal prerequisite |
| `lib/measurements/trace-geometry.ts` | Simple polygon validation, shared projection, cross-plane overlap rejection, shared internal outline removal | Roof edge classification + true length, map surveying, hole topology, adversarial/field acceptance |
| `lib/measurements/calibrated-roof-draft.ts` | Requires top-down + human geometry; validates planes, mixed-pitch requirements; computes per-plane slope area from saved scale | Site pitch/source accuracy, revisions/roles, product takeoff and accepted field accuracy |
| `app/api/measurements/manual/route.ts` | Provisional save reloads workspace-scoped persisted reviewed geometry, server-recomputes quantities, rejects stale previews | Fully revisioned/role-accepted transaction and real cross-workspace browser/RLS acceptance |
| `scripts/roof-measurement-precision-test.mjs` | Synthetic geometry, overlap, confirmation and route source-pattern tests | Actual D2 corrupt GPS specimen as explicit rejected test; independent dynamic route integration and field measured benchmarks |
| `docs/contractor-os/RELEASE-1-TRACEABILITY.md` and `supabase/migrations/102_contractor_os_control_plane.sql` | Tracked R1 authority/evidence foundation in repository | Hosted schema/migration, role RPC, verification and restore NOT inferred from source |
| PR #461, `103_reviewed_plane_pitch.sql` | Separate pitch-column migration remains **draft, unmerged**; colliding version was renumbered in branch | Rebase and approved backup, staged RLS and live availability before any production application |

**Other project boundaries:** The merged PR #465 and #466 source/CI improvements are not evidence of nationwide aerial availability, authenticated two-user operating proof or field accuracy. The newly merged #455 free-only research capability is not validation of deployed app-host network behavior. The separate driveway earthwork engine is a tested math helper, not part of Roofr's roof pipeline.

## G. Exact engineering acceptance register (must be tests, not prose alone)

| ID | Required failing/positive test | Severity | Status in this audit |
|---|---|---|---|
| MEAS-01 | D2 overlapping GPS facets and inconsistent edge examples are **rejected** as a valid roof report | P0 | **PROPOSED**, independent forensic math proven here |
| MEAS-02 | Geodesic/local projection correct for known survey fixture; Mercator pixel invariant at center, edges, high latitude | P0 | PROPOSED |
| MEAS-03 | Adjacent facets share edge without double-count; crossing/containment/partial crossing/holes guarded | P0 | Existing subset SOURCE_VERIFIED, holes unproven |
| MEAS-04 | Mixed pitch 0/12 + 12/12 equals weighted sloped total; unknown pitch blocks release | P0 | Existing synthetic subset SOURCE_VERIFIED |
| MEAS-05 | 24 sq ft penetration is assigned to reviewed owning plane with matching projection basis | P0 | PROPOSED |
| MEAS-06 | Trace, pixel scale, native GSD, reprojection, units, source geometry revision and calibration consistent | P0 | PARTIAL source; field unverified |
| MEAS-07 | Ridge/hip/valley/eave/rake/gutter remain **unknown** until classified and reviewed; no perimeter substitution | P0 | PARTIAL source, classification unverified |
| MEAS-08 | D1 gable 10%/hip 15%; cap/20; starter/110; no cap/starter extra waste; true product coverage | P0 | Owner rules specified; end-to-end unverified |
| MEAS-09 | Address only starts flow; licensed coverage returns imagery, noncoverage unavailable, authorized manual fallback | P0 | PARTIAL source; remote live unverified |
| MEAS-10 | Cross-workspace access to geometry/tiles/report denied; tampered preview cannot change server result | P0 | PARTIAL source; live adversarial test unverified |
| MEAS-11 | Human correction increments revision, invalidates outdated estimate/approval, originals retained | P0 | PROPOSED R1/R2 integration |
| MEAS-12 | Exactly-once logical release on duplicated webhook/retry; mismatched IDs and unknown external outcome reconciled | P1 | PROPOSED, no fabricated webhook |
| MEAS-13 | Canopy shadow, off-nadir building lean, multi-image date mismatch and missing LiDAR show uncertainty or hold | P1 | PROPOSED |
| MEAS-14 | Baseline building/roof pitch/eaves validated by real on-site independent reference across roof types | P0 | LIVE/FIELD_UNVERIFIED |
| MEAS-15 | Simulate offline editing, app reload, two-user conflict, rollback/restore and linked proposal re-review | P0 | LIVE/FIELD_UNVERIFIED |
| MEAS-16 | No usage of unlicensed source imagery; no paid fallback or provider/runner charge assumption | P0 | Policy stated; licensing/account billing not certified |

No arbitrary numerical field accuracy threshold is invented. Define owner-approved tolerance per roof type, source GSD and consequence from actual reference measurements; require 95th percentile and worst-case critical errors to be tracked separately rather than hidden behind a mean.

## H. Implementation path and explicit no-skipping handoff

1. **R1 authoritative record gate:** Use reviewed geometry, evidence source and revision contracts from D1. Verify actual hosted 102/103 schema state read-only; do not migrate or approve writes until staged backup+restore and RLS proof.
2. **R2 hard-stop fixture:** Add test-first D2 *corrupted specimen* and corrected WGS84/UTM transformation, per-plane hole-area and verified edge-classification tests. A failing source specimen must stay a negative regression, not be 'repaired' into a fake real property.
3. **R2 source/imagery gateway:** Authorize actual imagery, native resolution and provenance; enforce address-first, manual fallback and no illicit Google-derived geometry.
4. **R2 manual+AI unified record:** Bind `/measure` and `/sketch` to one revocable/versioned, workspace-scoped roof structure with human review; retain model candidate and human corrections.
5. **R2 owner takeoff:** Apply gable/hip, mixed roof, starter, cap, verified product packaging and unknown-edge blocking; produce only a provisional estimate until reviewed evidence and authority exist.
6. **R2 report → proposal:** Link report and approved estimate to exact immutable revision, allow correction/supersession and prove signed/versioned export.
7. **Prove release:** Pure-math fixtures → handler tests → web/mobile UI → live approved two-workspace RLS → licensed imagery pilot → independent field roof reference → owner approval → backup/rollback. No source-only CI green claim becomes production certification.
8. **Keep R3–R9 and 20 AI functions alive:** D2 only enriches a piece of R2. Every approved function, work package and milestone remains in the overarching plan, with separate actual completion gates.

### Audit verdict

**Source 1 = governing enterprise master, structurally sound as a scope/authority roadmap but not fully engineered or field-approved. Source 2 = useful subject-specific brainstorming with substantive math/data contradictions and extensive unsupported proprietary claims.**

**Adopt as detailed R2 specifications:** supported geometry/trace operations, source/quality handling, edge graph, explicit corrections, report/external adapter contracts **only after independent corrections and license review**. **Reject as data/technical fact:** the 'exact' sample measurement, coordinates-derived totals, squared quadrature, broken Mercator conversion, purported private Roofr stack/API/model/certification/SLOs.

**No changes to source code, production data, providers, billing, deployments or user files are made by this audit.** Repository documentation is prepared for engineering execution and its status stays *SPECIFIED/UNVERIFIED*, not *IMPLEMENTED/OPERATIONAL*.
