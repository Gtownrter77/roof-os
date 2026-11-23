# Roofr + RoofSnap Measurement Parity Program

## Exact Workflows, Accuracy, Timing, and a Free/Open-Source Recreation Roadmap

**Status:** Draft for owner review — not an approved implementation plan  
**Date:** 2026-11-23  
**Prepared in:** worktree `/home/rlongmbox/projects/roof-os-hover-parity`, branch `docs/hover-parity-roadmap`  
**Baseline:** RoofOS `main` at `be5c63c` (local checkout)  
**Scope:** Two products — Roofr (`app.roofr.com`) and RoofSnap (`app.roofsnap.com`) — treated as the reference systems for **address-based satellite/aerial roof measurement → report → estimate**. This supplements, and does not replace, `docs/HOVER-PARITY-ROADMAP.md` (ground-photo photo-to-3D workflow).  
**Owner stance carried forward:** Full parity program, all gates. Free/open-source software is the default; licensed data, imagery, and commercial compatibility are named as explicit approval gates.  
**Evidence boundary:** Public web research and local source audit only. No authenticated product access, no production/database verification, no physical-device test, no independent roof measurement was performed. All web sources were accessed 2026-11-23.

---

## 0. How to read this document

Evidence labels:

- **[Official]** — statement on the vendor's own site, help center, sample artifact, or partner page. Marketing claims remain claims even when official.
- **[Third-party]** — industry review, comparison, or competitor statement. Useful for corroboration, not a benchmark.
- **[Not publicly documented]** — no supporting public source found in the reviewed material. This is not proof of absence inside the product.

Capability states for RoofOS: `Implemented (source)`, `Prototype`, `Absent`, or `Unknown`. `Implemented (source)` means a code path exists; it does not mean the path was executed, field-verified, or is production-operational.

Two disciplines apply throughout:

1. **Free-first, paid-gated.** No paid imagery, licensed data feed, commercial engine, or GPU rental is assumed as "just part of the stack."
2. **Evidence before claims.** A rounded number in a marketing PDF is not an accuracy benchmark. A passing source check is not a production proof.

---

## 1. Executive summary

### 1.1 The blunt verdict

Roofr and RoofSnap sell the same core promise from different angles: **an address goes in, a measured roof report comes out, fast and cheap.** Roofr is an integrated platform with a done-for-you report ($13–$19 per report, 2-hour guaranteed tier) plus a DIY tracing tool. RoofSnap is positioned as the low-cost, often self-service measurement tool. Neither publishes an independently verifiable accuracy benchmark; both publish numbers that are only meaningful with their conditions attached.

The recreation gap is therefore not "can we draw polygons on satellite imagery?" — that is easy and already partly exists in RoofOS's 2D geometry/measure path. The real gaps are:

- **imagery access and freshness** (the input that determines everything downstream),
- **pitch and edge inference** (the hardest measurement to get right from top-down imagery),
- **QA and correction workflow** (Roofr's "multi-check system" and at-least-one-expert review),
- **rounding/versioning semantics** (Roofr deliberately serves different precision in PDF vs dashboard),
- **timing under load** (a guaranteed 2-hour SLA with exclusions and credits),
- **estimate/report/export integration** (ESX for Xactimate, CSV, human-editable reports).

A free/open-source stack can reproduce the *shape* of both workflows. It cannot yet promise the same accuracy or guaranteed turnaround without two things: a reproducible ground-truth benchmark, and a paid imagery/compute gate when free data is stale or too coarse. That is why the roadmap below makes both explicit gates rather than hidden assumptions.

### 1.2 The RoofOS doctrine constraint discovered during audit

The local source audit surfaced a conflict that changes the shape of the roadmap: RoofOS's `docs/EXACT-WORKFLOW.md` locks a **photo-first** path (GPS inside the photo → address from GPS → skyview → wizard → tech lock → owner sequence → gated send) and says "do not invent a second one." Roofr and RoofSnap are **address-first** products. Copying their order flow would bypass the provenance and authority chain the owner approved. The default recreation is therefore a **skyview measurement adapter inside the locked path**, with true address-first ordering named as an explicit owner-amendment gate (§5.1). Timing parity must be measured from **accepted photo/address**, not from a customer typing an address.

### 1.3 What is already known about each product

| | Roofr | RoofSnap |
|---|---|---|
| Core input | Address / map pin; imagery described as up-to-date HD aerial/satellite | Detailed in §3 |
| Modes | Full-service "Roofr Report" + DIY self-drawn report | Detailed in §3 |
| Ordering | Jobs → New → Report; address; confirm pin; notes/extras; "<60 seconds" | Detailed in §3 |
| Report | 7-page PDF, detailed diagram, lengths/areas/pitch/summary, optional materials | Detailed in §3 |
| Accuracy language | "Accurate down to the inch"; satellite measurements "± 1–2 inches"; also "no measurement service is 100% accurate" | Detailed in §3 |
| Timing | As few as 2 h; 6 h; 2–24 h; Starter 24 h (not guaranteed); guarantee exclusions | Detailed in §3 |
| Price | $19 Starter / $13 paid per report; ESX $12/$10 | Detailed in §3 |
| Exports | PDF, dashboard view, CSV (paid), ESX add-on | Detailed in §3 |

### 1.4 What will be hardest to recreate

| Hardest thing | Why | OSS status |
|---|---|---|
| Fresh, high-resolution imagery for an arbitrary US address | Free satellite sources have resolution/revisit/license limits; commercial services pay for freshness | Partial: Sentinel/Landsat/NAIP/OpenAerialMap exist, but coverage and age are inconsistent |
| Pitch from top-down imagery | Requires shadow/sun geometry, DEM, or learned priors; roofs with trees/overhangs defeat it | Weak: no reliable OSS productized pitch estimator for arbitrary addresses |
| Edge classification (hip/valley/rake/eave/flashing) | Needs semantics + topology, not just a polygon | Partial: segmentation models give masks; classification and topology are custom code |
| "Accurate to the inch" defensibility | Needs ground truth, versioned rules, and audit trail | Must be built; absent from OSS |
| Guaranteed 2-hour turnaround | Requires queueing, human review capacity, imagery availability, and credits | Buildable with orchestration; capacity is an operational/cost gate |
| Xactimate ESX compatibility | Format and workflow are proprietary/insurance-specific | Paid/licensed gate; RoofOS tests currently forbid ESX paths |

---

## 2. Roofr — exact measurement workflow

All statements in this section are drawn from public Roofr pages, help center articles, and the sample report PDF, accessed 2026-11-23. They describe Roofr's **published process**, not verified internal implementation.

### 2.1 Two modes: "we measure" and "you measure"

Roofr offers both a full-service **Roofr Report** (Roofr's measurement team produces it) and a **DIY report** where the contractor selects imagery and traces the structure in Roofr's mapping tool. [Official — https://roofr.com/measurements, https://roofr.com/measurement-reports]

The DIY path accepts Roofr imagery, aerial/satellite imagery, the user's own images, or blueprint imagery depending on workflow and plan. Roofr positions DIY for drone photos or new-build blueprints; full-service reports use Roofr's measurement team. [Official — https://help.roofr.com/en/articles/15555399-how-to-create-a-measurement-report-diy]

**Recreation implication:** these are two distinct pipelines sharing one report schema. Any RoofOS implementation must support both an automated/service path and a human-trace path, with provenance recording which one produced a measurement. This mirrors RoofOS's existing "AI suggests, human verifies" doctrine but applies it to the whole report, not just one field.

### 2.2 Full-service order flow (published steps)

1. Start in **Jobs → New → Report**. [Official — https://help.roofr.com/en/articles/15555058-how-to-order-a-roofr-measurement-report]
2. Enter the address.
3. Confirm the property location on the map. Roofr marketing shows a map-pin confirmation step and an "Add multi-family building" option. [Official — https://roofr.com/measurement-reports]
4. Add notes or secondary-structure requests. Garages and sheds are included in a normal report and do **not** need additional pins. [Official — order help article]
5. For a duplex/triplex, state whether the whole structure or only the pinned unit is required.
6. Choose extras: material calculations, waste recommendations, faster guaranteed turnaround, Xactimate-ready ESX file.
7. Submit. Roofr says a report can be ordered "in less than 60 seconds." [Official — order help article]

Conceptually, Roofr's complicated-roof blog reduces this to three steps: search the property → review the outline and measure the roof/features → receive the report by email. [Official — https://roofr.com/blog/creating-roof-measurement-reports-for-complicated-roofs]

**Multi-building reports** are for multiple full-size standalone structures and include length measurements, area calculations, pitch where available, detailed diagrams, and a consolidated all-structures summary. The measurements page can add reports to a multi-building job, but individual reports in a multi-building job cannot yet be labeled separately. [Official — https://help.roofr.com/en/articles/15555151-how-to-order-a-roofr-multi-building-report, https://help.roofr.com/en/articles/15555258-how-to-use-roofr-s-measurements-page]

**DIY flow:** measurements tab → **Create DIY** → enter job address → select the clearest available aerial image → trace the structure in the editor. [Official — DIY help article]

### 2.3 The supplied dashboard URL

The user supplied:

`https://app.roofr.com/dashboard/team/580504/report/queue?checkoutToken=1990d6a7-7f8a-454e-b18b-444d9c54c2f3`

A public fetch on 2026-11-23 returned only the generic Roofr application shell with the title **"Dashboard - Roofr"** and generic metadata; no report queue contents were observable. No login was attempted and no token was redeemed. [Official — supplied URL, fetched 2026-11-23]

Roofr's public measurements-page documentation says the dashboard lists status, type, address, customer name, assignee, created date, completed date, and an actions menu. [Official — measurements page help article]

**[Not publicly documented]** the specific queue state, order, address, report contents, or checkout outcome behind this token; whether the token is active, expired, or already redeemed. Any claim about that specific order would be invented.

### 2.4 Imagery and quality control

Roofr says every report goes through a **"multi-check system,"** uses **up-to-date imagery**, and applies its calculation formula. [Official — https://roofr.com/measurements] A partner page states that **at least one Roofr expert** looks at every report before it reaches the customer's inbox. [Official — https://roofr.com/partnerships/abc-supply/measurements]

Roofr describes its imagery as up-to-date, HD, high-resolution aerial and satellite imagery. [Official — measurements page, FAQs, complicated-roof blog] Paid DIY imagery credits are listed at roughly **$2–$3.50** (lower tiers show $3–$4.50). [Official — https://roofr.com/pricing]

Roofr also states that **no measurement service is 100% accurate**, that customers should double-check all measurements, and that finished reports can be edited. [Official — https://roofr.com/faqs]

**[Not publicly documented]** the named imagery vendor(s), capture dates, freshness policy, native resolution, or minimum accepted resolution for full-service reports. That absence is the single biggest obstacle to a faithful recreation: we can copy the workflow but not the input quality without either a benchmark feed or a paid imagery gate.

### 2.5 Report contents and precision semantics

Documented sections/fields:

- Length measurements, area measurements, **pitch and direction**, an **all-structures summary**, a detailed diagram, and more. [Official — order help article]
- Pricing page: "total squares, pitch, and edges (hips, valleys, ridges, flashing, etc.)." [Official — https://roofr.com/pricing]
- Material calculations use pitch, roofing squares, and the user's preferred waste factor; recommended waste-factor percentages are included on paid plans. [Official — measurements page, FAQs]

The **7-page sample PDF** contains:

- Title/summary page: total area in square feet, number of facets, predominant pitch, property address, customer name, email, phone.
- Diagram page.
- Length-measurement page with totals for **eaves, valleys, hips, ridges, rakes, wall flashing, step flashing, transitions, parapet wall, and unspecified lengths**.

[Official — https://cdn.prod.website-files.com/6493173e3cea69ef8852e657/6493173e3cea69ef8852ea1f_Roofr%20Report%20-%20Sample%20Report.pdf]

**Critical precision detail:** the PDF and dashboard are deliberately different. In the PDF, diagram measurements are rounded to the nearest **foot** and totals to the nearest **inch**, and some detailed lengths may be omitted where a readable single-page layout is impossible. The dashboard editor measures everything precisely to the **inch** and exposes detailed, un-rounded values. [Official — https://help.roofr.com/en/articles/15555318-roofr-measurement-pdf-vs-dashboard-view]

**Versioning:** opening a Roofr Report in DIY creates a **new copy**; the original is unchanged. Older report versions are available from a drop-down at the top of the report. [Official — https://help.roofr.com/en/articles/15555375-how-to-edit-a-roofr-report, measurements page help]

**Recreation implication:** "the report" is not one artifact. A faithful model needs (a) a high-precision measurement record set, (b) a presentation-layer rounding/omission policy per export format, and (c) immutable versions with copy-on-edit. RoofOS's existing Golden Report authority model already has versioning and lock discipline; the rounding policy is new and must be explicit so no one mistakes a foot-rounded PDF line for the measured inch value.

### 2.6 Accuracy — claims, caveats, and real failure modes

| Claim | Source class | Treatment |
|---|---|---|
| "Accurate down to the inch" | Official blog | Marketing precision language, not a per-feature error distribution |
| Satellite measurements "accurate +/- 1-2 inches" for standard residential roofs | Official blog | Most specific public number; conditions ("standard residential") matter |
| Multi-check system + expert review + formulas | Official | Process claim; no measured outcome published |
| "No measurement service is 100% accurate"; double-check; editable | Official FAQ | Important caveat that qualifies the above |
| "100% accurate and never had a problem" | Official testimonial | Testimonial, not evidence |
| No published accuracy benchmark for Roofr; no independent all-provider test on identical roofs | Third-party | Confirms the evidence gap |

Third-party reviews report Roofr struggling with **pitch on complex multi-facet roofs, dormers under canopy, and imagery predating new construction**; one comparison reports pitch issues roughly monthly and coverage around 50% in some service areas (anecdotal, not specification). An industry comparison notes that competitors publish figures (e.g., RoofSnap 1–3% "when drawn correctly," EagleView 98.77% LiDAR-based, Hover 2–5%) while Roofr publishes no benchmark. [Third-party — https://roofingsoftwareguide.com/reviews/roofr-review, https://roofingsoftwareguide.com/comparisons/roofr-vs-roofsnap-vs-eagleview-roof-measurement-comparison, https://estimateondemand.com/roof-measurement-reports-accuracy-roofers]

**[Not publicly documented]** "within a shingle or two" is **not** a Roofr claim in the reviewed sources (it belongs to other vendors' positioning); no independent numerical benchmark exists; imagery vendor/age/resolution are undisclosed.

### 2.7 Timing — claims, guarantees, exclusions

| Tier | Public statement | Guaranteed? |
|---|---|---|
| Marketing | "as few as 2 hours"; 2–24 h; "under 2 hrs"; "under 3 hrs"; "under 6 hrs" across pages | Mixed — public wording is inconsistent |
| Starter | $19 report delivered in **24 hrs or less** | **No** — estimate, not guarantee |
| Essentials | $13 report in **2 hrs or less** | Yes, where 2-hour tier applies |
| Measure+ / paid | 6-hour or 2-hour guaranteed delivery | Yes |
| ESX | 3-hour / 6-hour windows under the delivery guarantee | Yes, separately specified |

Guarantee terms (effective 2026-07-07): only 2-hour/6-hour standard reports and 3-hour/6-hour ESX reports are covered; no guarantee after **10 p.m. EST**, before **7 a.m. EST**, or on weekends/holidays; guarantees can be voided for an **unclear roof boundary, pin/address mismatch, more than 20 roof facets, or multifamily orders**. If missed, Roofr issues a credit covering the base cost of the next report ($13 paid / $19 Starter) and refunds the expedite fee. [Official — https://roofr.com/delivery]

Starter expedite pricing: **+$5 for 12 h, +$15 for 6 h, +$30 for 2 h**. [Official — pricing page, FAQs]

**[Not publicly documented]** a guaranteed turnaround for multifamily, multi-building, or very large/complex roofs — the guarantee explicitly excludes those cases.

### 2.8 Pricing and packaging

- Reports are **pay-as-you-go**, not included as a fixed subscription allotment; Roofr says it does not offer bulk measurement packages. [Official — pricing page, https://help.roofr.com/en/articles/15545259-roofr-pricing-and-packaging-update-2026, pricing FAQ]
- **$19/report on Starter**, **$13/report on any paid plan**. ESX: **$12 Starter / $10 paid**. Report+ESX bundles: **$31 Starter / $23 paid**. [Official — pricing page]
- Displayed base plans: Starter **$0/mo**; Measure+ **$109/mo monthly or $209/mo yearly**; Essentials **$249/mo monthly or $209/mo yearly**; Scale **$349/mo monthly or $299/mo yearly**. The same page also shows Measure+ as **$109–$169/mo**, and elsewhere "$18 USD reports in 24 hours" — internal inconsistencies that must be re-verified against a live account before driving a spend decision. [Official — pricing page and partner wording]

### 2.9 Exports and integrations

Documented outputs: **PDF report**, detailed **dashboard view**, **CSV downloads on paid plans**, and **Xactimate-ready ESX files** for an added fee, uploadable directly to Xactimate with "no redrawing." ESX is described for gable, hipped, and flat roofs. [Official — pricing page, https://help.roofr.com/en/articles/15525823-how-to-manage-xactimate-ready-esx-files, measurement reports page]

**[Not publicly documented]** native DXF, SKP, XLS/XLSX, XML, JSON, or third-party geometry export formats. Reviewed sources do not document them.

Integrations named: **ABC Supply, QXO, SRS RoofHub**, plus **CompanyCam, Zapier, Gmail, Google Calendar, QuickBooks**. Official pages conflict on QuickBooks status. Roofr says other providers' measurement reports **cannot be imported** ("Can I import other Measurement Reports into Roofr? No.") and that its tools are designed to work together inside Roofr rather than be embedded in external CRMs. [Official — pricing page, FAQs, partnership pages]

### 2.10 Flow sketch

```text
[Jobs -> New -> Report]
        |
        v
[Address / map pin confirmation]  <-- notes, secondary structures, multi-unit scope
        |
        +--> [DIY mode: pick imagery -> trace structure -> measure] ---+
        |                                                             |
        v                                                             v
[Full-service: imagery + multi-check + >=1 expert]        [measurement records]
        |                                                             |
        +---------------------------+-------------------------------+
                                    v
                    [Report: PDF + dashboard + CSV + ESX add-on]
                                    |
                                    v
                    [Estimate / materials / supplier workflows]
```

**Roofr-specific rules a recreation must preserve:** inch-level internal measurement; explicit rounding policy per export; original report immutable with copy-on-edit; version history; all-structures summary; per-feature length categories including flashing types.

---

## 3. RoofSnap — exact measurement workflow

Public sources: `roofsnap.com`, `support.roofsnap.com`, `app.roofsnap.com`. All accessed 2026-11-23. **The authenticated dashboard at `app.roofsnap.com/projects` was not observed** — no login was attempted. Dashboard behavior below is reconstructed from official support docs, screenshots described in those docs, and marketing pages.

### 3.1 Two products in one platform

RoofSnap is both a paid **done-for-you measurement order service** using trained **Sketch Techs**, and a subscription **DIY measurement/estimating suite** on web, iOS, and Android. [Official] It is part of the EverPro/EverCommerce family; third-party sources date the acquisition to 2020-07-01, but official pages do not state a date. [Official + Third-party]

RoofSnap reports use **licensed aerial/satellite imagery** (Nearmap HD in US/Canada, Hexagon coverage described for contiguous US) plus Google/Bing/Apple for **location or supplemental** use, plus user imports. Critically, RoofSnap says **Google Maps may locate/confirm a project but is not a licensed measurement source**, citing Google's terms. [Official] This is a hard compliance constraint for any recreation.

### 3.2 Done-for-you order flow (published steps)

1. Enter property address and relevant structure details.
2. RoofSnap geocodes/verifies the location with a **red pin**.
3. Select **building type** and **report type**.
4. Enter metadata: title, assigned user, office, delivery details.
5. Checkout, PAYG or subscription.
6. A trained **Sketch Tech** creates the measurement diagram from licensed aerial imagery.
7. The order goes through a **quality review** process.
8. A completion email delivers a **downloadable PDF link**.
9. The project appears in the web/mobile project list; on iOS, completed projects land in `New Leads` after sync.
10. The user can modify measurements/report details after delivery.

[Official — support order article, on-demand measurements page, FAQ, receipt article]

**Engineering inference (not published):** model this as a job queue with states `draft → address_verified → priced → paid → queued → assigned → sketched → QA_review → delivered → editable/complete`. [Not publicly documented]

### 3.3 DIY flow and report types

Subscribers select/import imagery, confirm scale, draw roof outlines/facets, label pitch and facet types, add pins/notes/photos, let the app calculate areas/lengths/summaries/waste, and export CSV from the Measurements tab. Built-in imagery has scale set; **imported drone imagery or blueprints require one on-site scale measurement**. [Official — FAQ, scale article, CSV export article]

Publicly observed report types:

| Report type | Content |
|---|---|
| **Half Snap** | Perimeter measurements + one predominant pitch; rough/preliminary bids |
| **Full Snap** | Full linear and area measurements + pitch values for facets where imagery allows |
| **Metal Roof Report** | Cut panel diagram and panel count |
| **Gutter Report** | Eaves, gutters, gutter toppers, end caps, miters, downspout suggestions |
| **Add-On Gutter Report** | Gutter add-on to an existing order |
| **Lighting Report** | Eaves/rakes only; excludes extra roof detail |

[Official — support product article, pricing article, order article]

**Facet labels** include pitch `0/12`–`24/12` plus Dormers, 2 Story, Two Layer, Low Slope. [Official] **Waste calculation** published constants: Valley 2.3 sf/LF, Hip 0.7, Rake 0.25, Step 0.25, plus **5% handling waste**; hip/ridge cap and starter excluded; waste percentage customizable. The exact full formula is not published. [Official]

**Sketching rule:** RoofSnap advises users **not** to trace off-center aerial imagery exactly; draw straight lines and right angles reflecting real-world geometry. [Official] This is a subtle but important UX requirement for a faithful recreation — the drawing model must snap to orthogonal/real-world symmetry rather than follow pixel distortion.

### 3.4 Report contents

A report contains an aerial image page, separate **linear, area, and pitch diagrams**, a summary page, and an automatic **waste table**, with logos/custom language on paid plans. The report can be modified after delivery. A `3D Viewer (BETA)` is referenced in the order flow. [Official]

### 3.5 Accuracy

| Claim | Evidence class | Treatment |
|---|---|---|
| DIY diagrams "drawn correctly" within **1%–3%** of actual roof measurements | Official FAQ | Conditional on user skill and imagery; no benchmark supplied |
| Measurements within a **2% margin of error** when drawn correctly | Official support | Same caveat |
| Orders use trained Sketch Techs + quality review, not pure automation | Official | Process claim; no outcome distribution |
| Imported drone image/blueprint needs one on-site scale measurement | Official | Scale is a stated precondition |
| User anecdote: runs "a minimum of 1 foot off", longer runs 2+ feet | Third-party App Store review | Anecdotal, not a benchmark |
| Rural/new-construction issues and pitch-rounding complaints | Third-party review | Corroborates the imagery/pitch risk found for Roofr |
| No independent quantitative benchmark found | Research result | Both vendors lack one |

The honest reading: **1–3% is a conditional skill/imagery claim, not a guaranteed property of every roof.** A recreation must store image source, capture date, scale reference, reviewer, and edit history with every measurement.

### 3.6 Timing

| Scenario | Public claim |
|---|---|
| Standard measurement order | **2–4 hours** during business hours |
| Rush order | Average **~30 minutes**, "as little as 30 minutes", ≤1 hour guaranteed in pricing comparison |
| Commercial roofs / >50 squares | Guaranteed in **60 minutes** |
| Business hours | Site/FAQ: Mon–Fri 9 AM–7 PM + Sat 9 AM–5 PM ET; one support order article: Mon–Sat 9 AM–5 PM ET (**unresolved contradiction**) |
| DIY simple roof | **<2 minutes** |
| DIY 50-square roof | **~5 minutes** |
| DIY large/complex roof | **10–15 minutes** |

[Official] No offline mode; network is required. [Official]

### 3.7 Pricing

| Item | PAYG | Subscriber |
|---|---:|---:|
| Half Snap, any size | $13 | $10 |
| Full Snap, <50 squares and <15 facets | $35 | Varies by size/facets |
| Full Snap, >50 squares or >15 facets | $55 | Varies by size/facets |
| Gutter report | $15 | $11 |
| Lighting report | $18 | $15 |
| Monthly subscription | — | $105/user/month |
| Annual subscription | — | From $52/user/month |

Subscriber Full Snap bands: `<20` sq $11, `20–30` $17, `30–50` $21, `50–80` $37; over 80 squares by facets `1–4` $11, `5–15` $17, `16–30` $21, `31–50` $37, `51+` $47. Annual plan examples: Starter $1,872/year (2 seats, 480 credits), Pro $3,660/year (5 seats, 1,200 credits), Enterprise $6,240/year (10 seats, 2,400 credits). [Official — pricing and support pricing articles]

**Stale-price warning:** older official snippets mention reports from `$9`; current public pricing starts at `$13`. Treat `$9` as historical.

### 3.8 Exports, integrations, API

Confirmed: **PDF report link by email**, **CSV export from Measurements tab**, post-delivery editing. [Official] CSV schema and PDF template internals are not public. [Not publicly documented]

Current public integrations: **MarketSharp** (flat $30 RoofSnap reports ordered inside MarketSharp) and **AccuLynx** (aerial measurement ordering). [Official] Older official posts describe a Zapier integration and Salesforce API automation; current page does not list Zapier, and third-party reviews claim no public API/Zapier. Current official **API terms** confirm an API exists with sandbox keys, production keys after approval, and revocable access. Best-supported interpretation: **approval-gated/partner-oriented API, not fully self-serve**; current Zapier status unresolved. [Official + Third-party]

**Xactimate/ESX:** a third-party review says there is no Xactimate path or ESX export; no official confirmation or denial was found. Treat as **unverified**. [Third-party + Not publicly documented]

### 3.9 Flow sketch

```text
[Address + structure details]
        |
        v
[Geocode + red-pin verification] <-- building/report type, user/office/title
        |
        +--> [DIY: imagery or user import -> scale -> sketch -> calculate] --+
        |                                                                    |
        v                                                                    v
[Done-for-you: Sketch Tech -> quality review]                    [measurement records]
        |                                                                    |
        +-------------------------------+------------------------------------+
                                        v
                       [PDF + diagrams + waste table + CSV]
                                        |
                                        v
                       [Estimate / contract / payment / CRM]
```

**RoofSnap-specific rules a recreation must preserve:** licensed-vs-location imagery separation; orthogonal sketching rather than pixel tracing; explicit scale for imports; facet pitch/label taxonomy; published waste constants with configurable percentage; PDF+CSV delivery; post-delivery editability.

---

## 4. Side-by-side comparison

| Dimension | Roofr | RoofSnap | Recreation implication |
|---|---|---|---|
| Primary model | Integrated platform; full-service report + DIY | Measurement suite + Sketch Tech service | Support both service and DIY paths in one schema |
| Ordering | Address/map pin in <60 s; Jobs → New → Report | Address, red pin, building/report type, checkout | Pin-verified address intake is common to both |
| Imagery | "Up-to-date HD aerial/satellite"; vendor/age undisclosed | Nearmap HD / Hexagon licensed; Google only for locating | Licensed imagery is the core paid dependency for both |
| Automation | Multi-check + ≥1 expert | Trained Sketch Tech + quality review | Both rely on human QA; neither is fully automatic |
| Report | 7-page PDF, diagram, lengths/areas/pitch, all-structures summary, materials | Aerial page, linear/area/pitch diagrams, summary, waste table, report types | Need a diagram set + summary + waste export, not a single PDF blob |
| Precision model | Inch-level dashboard, foot-rounded PDF diagram, inch totals | "Within 1–3%" / "2%" when drawn correctly; no rounding policy published | Explicit internal/precision vs presentation rounding (Roofr is the clearer model) |
| Accuracy claim | ±1–2 in on standard residential; "down to the inch"; caveat that no service is 100% | 1–3% DIY / 2% when drawn correctly; no independent benchmark | Neither has an independent benchmark; our benchmark is a differentiator |
| Standard timing | As few as 2 h; 6 h; 24 h Starter (un guaranteed) | 2–4 h standard; rush ~30 min/≤1 h; >50 sq 60 min | Target p50 ≤2 h, p95 ≤4 h from accepted job; rush is a separate gate |
| Guarantee exclusions | Nights/weekends, >20 facets, multifamily, unclear boundary, pin mismatch | Business-hours definition contradictory across sources | Any SLA must define business hours, exclusions, and credit remedy explicitly |
| Price | $19 Starter / $13 paid; ESX $12/$10 | $13 Half Snap PAYG; Full Snap $35/$55; gutter $15; lighting $18; subs from $105/user/mo | Cost-per-job ceiling is ~$13–$55; recreation must track this hard |
| Exports | PDF, dashboard, CSV (paid), ESX add-on | PDF, CSV; ESX/Xactimate unverified | PDF+CSV first; ESX is a licensed gate |
| Integrations | ABC Supply, QXO, SRS RoofHub, CompanyCam, Zapier, Gmail, GCal, QuickBooks (conflicting) | MarketSharp, AccuLynx; partner-gated API; Zapier unresolved | Integration surface is a product gate, not a reconstruction prerequisite |
| Independent accuracy benchmark | None found | None found | Building one is a competitive advantage |
| Auth-gated URL observed | Generic dashboard shell only | Not observed (login-gated) | No authenticated claims can be made for either |

**Strategic reading:** the two products converge on the same core system — **address → licensed imagery → measured geometry → deterministic calculations → human QA → PDF/CSV → estimate**. Their differences are packaging, pricing, and export/integration breadth. That convergence is what makes one shared recreation architecture viable.

---

## 5. RoofOS current state and gap analysis

Source audit of `/home/rlongmbox/projects/roof-os`, branch `main`, HEAD `be5c63c014a1efa88e69970869677dfbdc5c75bd`, read-only. **No builds or tests were run**; statuses below are source-state classifications, not production verification.

### 5.1 The central conflict: address-first vs the locked photo-first path

Roofr's order flow is **address-first**: type an address, confirm a pin, get a report in as few as two hours. RoofOS's `docs/EXACT-WORKFLOW.md:3` says **"This is the locked path. Do not invent a second one"**: GPS must be embedded in the photo (`:7-11`), the address is read from that GPS (`:15`), and the address is sent to skyview (`:19`). The locked path then requires a measurement wizard, technician lock, owner-defined approval sequence, and gated send (`:23-53`). Device geolocation alone is explicitly rejected by `scripts/photo-skyview-handoff-test.mjs:17-25`.

**Ruling for this report:** a Roofr/RoofSnap clone that starts from a typed address and bypasses photo GPS, review, locks, and report authority would violate the owner-approved workflow. The recreation must be an **adapter inside the locked path**: address/skyview imagery becomes a *candidate measurement source*, certified photo bytes remain the provenance anchor, and all existing human/owner gates still apply. If the owner wants true address-first, sub-2-hour ordering, that requires an **explicit amendment to the locked workflow** — it is a named gate, not an implementation detail.

This matters for the timing target: Roofr's "<60 seconds to order" is partly a consequence of address-first. Under the locked path, RoofOS cannot beat a field photo capture step; timing parity must be measured from **photo/address accepted**, not from "customer typed an address."

### 5.2 Capability gap table

| Capability | State | Evidence (file:line) | Finding |
|---|---|---|---|
| Locked workflow doctrine | Prototype (spec locked, pipeline not implemented as written) | `docs/EXACT-WORKFLOW.md:3`, `:7-11`, `:15`, `:19`, `:23-31`, `:35`, `:39-44`, `:48-53` | Current source implements GPS-tagged private-photo review, not a fully automated address→skyview pipeline |
| Photo EXIF GPS origin / manual fallback | Implemented source | `app/measure/page.tsx:148-194`; `app/api/measurements/property/route.ts:64-77`; `scripts/photo-skyview-handoff-test.mjs:17-25` | Embedded GPS creates a candidate address; no GPS means manual-only; device location rejected |
| Address lookup / geocoding | Implemented source | `app/api/measurements/property/route.ts:64-99` (Nominatim), `:101-123` (OpenAerialMap STAC), `:125-157` (Overpass), `:159` ("footprint is not roof surface area") | Free candidate discovery exists; outputs are low-confidence, not certified measurements |
| Aerial/satellite/skyview measurement source | Prototype | `lib/measurements/aerial-provider.ts:13-27` (OAM and ArcGIS both `available: false`, `requiresInspectionPhoto: true`); `lib/measurements/footprint-preview.ts:1-23` (`verified: false`); `components/ManualDrawingTool.tsx:130-142` (aerial tile only when supplied, else OSM street map "NOT aerial imagery") | **No authorized address-driven imagery source** — the single biggest Roofr-parity gap |
| External/drone imagery boundary | Implemented source / prototype | `app/api/measurements/drone/route.ts:21-26` | External imagery cannot be submitted directly; must be re-hosted as approved private storage |
| Geometry contract and validation | Implemented source | `lib/ai/geometry-contract.ts:10-35`, `:55-63`, `:67-109`; `scripts/aerial-geometry-test.mjs:8-16` | Strong reusable contract; validates geometry but does not make imagery authoritative |
| Wizard math (scale, slope, squares) | Implemented source | `lib/measurements/calibrated-roof-draft.ts:93-115`, `:119-130`; `lib/measurements/purchasable-roofing.ts:12-18`, `:37-46`; `app/measure/page.tsx:455-470` | Shoelace pixel area, `pixelsPerFoot`, `sqrt(1+(rise/12)^2)`, `/100` squares, 10 sq default / 6 sq owner toggle, 3 bundles/sq, .33/.66 labels |
| Manual map/image tracing | Prototype | `components/ManualDrawingTool.tsx:37-47`, `:120-139`, `:142`, `:158-165` | Explicitly "Provisional horizontal footprint only — Not a material order"; perimeter is not gutter/eave length |
| Auto-measurement authorization / provenance | Implemented source | `app/api/measurements/aerial/route.ts:127-143`, `:187-205`, `:284-305`, `:308-357`, `:360-404` | Fail-closed: server-verified GPS/address, owner toggle, certified bytes/hash, calibration, top-down + pitch attestations, immutable confirmed state |
| Derived quantity authority | Implemented source | `app/api/measurements/manual/route.ts:128-177`; `app/measure/page.tsx:637-653`, `:660-673` | Server recomputes from reviewed geometry; stale client area rejected; unreviewed gutter/ridge/eave/rake/valley LF nulled |
| Golden Report authority | Implemented source | `GOLDEN-REPORT.md:11-18`, `:52-72`, `:100-123`; `app/api/photo-estimate/report/route.ts:75-90`, `:103-114`, `:133-146`, `:148-259`, `:260-262`, `:291`; `lib/reports/golden-report.mjs:14-56` | 12 sections; sourced or `Unknown`; no AI-written money; ridge/rake/valley/fascia/soffit and aerial measurement are `Unknown` unless separately verified |
| NOAA/NWS storm evidence | Prototype | `app/api/storms/nws/route.ts:5-6`, `:22-38`; `app/api/photo-estimate/report/route.ts:190` | Active alerts are candidates only; Storm Events Database not connected; no loss-date/causation inference |
| Estimate draft and quantity authority | Implemented source | `app/api/estimates/draft/route.ts:31-34`, `:53-58`, `:81-102`, `:112-124`; `lib/estimates/verified-photo-workflow.mjs:15-24`, `:31-66`; `lib/estimates/photo-approval.ts:38-61` | Client quantities rejected; current manager approval required; unpriced draft, `needs_price_review`, must not be sent externally |
| Owner lock sequence / send gate | Implemented source | `supabase/migrations/108_approval_lockout_sequences.sql:3`, `:6-19`; `app/api/team/sequence/route.ts:6`, `:23-46`; `app/api/estimates/[id]/lockout/route.ts:45-84`; `app/estimate/[id]/page.tsx:276-329` | Locks enforced with optimistic concurrency; `mailto:`/`sms:` handoff only after `status === 'approved'`; not insurer submission |
| Exports | Prototype | `app/export/page.tsx:22-35`; `components/GoldenReport.tsx:27-30`; `lib/agent5/export.ts:1-6`, `:12-20` | CSV lead export, draft + browser print, internal JSON/CSV; `external_submission: false`, `insurer_submission: false`, `esx_compatible: false`, `export_blocked: true` |
| Blueprint / PDF/DWG/DXF roof takeoff | Absent | `workers/claims/README.md:1-4`, `:16`; `lib/documents/normalizer.ts:2`; `PRODUCT-VISION.md:1` | Only local claims-PDF extraction/normalization for human review; no blueprint import or plan takeoff |
| Test harnesses | Implemented source, not executed here | `package.json:32-36`, `:57-58`, `:62-63`; `scripts/photo-full-report-flow-test.mjs:12-22`; `scripts/measurement-estimate-authority-test.mjs:14-27`; `scripts/roof-measurement-precision-test.mjs:20-38` | Strong contract-test vocabulary for the current path; no green claim made in this report |

### 5.3 Reuse first, build new

**Reuse:** Nominatim/OAM/Overpass candidate discovery; `ManualDrawingTool` as the tracing surface; `geometry-contract.ts` validation; `calibrated-roof-draft.ts` and `purchasable-roofing.ts` math and square/bundle display; the certified-photo → calibration → top-down/pitch confirmation → immutable geometry chain; Golden Report and estimate-draft gates; owner lockout sequence and gated send.

**Build:** an authorized, address-driven skyview image source with capture date, provider, license/provenance, and workspace-scoped storage; a skyview adapter writing into the existing geometry contract (not a second calculation path); a NOAA Storm Events historical connector if report Section 5 must be populated; blueprint ingestion only if the approved dossier requires it; any external/ESX export only as an authorized new capability.

### 5.4 Hard constraints carried into the roadmap

1. No second workflow (`docs/EXACT-WORKFLOW.md:3`).
2. GPS must be in the photo; nearby phone location is insufficient (`:7-11`).
3. Candidates are not measurements: OSM footprints are ground footprint, not roof surface, pitch, overhangs, valleys, waste, or gutter length (`app/api/measurements/property/route.ts:159`).
4. No protected imagery scraping or redistribution (`RESEARCH-GIS-NOAA.md:21`, `:27`).
5. Free-only AI: browser-local Ollama; no hosted paid chat key (`NO-PAID-AI.md:3-8`); manual measurement remains the fallback.
6. Human gates are authority: AI suggestions and client-displayed areas cannot become approved quantities.
7. Report/estimate discipline: Unknown stays Unknown; no dollars in the report; drafts not externally sendable.
8. No early send: send UI appears only after the owner sequence completes.
9. New migrations only; never replay or renumber applied migrations (`MIGRATION-ORDER.md:64-65`).
10. Checkpoint law: checkpoint after every three verified batches, commit/push/SHA-match, update `HANDOFF.md`, no merge with pending/failing checks (`UPDATE-CHECKPOINT-LAW.md:3-13`).
11. Evidence boundary: local tests and CI do not prove hosted Supabase/RLS, deployment, provider execution, device behavior, or field acceptance (`HANDOFF.md:8-9`, `CURRENT-STATE.md:1`).

---

## 6. Open-source stack catalog for address-based aerial measurement

All sources accessed 2026-11-23. "Free" never means "unrestricted": several datasets are research-only or non-commercial, and several free endpoints have hard rate caps that make them unsuitable for production.

### 6.1 Imagery and geodata — what is actually usable

| Source | License / terms | Practical use | Hard limit | Fit |
|---|---|---|---|---|
| **Google Map Tiles** | Proprietary; visualization only. Prohibits image analysis, machine interpretation, tracing/digitizing, 3D model building, and geodata extraction | None for measurement | Policy forbids exactly what a roof report does | **Excluded** |
| **Google Solar Building Insights** | Paid; 10k free requests, then ~$3.50–$10/1k by volume | Returns per-roof-segment `pitchDegrees`, `azimuthDegrees`, `areaMeters2`, `planeHeightAtCenterMeters` | Paid; not reproducible from free data | **Paid gate — strongest pitch/area benchmark available** |
| **Copernicus Sentinel-2 (CDSE)** | Free to all, including commercial | Regional context/screening | 10 m GSD — far too coarse for roof planes; quotas (10k req/mo, 12 TB/30 d) | Context only |
| **Copernicus DEM GLO-30/90** | Free to registered users | Terrain context | `<4 m` vertical error at 90%; terrain, not roof surface | Context only |
| **USGS NAIP** | **Public domain** | US aerial base imagery | 0.6–1 m GSD, 3-year revisit, ≤6 m absolute accuracy at 95%, US only | **Best free US base; insufficient for inch-level claims** |
| **USGS 3DEP S1M** | Public domain | 1 m lidar-derived terrain, rolling out since 2025 | Terrain model, not roof surface; incomplete coverage | Context only |
| **Landsat / HLS / NASA GIBS** | Free; GIBS requires acknowledgement | Time series, regional context | Coarse resolution | Context only |
| **OpenAerialMap** | CC BY 4.0 with OIN contributor attribution, as-is/as-available | Ad hoc high-res imagery | Coverage/currency inconsistent; "reasonable use" limits | Candidate base |
| **Microsoft US Building Footprints** | ODbL; repo archived 2026-10-08 | 129.6M US footprints; pixel recall/precision 95.5%/94.0%, polygon precision 98.5%/recall 92.4%, ~0.86 IoU | Vintage mismatch (many ~2012/2019–20); **footprint ≠ roof outline** | Candidate geometry only |
| **Microsoft Global ML Building Footprints** | CDLA Permissive 2.0; active | 1.4B buildings, 2014–2024; regional precision 92.2–97.2%, recall 70.9–85.9%, IoU 63–68% | Same footprint-vs-roof gap; source imagery not redistributed | Candidate geometry only |
| **Google Open Buildings v3** | CC BY 4.0 or ODbL | 1.8B detections; strong outside US | **No US coverage**; high-rise rooftop displacement; source imagery not included | Non-US candidate only |
| **OSM / Overpass / Nominatim** | ODbL; public Nominatim ≤1 req/s; Overpass guidance ≤10k queries/day, ≤1 GB/day | Address and footprint discovery | Public endpoints not for production scale; self-host or pay | Already used by RoofOS |
| **Mapillary / KartaView** | CC BY-SA 4.0 (both), attribution required | Street-level context | Street view, not roof-plan truth; share-alike obligations | Inspection aid only |
| **County/parcel data** | **No universal license** — e.g., Will County prohibits publishing/resale; Cobb County prohibits resale | Best address/owner/parcel crosswalk | Must be cleared jurisdiction by jurisdiction | **Licensing gate** |

**Compliance ruling:** Google raster tiles cannot be the measurement base (policy forbids tracing and analysis). RoofSnap independently reached the same conclusion. RoofOS's existing `RESEARCH-GIS-NOAA.md:21,27` no-scraping rule is consistent with this.

### 6.2 Roof geometry datasets and models

| Asset | License | Domain / size | Published accuracy | Limitation |
|---|---|---|---|---|
| **AIRS** | NOASSERTION; arXiv withdrawn for lack of license rights | 7.5 cm Christchurch NZ, >220k buildings, 1,047 tiles | Benchmark not verified from primary source | **License must be cleared before any use** |
| **RID** | Repo LGPL-3.0, but README says Google imagery "may not be used for commercial or promotional purposes" | 1,880 roofs, 4,520 segments, azimuth classes | ~0.70 mean IoU; annotator agreement 0.15–0.70 | Imagery terms block commercial use |
| **RID2** | CC BY 4.0 on Zenodo | 4,764 Dutch images, 1,819 roof-centered, masks + superstructures | IoU 0.60→0.70 same-region, 0.635 diverse | Best open research asset; validate provenance |
| **RoofSense** | Code MIT, paper CC BY 4.0 | 300 chips, 8 cm aerial + ALS, 8 material classes | Accuracy 84.99%, F1 84.20%, mIoU 74.74% | Material classification, not geometry/pitch |
| **RoofNet** | **CC BY-NC 4.0** | 51,503 tiles, 184 sites, 112 countries | +39.84% top-1 over CLIP on held-out 635 | Non-commercial; material, not pitch |
| **SpaceNet MVOI** | CC BY-SA 4.0 | ~60k images, 126,747 footprints, look angles −32.5° to +54° | TernausNet F1 **0.62 nadir → 0.43 off-nadir → 0.22 very off-nadir** | Strong evidence for off-nadir risk; footprint only |
| **Building3D** | **CC BY-NC-SA 4.0** | 160k+ Estonian buildings, lidar meshes/wireframes | ICCV 2023 benchmark | Non-commercial; lidar-dependent |
| **SAM 2** | Apache 2.0 (code/weights); SA-V data CC BY 4.0 | Promptable segmentation foundation model | General quality, not roof-specific | Needs prompts; GPU-oriented; not a measurement system |
| **Grounded-SAM-2** | Mixed component licenses | Grounding DINO + SAM2 assemblies | Research utility | Some components carry API-token/cloud-SDK conditions — review before deployment |

**Verdict:** the open datasets are regional, imbalanced, mostly footprint/material rather than pitch, and several are non-commercial. They are useful for prototyping and for a benchmark *seed*, not for a product-grade pitch estimator.

### 6.3 Pitch inference — the hard truth

Free DEMs are **terrain** models (roof surfaces removed). Copernicus DEM error (`<4 m` at 90%) is orders of magnitude larger than a roof pitch requirement; FABDEM (CC BY-NC-SA) is non-commercial and ~30 m. Shadow-length methods estimate building *height*, not pitch, and depend on solar elevation and flat-ground assumptions. One 2021 study using U-Net roof segmentation + Random Forest pitch reported roof-section pixel accuracy **77%**, roof-object segmentation **30%**, pitch **MAE 5.5°**, azimuth accuracy **79%** — and the authors explicitly concluded pitch "cannot be easily estimated from aerial imagery."

**Ruling:** pitch from free aerial imagery alone is a **probabilistic suggestion**, never an authoritative value. Field confirmation or a paid roof-plane source (Google Solar Building Insights / lidar / vendor model) is required for material-order-grade pitch. This aligns with RoofOS's existing confirmation gate (`calibrated-roof-draft.ts:93-115`).

### 6.4 Error budget for scale and georeferencing

| Error source | Magnitude | Consequence |
|---|---|---|
| Imagery GSD | NAIP 0.6–1 m vs AIRS 0.075 m vs Sentinel 10 m | A few-pixel edge shift is inches to feet depending on source |
| Absolute geolocation | NAIP ≤6 m at 95% | Cannot claim sub-inch absolute position |
| Off-nadir relief displacement | SpaceNet F1 0.62 → 0.22 | Severe degradation at high look angles |
| Footprint vs roof | Overhang/eaves | Ground footprint is not roof surface (already asserted at `property/route.ts:159`) |
| High-rise rooftop displacement | Open Buildings documented | View-angle/height jump |
| Capture date | NAIP 3-year revisit | New construction / removed structures |
| Occlusion | SpaceNet, RoofSense | Vegetation, shadows, solar panels degrade segmentation |
| Parcel/address mismatch | Jurisdiction-dependent | Wrong roof measured |

### 6.5 Processing and reporting stack

| Function | Component | License | Notes |
|---|---|---|---|
| Raster I/O / reprojection / clipping | GDAL, rasterio, pyproj | MIT-style / BSD-3 / MIT | Production-grade core |
| Vector cleanup | Shapely | BSD-3 | Production-grade |
| Spatial DB | PostGIS | GPLv2 | Check distribution/hosting implications |
| QA / vector editing | QGIS | GPLv2 | Mature desktop review tool |
| Web map | Leaflet / OpenLayers / MapLibre | BSD-2-style | Already using Leaflet in RoofOS |
| Segmentation | PyTorch + SAM2 / U-Net / DeepLab | BSD-style / Apache 2.0 | GPU strongly recommended |
| API | FastAPI | MIT | Python service layer |
| PDF | ReportLab | BSD | Report rendering |
| XLSX / DXF | openpyxl (MIT), ezdxf (MIT) | MIT | Spreadsheet and CAD exports |
| Orchestration | Temporal (MIT), Celery (BSD-3), BullMQ (MIT) | — | Durable per-address jobs; Temporal preferred |

### 6.6 Latency, cost, and GPU reality

- License cost is not zero cost: imagery, parcels, geocoding, and several datasets carry commercial or share-alike restrictions.
- Free endpoints provide **no SLA**: Nominatim 1 req/s application-wide, Overpass ≤10k queries/day, CDSE quotas as above. A 2-hour guaranteed product cannot depend on them.
- CPU suffices for geocoding, clipping, vector math, and PDF/XLSX/DXF. GPU is strongly advisable for segmentation/material classification; RoofNet fine-tuning used a single A100 40 GB, RoofSense needed tiled inference.
- A CPU-only MVP is possible with smaller models but cannot support a production latency guarantee. Free imagery has no tasking capability, so same-day capture is impossible without a paid provider.
- Current Sentinel Hub/Planet pricing could not be verified from official pages (Sentinel Hub `/pricing/` redirects to Planet, which rendered no prices). Older price snippets must not be treated as current.

### 6.7 OSS verdict and the five paid gates

**OSS-only is viable for:** a research prototype, a non-commercial pilot, back-office measurement with human review, US areas with usable NAIP, and "good enough" outline/area estimation.

**OSS-only is not sufficient for:** guaranteed current imagery, taskable same-day capture, insurance-grade pitch/planes, consistent US-wide/global coverage, commercial use of non-commercial datasets, low-latency SLA, or accepted report formats/integrations.

| Gap | Why it matters | Paid gate |
|---|---|---|
| 1. Current high-res imagery with commercial derivation rights | NAIP is 0.6 m / 3-year revisit; Google tiles forbid analysis | Planet/Maxar/Airbus tasking, EagleView, Nearmap, licensed aerial |
| 2. Roof pitch/plane truth | Pitch is not reliably inferable from monocular aerial imagery; free DEMs are terrain | Google Solar Building Insights, lidar/photogrammetry, vendor roof models |
| 3. Parcel/address rights by jurisdiction | County terms often prohibit resale | County commercial licenses, commercial geocoder, data broker |
| 4. Production labels and QA | Public datasets are regional and degrade off-nadir/occluded | Annotation labor, review operations, evaluation on bought imagery |
| 5. Report acceptance and integrations | A polygon is not an accepted insurance/estimating report | Xactimate/ESX, vendor report APIs, support/SLA/liability |

**Recommended architecture:** free/public data for discovery and draft geometry → **paid imagery/provider-roof-insight gate only when an address becomes a paid report** → per-parcel license/provenance stored → human QA and confidence flags always → pitch probabilistic unless backed by lidar/stereo/provider planes.

---

## 7. Accuracy recreation strategy

### 7.1 Two-layer precision model

Roofr's PDF-vs-dashboard behavior is the clearest public precision model in either product, so it becomes the reference:

- **Layer 1 — measurement records:** store every dimension in inches with full precision, plus source, scale anchor, imagery capture date, reviewer, and version.
- **Layer 2 — presentation policy:** each export declares its own rounding and omission rules. The PDF may round diagram lines to feet and totals to inches; the dashboard/API must expose unrounded values. No consumer may use a rounded presentation value as an input to a calculation.

RoofOS already has `Unknown` discipline and immutable confirmed geometry (`app/api/measurements/aerial/route.ts:360-404`); the new piece is an explicit per-format rounding policy so a rounded PDF line is never mistaken for the measured value.

### 7.2 Error budget decomposition

A roof report number is a chain, and the weakest link dominates:

| Link | Main error source | Control |
|---|---|---|
| Imagery | capture age, resolution, off-nadir distortion, occlusion (trees, new construction) | capture date + provider + license stored; reject stale/insufficient imagery; flag occlusion |
| Georeferencing / scale | wrong pin, imagery without true scale, imported image without anchor | pin verification; one known length for every import; residual recorded |
| Outline / facets | tracing distortion, overhang vs footprint confusion, simplifications | orthogonal snap (RoofSnap rule); do not equate OSM footprint with roof area; human confirm |
| Pitch | shadow/DEM inference error, rounding, multi-pitch facets | store pitch per facet with method; field confirmation when material ordering depends on it |
| Linear features | hip/valley/rake/eave/flashing classification and endpoints | typed line features with evidence; unreviewed lengths are `Unknown`, not approved |
| Waste / quantity | rule constants, waste percentage, unit conversion | versioned rule table with unit tests; display both rule version and inputs |

For area specifically, **linear error roughly doubles in the area percentage** (a 1% length error on two axes is about a 2% area error). That is why a "1–3%" claim cannot be met by better arithmetic; it is won or lost in imagery and geometry.

### 7.3 Golden set and ground truth

Before any parity claim, build a benchmark of at least **50 properties**, stratified by:

- roof complexity: simple gable/hip, 5–15 facets, >15 facets, >20 facets (Roofr's guarantee exclusion boundary);
- pitch: low, standard, steep, multi-pitch;
- condition: foliage occlusion, dormers under canopy, solar panels, snow, multi-layer, new construction, rural imagery gaps;
- structure: single, secondary structures, multi-building/multifamily;
- imagery: recent licensed, older licensed, user-supplied drone with anchor, free satellite only.

Ground truth, in descending authority: tape/laser field measurement; RTK drone or terrestrial LiDAR; independently measured architectural plan; a commercial report used only as a **comparison artifact**, never as truth. No independent all-provider benchmark on identical roofs was found in public sources, so this golden set is itself a differentiator.

### 7.4 Proposed parity targets (owner approval required)

| Metric | Definition | Proposed target | Vendor reference |
|---|---|---|---|
| Facet area error | abs(pred − truth)/truth per facet | median ≤ 2%, p90 ≤ 5% | Beats RoofSnap's 1–3% skill-dependent claim at the median |
| Total squares error | abs(pred − truth)/truth per report | median ≤ 1.5%, p90 ≤ 4% | Roofr "±1–2 in" is a length claim, not a report claim |
| Pitch error | degrees from field-confirmed pitch | median ≤ 1°, p90 ≤ 2° | Addresses the most common third-party complaint for both vendors |
| Linear feature error | hip/valley/rake/eave/run length | median ≤ 2 in on runs ≤ 50 ft, p90 ≤ 1% | Consistent with inch-level dashboard precision |
| Scale residual | known anchor length residual | ≤ 1 in | Applies to imported imagery and drone captures |
| Publish rate | jobs passing metric QA without manual re-sketch | ≥ 80% on standard residential; lower acceptable on complex | Mirrors vendor exclusions for complex roofs |
| Human minutes | reviewer time from accepted job to locked set | ≤ 15 min standard | Both vendors sell time savings |

These are proposed, not approved. They must be re-baselined after Phase 0 against real Roofr/RoofSnap outputs on the same properties.

### 7.5 Confidence tiers and refusal rule

| Tier | Source geometry | Allowed use |
|---|---|---|
| A | Recent licensed imagery with known scale + field-confirmed pitch | Professional takeoff; still verify critical order quantities |
| B | Licensed imagery with scale, no field pitch | Preliminary estimating only |
| C | User-supplied drone/blueprint with one scale anchor | User-dependent; labeled accordingly |
| D | Google/Bing/OSM visual reference only | **Location/inspection aid — no measurements permitted** |

If a job cannot reach Tier A or B, the system emits `Unknown` for dimensions and blocks the report's measurement section. This preserves the Golden Report rule and matches RoofSnap's own refusal to use Google imagery as a measurement base.

---

## 8. Timing recreation strategy

### 8.1 What "timing" means here

Roofr's sub-minute order and RoofSnap's 30-minute rush both assume **address-first intake**. RoofOS's locked path requires a GPS-stamped field photo first (§5.1). Therefore the parity clock starts at **accepted photo/address**, not at "customer typed an address." Any comparison that ignores this is misleading.

### 8.2 Pipeline budget

| Stage | Target | Notes |
|---|---|---|
| Ingest + EXIF/GPS + provenance | ≤ 30 s | Existing RoofOS path; immutable manifest |
| Address + candidate imagery acquisition | ≤ 5 min warm cache, ≤ 60 min cold | **Biggest variable**; licensed imagery lookup is the critical dependency |
| Candidate outline + facet/label suggestion | ≤ 3 min CPU | 2D geometry, not 3D reconstruction — much cheaper than the Hover pipeline |
| Human sketch/review/QA | ≤ 15 min standard | Staffing-dependent; rush tier requires dedicated reviewer capacity |
| Calculation + report render + CSV | ≤ 1 min | Deterministic, versioned |
| Delivery + lock + send | ≤ 1 min | Owner sequence gates apply |

Proposed service targets: **p50 ≤ 2 hours, p95 ≤ 4 hours** from accepted photo/address under normal staffing; **rush ≤ 1 hour** only when imagery is already cached and a reviewer is on shift. A DIY/self-measure path should target **≤ 10 minutes** of user time for a simple roof, matching RoofSnap's <2 min / ~5 min / 10–15 min self-reported bands.

### 8.3 Operational controls

- Reuse existing Nominatim/OAM/Overpass candidate lookup; add an authorized imagery provider adapter with capability flags (`locate_only`, `measurable`, `has_scale`, `capture_date`, `license_region`, `max_zoom`).
- Cache imagery by address/footprint with capture-date metadata; pre-warm for known jobs.
- Use durable workflow orchestration (Temporal preferred; Celery/BullMQ alternatives) with retries, idempotent steps, and per-stage timing logs.
- Define **business hours, exclusions, and credit remedy** up front, as Roofr does: complex roofs, pin mismatch, missing imagery, and multifamily are excluded from the standard guarantee.
- Track p50/p95 per stage and per imagery provider; publish a cost-per-job and time-to-lock dashboard.
- Hardware note: this 2D pipeline does **not** require the GPU reconstruction stack the Hover program needs. The local 2-core/2.7 GiB dev machine is inadequate for bulk imagery processing but adequate for unit tests and small fixtures; production imagery and ML inference belong on a separate worker tier.

---

## 9. Target architecture and data model

### 9.1 Architectural ruling

There is **one** measurement pipeline, not two. RoofOS's locked doctrine (`docs/EXACT-WORKFLOW.md:3`) forbids a second workflow, and the Roofr/RoofSnap comparison shows both vendors run the same underlying pipeline with different packaging. The target is therefore:

```text
PHOTO (EXIF GPS) ── or ── ADDRESS-FIRST (owner-amendment gate only)
        │
        ▼
┌─────────────────────────────────────────────────────────┐
│ 1. INGEST + PROVENANCE                                  │
│    certified bytes, sha256, EXIF, workspace scope        │
└─────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────┐
│ 2. GEOLOCATION + CANDIDATE RESOLUTION                   │
│    reverse-geocode → Nominatim candidates → OAM STAC     │
│    → Overpass footprints (candidate, never authority)    │
└─────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────┐
│ 3. IMAGERY PROVIDER ADAPTERS                            │
│    provider contract: locate_only | measurable |         │
│    has_scale | capture_date | license_region | max_zoom │
│    ├─ open: NAIP / OAM / OSM (free tier)                 │
│    ├─ paid gate: licensed aerial (Nearmap/Planetary)     │
│    └─ paid gate: provider roof planes (Solar Insights)   │
└─────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────┐
│ 4. GEOMETRY SUGGESTION (AI, NON-AUTHORITATIVE)          │
│    roof masks → facet polygons → typed line features     │
│    writes into lib/ai/geometry-contract.ts               │
│    pitch = suggestion w/ confidence, never authority     │
└─────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────┐
│ 5. HUMAN REVIEW (TECHNICIAN)                            │
│    orthogonal snapping, facet/pitch labels, scale anchor │
│    confirm top-down + pitch → immutable confirmed set    │
└─────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────┐
│ 6. CALCULATION (SERVER, DETERMINISTIC, VERSIONED)       │
│    areas/squares/slope/waste/linear totals by line type  │
│    reuse calibrated-roof-draft.ts + purchasable-roofing  │
└─────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────┐
│ 7. REPORT RENDERING (2 LAYERS)                          │
│    dashboard/API: full precision in inches               │
│    PDF: per-format rounding + omission policy            │
│    exports: PDF, CSV, (ESX = licensed gate)              │
└─────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────┐
│ 8. APPROVAL + SEND                                      │
│    owner-defined sequence → lock → gated send            │
└─────────────────────────────────────────────────────────┘
```

Steps 1–2, 5–8 already exist in RoofOS source (§5). Steps 3 and 4 are the genuine build.

### 9.2 Provider adapter contract

```ts
// Conceptual; not committed code.
interface ImageryProvider {
  id: string;
  capabilities: {
    locateOnly: boolean;      // may confirm address, may NOT measure
    measurable: boolean;      // may seed a measurement
    hasScale: boolean;        // georeferenced, known pixels-per-foot
    hasCaptureDate: boolean;
    maxZoom: number;
  };
  license: {
    attribution: string;
    commercialUse: boolean;   // false ⇒ locate-only or refuse
    shareAlike: boolean;
    redistribution: boolean;
  };
  coverage: (lat: number, lon: number) => Promise<CoverageResult>;
  fetchTile(ctx: ImageContext): Promise<ImageryAsset>;
}
```

**Hard rule encoded in the contract:** `locateOnly: true` ⇒ the provider may never seed a measurement. This makes RoofSnap's Google-Maps restriction enforceable in code rather than policy prose.

### 9.3 Data model additions

New tables (new migration only — `MIGRATION-ORDER.md:64-65`):

| Table | Purpose | Key fields |
|---|---|---|
| `imagery_providers` | Registered provider + license posture | `id`, `capabilities jsonb`, `license jsonb`, `enabled` |
| `imagery_assets` | Captured imagery + provenance | `provider_id`, `workspace_id`, `capture_date`, `gsd_m`, `pixel_per_foot`, `license_id`, `sha256`, `storage_path` |
| `measurement_facets` | Per-facet geometry + pitch | `measurement_id`, `polygon`, `pitch_value`, `pitch_method`, `label`, `confidence`, `verified_by` |
| `measurement_features` | Typed linear features | `measurement_id`, `type` (eave/valley/hip/ridge/rake/step/flashing/gutter/parapet/transition), `polyline`, `length_in`, `verified_by` |
| `measurement_scale_anchors` | Scale proof | `measurement_id`, `image_point_a/b`, `real_length_ft`, `residual_in`, `method` |
| `report_policies` | Per-format rounding/omission rules | `format`, `round_rule jsonb`, `omit_types jsonb`, `version` |
| `measurement_benchmarks` | Golden-set results | `benchmark_id`, `property_id`, `metric`, `predicted`, `truth`, `error_pct`, `run_id` |

**Authority rules carried from existing code:** `Unknown` stays `Unknown`; unreviewed linear features are nulled (`measurements/manual/route.ts:128-177`); AI suggestions never become approved quantities; confirmed geometry is immutable (`measurements/aerial/route.ts:360-404`).

### 9.4 Fan-out to the three product modes

| Mode | Route through pipeline | Authority |
|---|---|---|
| **Service (Roofr-like)** | Photo/address → suggestion → technician review → report | Technician + owner sequence |
| **DIY (RoofSnap-like)** | Address/imagery → user traces → confidence tier assigned → report | User-drawn; tier B/C unless field-verified |
| **Legacy/current RoofOS** | Photo → wizard → review → report/estimate | Unchanged; existing lock sequence |

All three write the **same** measurement records. This is what makes the three products comparable on one benchmark.

---

## 10. Phased roadmap and gates

Every phase lists its exit criteria. No phase may skip a gate. Owner approval is required to open any paid gate.

### Phase 0 — Baseline and benchmark harness (no paid gates)

| Item | Detail |
|---|---|
| Goal | Establish the measurement ground truth before building anything |
| Work | Assemble the 50-property golden set; field-tape/RTK truth; capture the RoofOS baseline; build `measurement_benchmarks` writer and scorer; write the metric spec from §7.4 |
| Reuses | Existing `scripts/roof-measurement-precision-test.mjs`, `scripts/aerial-geometry-test.mjs`, `scripts/measurement-estimate-authority-test.mjs` |
| Exit | ≥50 properties with truth; baseline error distribution published; target numbers ratified |
| Gates | None (free only). Field labor is the cost — see §11 |

### Phase 1 — Licensed imagery adapter (first paid gate)

| Item | Detail |
|---|---|
| Goal | Replace the "NOT aerial imagery" fallback with a real measurable source |
| Work | `imagery_providers` + `imagery_assets`; provider contract; NAIP/OAM free adapter first; one licensed aerial adapter behind a feature flag; attribution and license stored per asset; capture-date staleness check; `locateOnly` enforcement |
| Exit | A known address resolves to a measurable, attributed, dated asset; geometry contract accepts it; no provider can seed a measurement without `measurable: true` |
| Gates | **G1 — paid imagery provider** (owner approval) |
| Tests | TDD: provider contract unit tests; `locateOnly` refusal test; staleness refusal test; attribution-presence test |

### Phase 2 — Geometry suggestion engine (AI, non-authoritative)

| Item | Detail |
|---|---|
| Goal | Produce draft facet polygons and typed line features for human review |
| Work | Roof segmentation (RID2-seeded U-Net/DeepLab or SAM2-assisted); footprint fusion with Microsoft Global ML footprints; line-feature classification (hip/valley/rake/eave); pitch suggestion with confidence; writes into `geometry-contract.ts` only |
| Exit | ≥60% draft acceptance rate on the golden set **measured against human edits**, with every suggestion carrying confidence and provenance |
| Gates | **G2 — GPU worker tier** (owner approval) if the free-tier CPU path cannot hold latency |
| Tests | TDD: contract validation, confidence monotonicity, "AI value cannot become approved quantity" regression test |

### Phase 3 — Reviewer console + service mode

| Item | Detail |
|---|---|
| Goal | Make human QA fast enough to hit the timing target |
| Work | Reviewer queue; orthogonal/right-angle snapping (RoofSnap rule); facet + pitch + label editing; scale-anchor entry for imports; assignment, rejection/rework, audit trail; reviewer timer |
| Exit | ≤15 min human minutes per standard job; ≥80% of standard jobs published without re-sketch; full audit trail on every published report |
| Gates | None technically. **G3 — reviewer staffing** is an operating gate |
| Tests | TDD: snapping geometry, scale residual computation, rework audit trail, approval immutability |

### Phase 4 — Report renderer + exports

| Item | Detail |
|---|---|
| Goal | Match Roofr's two-layer precision model and produce real deliverables |
| Work | `report_policies` table; PDF renderer (ReportLab) with summary + linear/area/pitch diagrams + all-structures summary + waste table; unrounded dashboard/API view; CSV export (facets, lines, pitches, waste); Roofr-style length categories including flashing types |
| Exit | PDF and dashboard round-trip consistent within the declared policy; PDF omits nothing silently (omissions recorded); CSV schema documented and versioned |
| Gates | **G4 — ESX/Xactimate compatibility** (owner approval; licensed). Not required for phase exit |
| Tests | TDD: rounding policy table-driven tests, omission audit test, PDF/CSV field parity test |

### Phase 5 — Timing, SLA, and operations

| Item | Detail |
|---|---|
| Goal | Convert the pipeline into a measurable service with a defensible promise |
| Work | Temporal workflow; per-stage p50/p95 telemetry; business-hours calendar; exclusion rules (complex roofs, pin mismatch, missing imagery, multifamily); credit/remedy mechanism; cost-per-job dashboard; cold-cache warming |
| Exit | p50 ≤2 h, p95 ≤4 h from accepted photo/address over ≥100 measured jobs, with exclusions published |
| Gates | None technically. **G5 — staffing for a guarantee** is an operating gate |
| Tests | TDD: SLA clock boundaries, exclusion evaluation, credit calculation, retry/idempotency |

### Phase 6 — Address-first ordering (optional, owner amendment)

| Item | Detail |
|---|---|
| Goal | Match Roofr's sub-minute order experience |
| Work | New intake that bypasses photo GPS, explicitly violating `EXACT-WORKFLOW.md:7-11`; therefore requires an owner-approved amendment to the locked workflow |
| Exit | Only if amended. Otherwise **not built** |
| Gates | **G6 — owner amendment to the locked workflow** (highest-priority decision) |

### Phase 7 — Integrations and market surface

| Item | Detail |
|---|---|
| Goal | Reach parity in workflow breadth, not just measurement |
| Work | API/webhooks for CRM; supplier and estimating integrations; ESX (if G4 approved); mobile-friendly review surface |
| Exit | Named integration live and tested against a sandbox |
| Gates | **G7 — each third-party integration's terms** (owner approval) |

### Gate summary

| Gate | What it unlocks | Cost character | Blocking? |
|---|---|---|---|
| G1 licensed imagery | Measurable addresses beyond free NAIP/OAM | Recurring per-image/per-report | **Yes — Phase 1 onward** |
| G2 GPU worker tier | Faster/stronger segmentation | Recurring compute | No — CPU path exists |
| G3 reviewer staffing | Human QA throughput | Labor | No — limits volume |
| G4 ESX/Xactimate | Estimator acceptance | Licensing | No |
| G5 SLA staffing | Guaranteed turnaround | Labor | No — limits the promise |
| G6 workflow amendment | Address-first ordering | Policy only | No — default is adapter mode |
| G7 integration terms | Market surface | Per-partner | No |

**Critical path:** G1 → Phase 1 → Phase 2 → Phase 3 → Phase 5. Phases 4 and 7 can proceed in parallel.

---

## 11. Cost model

All figures are **estimates built from public vendor prices and stated assumptions**, not quotes. No vendor was contacted and no spend was committed.

### 11.1 Revenue-side benchmark (what the market pays)

| Product | Price per report | Notes |
|---|---:|---|
| Roofr Starter | $19 | 24 h, not guaranteed |
| Roofr paid plan | $13 | 2 h / 6 h guaranteed tiers |
| Roofr ESX add-on | $10–$12 | Paid-plan ESX $10 |
| RoofSnap Half Snap PAYG | $13 | Subscriber $10 |
| RoofSnap Full Snap PAYG | $35 (<50 sq, <15 facets) / $55 (larger) | Subscriber $11–$47 by band |
| RoofSnap Gutter / Lighting | $15 / $18 | Subscriber $11 / $15 |

**Market ceiling for a comparable report: roughly $13–$55 per report**, with $13 as the price-war floor for a simple automated report.

### 11.2 Cost-side build (one-time engineering)

| Item | Basis | Estimate |
|---|---|---|
| Phase 0 benchmark | 50 properties × field/RTK truth (labor) | 100–200 contractor-hours |
| Phase 1 imagery adapter | 1–2 weeks engineering | 80–160 hours |
| Phase 2 geometry engine | dataset prep + model + evaluation | 160–320 hours |
| Phase 3 reviewer console | UI + queue + audit | 120–240 hours |
| Phase 4 report/exports | renderer + policies + CSV | 80–160 hours |
| Phase 5 ops/SLA | workflow + telemetry + SLA logic | 80–160 hours |
| Phase 6 address-first (if approved) | intake + workflow amendment | 60–120 hours |
| Phase 7 integrations | per integration | 40–120 hours each |

Engineering total: **~600–1,400 hours** excluding benchmark field labor. At a $75–$150 fully-loaded contractor rate that is **$45k–$210k** — the dominant one-time cost, and the reason a benchmark-first order matters: it prevents spending that on a pipeline that cannot hit the accuracy target.

### 11.3 Recurring cost per report

| Component | Free tier | Paid tier | Notes |
|---|---|---|---|
| Geocoding | Nominatim self-hosted | Commercial geocoder | Free public endpoint is rate-limited to 1 req/s |
| Aerial imagery | NAIP/OAM (per-area download cost) | Licensed aerial per image | NAIP bulk download is cheap but 3-year revisit |
| Roof planes/pitch | none reliable | Provider roof insights per query | Google Solar Building Insights ≈ $3.50–$10 per 1k requests at volume |
| ML inference | CPU worker | GPU worker | Small U-Net on CPU is possible; SAM2-class needs GPU |
| Storage | object storage | object storage | Imagery dominates storage; retention policy matters |
| Human QA | owner/technician time | dedicated reviewer | The real quality cost |
| Orchestration | Temporal OSS | Temporal OSS + hosting | OSS license, paid ops |
| Report/export | ReportLab/ezdxf/openpyxl | same | OSS |

**Illustrative unit economics at 100 reports/month** (assumptions, not measurements):

| Line | Free-only pilot | Licensed production |
|---|---:|---:|
| Imagery | ~$0–$2 | $3–$12 |
| Geocoding/infra | ~$1–$3 | $2–$5 |
| Compute | ~$0–$1 | $1–$6 |
| Storage + egress | ~$0.30–$1 | ~$0.50–$2 |
| Human QA | 10–20 min | 10–20 min |
| **Total non-labor per report** | **~$1.30–$7** | **~$6.50–$25** |
| **Total with QA at $50/h** | **~$10–$24** | **~$15–$42** |

At $13/report, a licensed production pipeline with 15 minutes of QA is **margin-negative**. Three ways out, all requiring a decision:

1. **Price above the $13 floor** — sell the audit trail, confidence tiers, and benchmark evidence at $25–$55.
2. **Reduce QA minutes** — only viable if Phase 2 genuinely lifts the draft-acceptance rate (it also reduces the accuracy risk, so it is the aligned lever).
3. **Sell a higher-value tier** — Full Snap-equivalent (all facets, all edge types, waste table, CSV) at $35–$55 where QA time is better spent, while $13 buys a Half Snap-equivalent (perimeter + predominant pitch), exactly as RoofSnap prices it.

**Recommendation:** mirror RoofSnap's tiering. The $13 tier is perimeter-plus-pitch with a tight QA budget; the $35–$55 tier is full measurement with the depth QA. Trying to run a full report for $13 is the fastest way to lose money and lose accuracy at the same time.

### 11.4 Explicitly excluded from the cost model

- Owner/technician labor beyond QA minutes.
- Field-verification trips (customer-scheduled or technician-scheduled).
- Taxes, payment-processing fees, refunds/SLA credits.
- Any cost for G1/G2/G4/G5 that the owner has not approved.
- Current Sentinel Hub/Planet pricing — could not be verified from official pages (Sentinel Hub redirects to Planet, which rendered no prices); older snippets are stale.

---

## 12. Risk register

| ID | Risk | Likelihood | Impact | Mitigation | Owner gate |
|---|---|---|---|---|---|
| R1 | Address-first clone violates the locked photo-first workflow | High if built naively | High — invalidates approved design | Adapter-in-locked-path is the default; true address-first is G6 | **G6** |
| R2 | Paid imagery gate never approved → no measurable source | Medium | High — pipeline stalls at Phase 1 | NAIP/OAM free adapter gives a degraded measurable tier; explicit Tier B labeling | **G1** |
| R3 | Accuracy target unreachable from monocular imagery | Medium-high | High — invalidates the parity claim | Pitch stays probabilistic; field verification path; benchmark decides before build-out | — |
| R4 | Data-license breach (Google tiles analysis, OSM share-alike, non-commercial dataset) | Medium | High — legal exposure | Provider contract encodes `commercialUse`; legal review per dataset; `locateOnly` enforcement | G1/G7 |
| R5 | $13 price floor cannot cover licensed cost + QA | High | High — negative unit economics | Two-tier pricing mirroring RoofSnap; publish cost-per-job; price above the floor | Owner pricing decision |
| R6 | Human QA capacity limits throughput and SLA | Medium | Medium-high | Draft-acceptance rate as the lever; queue with rejection/rework; staffing model per §10 Phase 5 | **G5** |
| R7 | Rounding policy causes a foot-rounded PDF value to be used for ordering | Medium | High — wrong material quantities | Two-layer model; consumer-side assertions; omission audit; report marks rounding | — |
| R8 | Imagery staleness (3-year NAIP revisit; new construction) | High | Medium-high | Capture-date stored; staleness threshold; new-construction flag; refusal → `Unknown` | — |
| R9 | Off-nadir and occlusion degrade segmentation | High in some markets | Medium | Confidence scoring; human review; benchmark stratifies these cases | — |
| R10 | County parcel/address mismatch → wrong roof measured | Medium | High | Pin verification; multiple-candidate display; address confirm step; audit trail | — |
| R11 | Benchmarks built on non-representative US subset | Medium | Medium | Stratify by complexity, pitch, condition, region, imagery age | — |
| R12 | ESX/Xactimate format cannot be produced without a license | Medium | Medium | ESX is G4; PDF+CSV first; never fake a compatible export | **G4** |
| R13 | Scope creep into a parallel measurement system | Medium | High — violates `EXACT-WORKFLOW.md:3` | Every new capability must write into the existing geometry contract and report authority | — |
| R14 | Benchmark truth itself is wrong | Low-medium | High — invalidates every metric | Dual measurement where feasible; record method and residual; adjudicate disagreements | — |
| R15 | SLA promise made before p95 is measured | Medium | High — credibility loss | p95 over ≥100 measured jobs before any guarantee language | **G5** |
| R16 | AI suggestion becomes de-facto authority | Low (gates exist) | High | Server-side recomputation, `Unknown` nulling, approval immutability, regression tests | — |
| R17 | Multi-family / multi-building scope ambiguity | Medium | Medium | Explicit scope field; excluded from standard guarantee | — |
| R18 | Free endpoint rate limits (Nominatim 1 req/s, Overpass 10k/day, CDSE quotas) break the pipeline under load | High if unaddressed | Medium-high | Self-host Nominatim/Overpass or use extracts; cache aggressively; never depend on public endpoints in a SLA path | — |

---

## 13. Sources

All web sources accessed **2026-11-23**. Labels: **[Official]** vendor-owned, **[Third-party]** independent/industry, **[Not publicly documented]** not found in reviewed public material.

### Roofr — official

- https://roofr.com/measurements — product modes, "multi-check system", imagery, material/waste claims
- https://roofr.com/measurement-reports — "as few as 2 hours", map-pin flow, multi-building, ESX roof types
- https://roofr.com/pricing — $19/$13 reports, $12/$10 ESX, $31/$23 bundles, plan prices, CSV
- https://roofr.com/faqs — 24 h estimate, no service is 100% accurate, double-check, QuickBooks conflict
- https://roofr.com/delivery — 2 h/6 h and 3 h/6 h ESX guarantees, exclusions, credit remedy
- https://roofr.com/qxo/measurements — "$13 … in as little as 2 hours"
- https://roofr.com/partnerships/abc-supply/measurements — "at least one Roofr expert" review
- https://roofr.com/comparison — "under 3 hrs" / "under 6 hrs" wording
- https://roofr.com/blog/creating-roof-measurement-reports-for-complicated-roofs — 2–24 h, "accurate down to the inch"
- https://roofr.com/blog/roof-measurements — satellite "accurate +/- 1-2 inches" for standard residential
- https://roofr.com/blog/roofing-glossary — report component definitions
- https://help.roofr.com/en/articles/15555058-how-to-order-a-roofr-measurement-report — Jobs → New → Report, <60 s, extras, multi-unit
- https://help.roofr.com/en/articles/15555151-how-to-order-a-roofr-multi-building-report
- https://help.roofr.com/en/articles/15555258-how-to-use-roofr-s-measurements-page — queue columns, version dropdown
- https://help.roofr.com/en/articles/15555399-how-to-create-a-measurement-report-diy — DIY flow
- https://help.roofr.com/en/articles/15555318-roofr-measurement-pdf-vs-dashboard-view — rounding rules
- https://help.roofr.com/en/articles/15555375-how-to-edit-a-roofr-report — copy-on-edit
- https://help.roofr.com/en/articles/15525823-how-to-manage-xactimate-ready-esx-files
- https://help.roofr.com/en/articles/15545259-roofr-pricing-and-packaging-update-2026
- https://cdn.prod.website-files.com/6493173e3cea69ef8852e657/6493173e3cea69ef8852ea1f_Roofr%20Report%20-%20Sample%20Report.pdf — 7-page sample
- User-supplied https://app.roofr.com/dashboard/team/580504/report/queue?checkoutToken=… — generic "Dashboard - Roofr" shell only; auth-gated

### Roofr — third-party

- https://roofingsoftwareguide.com/reviews/roofr-review — complex pitch, canopy dormers, old imagery
- https://roofingsoftwareguide.com/comparisons/roofr-vs-roofsnap-vs-eagleview-roof-measurement-comparison — no Roofr benchmark published
- https://estimateondemand.com/roof-measurement-reports-accuracy-roofers — no independent all-provider test

### RoofSnap — official

- https://roofsnap.com/ — positioning, 30-minute rush
- https://roofsnap.com/pricing — $13 PAYG, $105/user/mo, $52/user/mo annual, feature table
- https://roofsnap.com/solutions/on-demand-roof-measurements — 3-step flow, 2–4 h, Sketch Tech, business hours
- https://roofsnap.com/faq — 1–3% DIY, quality review, imagery partners, no offline
- https://roofsnap.com/about-us/ — EverPro/EverCommerce family
- https://roofsnap.com/integrations/ — MarketSharp, AccuLynx
- https://roofsnap.com/api-terms-of-use/ — API existence, sandbox→production approval
- https://roofsnap.com/comparison/roofsnap-vs-roofr
- https://roofsnap.com/blog/roofsnap-s-high-definition-imagery — six recent captures, up to 3×/year
- https://support.roofsnap.com/hc/en-us/articles/20343568315031-HOW-TO-Order-a-Measurement-Report — order steps, `orders/v2/create`
- https://support.roofsnap.com/hc/en-us/articles/4409629835799-Measurement-Order-Pricing — Half/Full/Gutter/Lighting bands
- https://support.roofsnap.com/hc/en-us/articles/4412983002007-RoofSnap-Subscription-Pricing — Starter/Pro/Enterprise
- https://support.roofsnap.com/hc/en-us/articles/4412982990231-What-products-does-RoofSnap-offer — Half/Full Snap definitions
- https://support.roofsnap.com/hc/en-us/articles/4412995327639-How-accurate-are-RoofSnap-s-measurements — "within a 2% margin of error"
- https://support.roofsnap.com/hc/en-us/articles/4412987600151-Where-does-RoofSnap-s-imagery-come-from- — Nearmap/Hexagon
- https://support.roofsnap.com/hc/en-us/articles/4412987602455-Why-can-t-I-use-Google-Maps-to-measure — licensing restriction
- https://support.roofsnap.com/hc/en-us/articles/5372976263831-How-Do-I-Export-My-Project-Data-from-the-RoofSnap-Web-App — CSV
- https://support.roofsnap.com/hc/en-us/articles/4412987606551-Do-I-need-to-take-any-on-site-measurements-to-use-RoofSnap — scale for imports
- https://support.roofsnap.com/hc/en-us/articles/22488849873559-Why-aren-t-my-measurements-exactly-tracing-the-roof-lines-in-the-picture — orthogonal sketching
- https://support.roofsnap.com/hc/en-us/articles/4412995326103-How-long-does-it-take-to-measure-a-roof-using-RoofSnap — DIY timings
- https://support.roofsnap.com/hc/en-us/articles/4412987605015-What-are-facet-labels
- https://support.roofsnap.com/hc/en-us/articles/4412982989079-What-is-a-DIY-Project — DIY project boundary
- https://support.roofsnap.com/hc/en-us/articles/4409791643927-How-do-I-receive-my-Measurement-Order — PDF delivery
- https://support.roofsnap.com/hc/en-us/articles/4412987602455-Why-can-t-I-use-Google-Maps-to-measure — licensing restriction
- User-supplied https://app.roofsnap.com/projects — **not observed**, login-gated

### RoofSnap — third-party

- https://roofingsoftwareguide.com/reviews/roofsnap-review — rural/new-construction, pitch rounding, no CRM/API
- https://contractortoolstack.com/software/roofsnap — no Xactimate/ESX claim, weak iOS
- https://apps.apple.com/us/app/roofsnap-roof-measurement-app/id869343232 — 3.3/5, 1–2 ft anecdote
- https://pitchbook.com/profiles/company/248425-57 — acquisition date (third-party)

### Open-source stack and data sources

- https://developers.google.com/maps/documentation/tile/policies — analysis/tracing prohibited
- https://developers.google.com/maps/documentation/solar/building-insights — per-segment pitch/azimuth/area
- https://developers.google.com/maps/documentation/solar/usage-and-billing — free cap and tiered pricing
- https://dataspace.copernicus.eu/data-collections/copernicus-sentinel-missions/sentinel-2 — 10/20/60 m bands
- https://dataspace.copernicus.eu/explore-data/data-collections/copernicus-contributing-missions/collections-description/COP-DEM — `<4 m` vertical accuracy
- https://documentation.dataspace.copernicus.eu/Quotas.html — free-tier quotas
- https://www.sentinel-hub.com/tou — attribution and commercial-use terms
- https://www.usgs.gov/centers/eros/science/usgs-eros-archive-aerial-photography-national-agriculture-imagery-program-naip — public domain, 0.6 m, 3-year
- https://www.usgs.gov/3d-elevation-program/new-product-3d-elevation-program-seamless-1-meter-digital-elevation-model-s1m
- https://science.nasa.gov/mission/landsat/data-overview, https://www.earthdata.nasa.gov/data/projects/hls, https://www.earthdata.nasa.gov/engage/open-data-services-software/earthdata-developer-portal/gibs-api
- https://openaerialmap.org/legal — CC BY 4.0
- https://github.com/microsoft/USBuildingFootprints — archived, metrics
- https://github.com/microsoft/GlobalMLBuildingFootprints — CDLA-Permissive, metrics
- https://sites.research.google/open-buildings/ and https://arxiv.org/abs/2107.12283 — no US coverage
- https://www.openstreetmap.org/copyright — ODbL
- https://operations.osmfoundation.org/policies/nominatim/ — 1 req/s
- https://wiki.openstreetmap.org/wiki/Overpass_API — usage limits
- https://help.mapillary.com/hc/en-us/articles/115001770409-CC-BY-SA-license-for-open-data
- https://kartaview.org/terms
- https://willcounty.gov/County-Offices/Administration/GIS-Division/Data — parcel restrictions
- https://github.com/TUMFTM/RID, https://doi.org/10.3390/rs14102299
- https://zenodo.org/records/14062580 — RID2 CC BY 4.0
- https://github.com/DimitrisMantas/RoofSense, https://doi.org/10.5194/isprs-annals-X-4-W6-2025-153-2025
- https://arxiv.org/html/2505.19358v1 — RoofNet, CC BY-NC
- https://arxiv.org/html/1903.12239v2, https://spacenet.ai — MVOI off-nadir F1
- https://szusic.github.io/Building3D/, https://github.com/szusic/Building3D — CC BY-NC-SA
- https://github.com/facebookresearch/sam2 — Apache 2.0
- https://github.com/idea-research/grounded-sam-2
- https://arxiv.org/html/2106.15268v1 — pitch inference MAE 5.5°
- https://arxiv.org/abs/2411.09411 — shadow-height estimation
- https://github.com/OSGeo/gdal, https://github.com/rasterio/rasterio, https://github.com/pyproj4/pyproj, https://github.com/shapely/shapely
- https://postgis.net/, https://github.com/qgis/QGIS, https://github.com/geoserver/geoserver
- https://github.com/Leaflet/Leaflet, https://openlayers.org/, https://github.com/maplibre/maplibre-gl-js
- https://pypi.org/project/reportlab/, https://pypi.org/project/openpyxl/, https://github.com/mozman/ezdxf
- https://github.com/temporalio/sdk-python, https://github.com/celery/celery, https://github.com/taskforcesh/bullmq
- https://research-information.bris.ac.uk/en/datasets/fabdem-v1-2/ — CC BY-NC-SA

### Local RoofOS source (read-only audit)

`/home/rlongmbox/projects/roof-os` @ `be5c63c014a1efa88e69970869677dfbdc5c75bd`: `docs/EXACT-WORKFLOW.md`, `GOLDEN-REPORT.md`, `ROOFOS-BUILD-CHECKLIST.md`, `UPDATE-CHECKPOINT-LAW.md`, `MIGRATION-ORDER.md`, `HANDOFF.md`, `CURRENT-STATE.md`, `RESEARCH-GIS-NOAA.md`, `NO-PAID-AI.md`, `app/measure/page.tsx`, `app/api/measurements/property/route.ts`, `app/api/measurements/aerial/route.ts`, `app/api/measurements/manual/route.ts`, `app/api/measurements/drone/route.ts`, `app/api/photo-estimate/report/route.ts`, `app/api/estimates/draft/route.ts`, `app/api/estimates/[id]/lockout/route.ts`, `app/api/team/sequence/route.ts`, `app/api/storms/nws/route.ts`, `lib/ai/geometry-contract.ts`, `lib/measurements/aerial-provider.ts`, `lib/measurements/footprint-preview.ts`, `lib/measurements/calibrated-roof-draft.ts`, `lib/measurements/purchasable-roofing.ts`, `lib/reports/golden-report.mjs`, `lib/estimates/verified-photo-workflow.mjs`, `lib/estimates/photo-approval.ts`, `lib/agent5/export.ts`, `components/ManualDrawingTool.tsx`, `components/GoldenReport.tsx`, `supabase/migrations/108_approval_lockout_sequences.sql`, and the `scripts/*-test.mjs` harnesses listed in §5.2.

### Existing sibling report

`docs/HOVER-PARITY-ROADMAP.md` — the Hover ground-photo photo-to-3D parity roadmap (809 lines, same worktree, uncommitted). This document complements it; the two share one measurement authority chain and one benchmark harness.

---

## Appendix B — Open questions for the owner

**Blocking the next implementation step:**

1. **G6 — address-first ordering?** Approve an amendment to `docs/EXACT-WORKFLOW.md` so a customer can order from an address alone, or keep the locked photo-first path with a skyview adapter? This changes the intake UX, the timing clock, and the report's provenance model.
2. **G1 — imagery provider.** Which licensed aerial source should the first paid adapter target (Nearmap/Planetary/EagleView-class)? This needs a per-address or per-report quote before Phase 1 can be costed. If no paid gate is approved, the program is explicitly capped at the free NAIP/OAM tier with Tier B confidence labels.
3. **Pricing tiering.** Approve a two-tier structure (~$13 perimeter-plus-pitch; ~$35–$55 full measurement) rather than a single $13 report? §11.3 shows a full report at $13 is margin-negative once licensed imagery and 15 minutes of QA are counted.
4. **Review staffing.** Who performs the human QA, and is there capacity for a p50 ≤2 h / p95 ≤4 h promise? This is the difference between a service and a tool.

**Non-blocking but useful:**

5. **Golden-set access.** Can RoofOS obtain 50 properties with field-verified truth (tape, RTK drone, or lidar), and who performs the field work? Without it, no accuracy claim can be made against either vendor.
6. **Provider roof planes.** Should Google Solar Building Insights be evaluated as a paid pitch/area source (paid API, ~$3.50–$10/1k requests) even though it is outside the free-first default?
7. **ESX/Xactimate.** Is Xactimate compatibility in scope for this parity program, given RoofOS's current exports explicitly set `esx_compatible: false` and `export_blocked: true`?
8. **Report split.** Keep Roofr + RoofSnap in one document (current) or split into two reports when either vendor's dashboard can be observed directly?
9. **Authenticated evidence.** If the owner can provide sanitized screenshots or PDFs of an actual Roofr queue/report and a RoofSnap project/report, the "not publicly documented" gaps in §2.3 and §3 can be closed with first-party artifacts.
10. **Multi-family scope.** Should multifamily and multi-building reports be in scope at all? Roofr excludes them from its delivery guarantee; RoofOS's approval sequence supports multi-unit estates but not an address-only multifamily order.

**Still open from the environment (not report-specific):**

- GBrain was locked by another `gbrain serve` (PID 12549) during this work package, so no memory was read or written.
- `.env.local` is still missing the Supabase URL and anon/publishable key, so `npm ci`, typecheck, and build remain unrun in the main checkout.
- Blender MCP has no running Blender instance; REA's full doctor reports unrelated stale Hermes registration drift. Neither affects this report.


## 13. Work-package skill audit ledger

Owner directive: review and record **every** upstream Superpowers skill at the start of each work package. Current upstream inventory re-verified 2026-11-23 from the installed package at `/home/rlongmbox/.cache/opencode/npm/git-superpowers-0958a5557860/1795412189399/node_modules/superpowers/skills` — 15 skills. Two RoofOS-local skills are also recorded. Status is `performed`, `blocked` (with exact limitation), or `not triggered` (with the verified trigger condition).

| Skill (source) | Reviewed | Applied action / evidence | Status | Blocker / next action |
|---|---|---|---|---|
| using-superpowers (upstream) | Yes | Skill check before any research; announced brainstorming, firecrawl-search, dispatching-parallel-agents, writing-plans, using-git-worktrees, verification-before-completion | performed | none |
| brainstorming (upstream) | Yes | Invoked before research; reconciled "same exact task" with the already-approved full-parity stance; recorded interpretation (one combined report) and invited correction | performed | Owner may still correct combined-vs-separate report choice |
| writing-plans (upstream) | Yes | Used for phase/task/gate structure and file/data-model decisions; no implementation plan committed yet | performed | After approval, produce `docs/superpowers/plans/...` |
| using-git-worktrees (upstream) | Yes | Step 0 detection: already in linked worktree at `/home/rlongmbox/projects/roof-os-hover-parity` on `docs/hover-parity-roadmap`; `GIT_DIR != GIT_COMMON`, no submodule. No second worktree created | performed | none |
| test-driven-development (upstream) | Yes | This work package writes no production code; TDD applies to each later implementation task with RED→GREEN evidence | not triggered | Trigger at implementation |
| systematic-debugging (upstream) | Yes | No bug or failing test under investigation; reserved for pipeline/benchmark failures | not triggered | Trigger on first failed benchmark/test |
| executing-plans (upstream) | Yes | No approved implementation plan or execution method exists; a report is not plan execution | not triggered | Owner chooses inline vs subagent after approval |
| subagent-driven-development (upstream) | Yes | Reviewed implementation/reviewer gates; research subagents were dispatched under dispatching-parallel-agents, not as implementers | not triggered | Trigger when plan approved |
| dispatching-parallel-agents (upstream) | Yes | Four independent research streams dispatched in parallel: Roofr workflow, RoofOS aerial audit, OSS aerial stack, RoofSnap. All four returned and are integrated into §2, §3, §5, and §6 respectively | performed | none |
| requesting-code-review (upstream) | Yes | No implementation diff to review; a reviewer should check this report against the approved dossier | not triggered | Request review after owner approval |
| receiving-code-review (upstream) | Yes | No review feedback received; will verify any feedback against source/tests before acting | not triggered | Trigger on feedback |
| verification-before-completion (upstream) | Yes | Baseline `node scripts/reliability-check.mjs` → 14/14 PASS, exit 0; no completion claim made until final file verification | performed | Final check before completion claim |
| finishing-a-development-branch (upstream) | Yes | Work is a draft in an existing worktree; no merge/PR requested | not triggered | Owner chooses integration after review |
| writing-skills (upstream) | Yes | No SKILL.md authored or edited; upstream reusable skill content unchanged | not triggered | none |
| diagnosing-superpowers (upstream) | Yes | No session-failure complaint under investigation | not triggered | none |
| reliability (RoofOS local) | Yes | Evidence-gating applied; source-tested vs production-verified distinction explicit throughout §5; no security change | performed | Hosted DB/provider verification remains separate |
| verification (RoofOS local) | Yes | Deterministic local check executed: 14 PASS, exit 0 | performed | Hosted-PostgreSQL path not run |

**Additional blockers recorded honestly:**

- **Firecrawl search:** skill invoked and reviewed, but `firecrawl search` consumes hosted/credited API calls. The owner directive requires free-first and explicit approval before paid/hosted services. No Firecrawl call was made; free `websearch`/`webfetch` were used instead. Status: `blocked` — needs owner approval if Firecrawl is required.
- **GBrain:** `gbrain_status` returned `unavailable / lock_held` (brain `/home/rlongmbox/.gbrain/brain.pglite` open in another `gbrain serve`, PID 12549). No memory reads or writes were possible; this report uses only the user's request, live web sources, and local source. Status: `blocked` — close the owning session or run one shared HTTP server.

**Rulings recorded:**

- `Ruling: Combine Roofr and RoofSnap into one comparison report rather than two separate documents — the owner's "same exact task" applied to a second URL, and a shared benchmark/architecture avoids duplicating the RoofOS gap and roadmap; cost is a longer single document.`
- `Ruling: Treat address-first ordering as an owner-amendment gate, not an implementation detail — preserves the locked EXACT-WORKFLOW authority chain; cost is that Roofr's sub-minute order flow cannot be matched under current doctrine.`
- `Ruling: Measure report precision at two layers (inch-level internal records, rounding policy per export) — mirrors Roofr's PDF-vs-dashboard behavior; cost is an extra presentation model.`
- `Ruling: Google raster tiles are excluded from the measurement path — both RoofSnap's own policy and Google's tile policy forbid tracing/analysis; enforced in the provider contract via locateOnly, not just in prose.`
- `Ruling: Pitch from free monocular imagery is a probabilistic suggestion, never authority — published research reports ~5.5° MAE and concludes pitch cannot be easily estimated from aerial imagery; field confirmation or a paid roof-plane source is required.`
- `Ruling: Two pricing tiers mirroring RoofSnap (perimeter-plus-pitch vs full measurement) — a full report at $13 is margin-negative once licensed imagery and 15 minutes of QA are counted.`
- `Ruling: Build the golden set before the pipeline — 50 properties with field-verified truth decide whether the accuracy target is reachable; building the pipeline first risks spending 600–1,400 hours on an unreachable target.`

---

## 14. Report status

**Draft for owner review — not an approved implementation plan.** No production code was written, no migration was created, no paid service was contacted, and no vendor spend was committed. The report is complete as a research and roadmap artifact; the next step is an owner decision on the gates in §10 and Appendix B, followed by a written implementation plan under `docs/superpowers/plans/` per the `writing-plans` checkpoint.

---

## Appendix A — Sources

*Pending.*

---

## Appendix B — Open questions for the owner

*Pending.*
