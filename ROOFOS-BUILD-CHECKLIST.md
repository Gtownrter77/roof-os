# ROOF/OS Living Build Checklist

## 2026-11-18 — Technician-first measurement review, PR #476 replacement

- [✓] Show the AI-produced roof-geometry packet immediately in a simple technician review panel: suggested planes, edges, objects, pending review and human-reviewed pitches. Merged as `e755a4c` (#482); panel at `app/measure/page.tsx:637-654`, asserted in `scripts/roof-measurement-precision-test.mjs`.
- [✓] Keep slope area and roofing squares **unavailable until geometry, scale, orthographic top-down assumption and measured pitch are confirmed**; no hidden AI claim becomes an estimate-ready quantity. Gate at `app/measure/page.tsx:455-470`; `test:roofing-precision` and `test:auto-measurement` pass at main head `764976f`.
- [✓] Primary action moves the technician into the existing human geometry review queue, not automatic approval. Button at `app/measure/page.tsx:650-652` scrolls to `id="roof-geometry-review"`.
- [✓] Regression checks for safe summary wording, manual fallback and quantity gates pass locally on 2026-11-22 (`test:roofing-precision`, `test:auto-measurement`, `test:measurement-estimate-authority`, `release-check`, `npm run typecheck`; all exit 0) and in exact-head CI [run `44984769341`](https://github.com/Gtownrter77/roof-os/actions/runs/44984769341) on `764976f` (web, mobile, field-security, migration-safety, preview-build all success).
- [!] Deployment and physical field validation remain separate evidence. Repository tests and green CI do not certify hosted Supabase, Vercel release behavior, roof geometry, imagery, or field acceptance.
- [!] This presentation change does not deliver automated geometry on Android without a configured local vision provider, certified roof dimensions, or priced estimates.

## 2026-11-18 — PR #477 conflict-safe replacement: embedded EXIF to skyview to draft estimate

- [✓] Replace PR #477's browser current-location shortcut with coordinates decoded from the **selected photo's embedded EXIF**. Without embedded coordinates, stay manual-only; address-first manual lookup remains available. Merged as `eb9ad85` (#481); `test:photo-skyview-handoff` asserts `if (!file || !photoGps)` blocks lookup.
- [✓] Owner-authorized automatic measurements remain a separate server-enforced setting and are **not** granted by a photo map preview. Migration `105_photo_gps_automation_authority.sql` defaults `enable_auto_photo_measurements` to false and restricts enablement to `role = 'owner'`; `test:photo-gps-automation` passes.
- [✓] Reverse lookup produces a **candidate** property address; do not automatically select a neighboring building or certify roof geometry. Asserted by `test:photo-skyview-handoff` (`candidateOnly: true`, `setSelectedBuildingIndex(null)`).
- [✓] Saved human-reviewed geometry can be passed to the estimate wizard only by actual persisted measurement UUID, validated in the current workspace. Human confirms property match. Unverified quantities remain an unpriced reference, not line items or approval. Asserted by `test:photo-skyview-handoff` (`measurementId: savedMeasurementId`, valid UUID, `.eq('workspace_id', workspaceId)`, draft status) and `test:photo-estimate-flow`.
- [✓] Regression tests pass locally 2026-11-22 (`test:photo-skyview-handoff`, `test:photo-gps-automation`, `test:photo-location`, `test:photo-estimate-flow`, `test:measurement-estimate-authority`) and on exact-head main CI run `44984769341`; merge confirmed at `eb9ad85`. [!] Deployment and user-device acceptance remain unverified until observed.
- [!] Full automated roof measurements and priced reports still require actual scaled aerial geometry, independent pitch and source confirmation, and price-book review.

## 2026-11-17 — Field-photo data integrity and Photo-to-Report retry hardening (pending PR)

- [✓] Preserve new technician camera photos inside durable app document storage before queuing them offline; never rely on temporary ImagePicker cache files. Merged as `c65afc7` (#480); `test:photo-gps-automation` asserts `Paths.document` and `asset.uri.copy(retained)` in `apps/field/App.tsx`.
- [✓] Failed server GPS verification and Photo-to-Report creation retain the original image in the retry queue rather than being silently marked synced or losing AI requests. Asserted by `test:photo-gps-automation` and `test:mobile-offline-sync` (both pass locally and in exact-head CI).
- [✓] Roof, siding, photo-estimate, and Photo-to-Report routes verify that current private photo bytes still match the server-certified EXIF GPS coordinates, embedded address, and SHA-256 digest. `test:photo-gps-automation` requires `isCertifiedPhotoContent(...)` in all four routes; passes.
- [✓] Add migration 106 for server-role-only atomic, idempotent Photo-to-Report packet creation. A new packet is always review-gated; no roof area, damage, or price is invented. `supabase/migrations/106_photo_to_report_atomic_packet.sql` is in main (`c65afc7`); source assertions pass and migration-safety CI succeeded at head `764976f`.
- [!] Real Supabase migration application, Render deployment, and real Expo Android capture/upload remain unverified. Do not mark operational from source tests and CI alone.

## 2026-11-17 — Photo-to-Report embedded GPS / owner permission (PR #478)

- [✓] Native field camera captures high-accuracy GPS, stamps JPEG EXIF GPS and embedded candidate property address, and retains offline queue; unverifiable photos remain manual-only. Merged as `f948f0d` (#478); `test:photo-gps-automation` verifies EXIF roundtrip, rejection of invalid coordinates and manual-only fallback.
- [✓] Server reads original private photo bytes, certifies GPS with a service-role-only provenance update, and fails closed if data is absent, permission denied or verification unavailable. Asserted by `test:photo-gps-automation` (`app/api/photo-provenance/verify/route.ts`, `service_role`, uploader check); passes.
- [✓] Web/field photo uploads preserve untagged manual evidence, and photo AI routes plus inspection-quality automation reject unverified GPS evidence. Asserted by `test:photo-gps-automation` (`gps_verified !== true`, `gps_verified === true` worker filter) and `test:aerial`.
- [✓] Automatic photo measurements are OFF by default and workspace-owner-only in settings/API/database; owner-activated GPS photos create idempotent, review-gated Photo-to-Report property packets. Migration `105` and `106` source assertions pass; production endpoint cutover merged as `d4c25a8` (#479).
- [✓] EXIF coordinate roundtrip, manual-only prohibition and owner enforcement are in CI: exact-head main run `44984769341` passed all five required jobs on `764976f`; merge confirmed at `f948f0d`/`d4c25a8`. [!] Hosted application of migrations 105/106 and device behavior remain unverified.
- [!] This feature starts the property review packet, not an automatically certified roof measurement or priced customer report. Property/building identity, licensed aerial imagery and roof scale/pitch, field evidence, host migration/deployment, actual iOS/Android APK camera behavior and all production signoffs remain unverified. Never invent missing values.


## 2026-11-15 — Parallel anonymous/free-only public research

- [✓] Add separate authenticated BAILEY /research page and /api/research/parallel public-source lookup. Merged as `29f9e32` (#455); `app/research/page.tsx` and `app/api/research/parallel/route.ts` are on main.
- [✓] Restrict network endpoint to anonymous Parallel MCP web_search with no billing key, sign-in, API fallback, or other providers replaced. `scripts/parallel-anonymous-test.mjs` contract passed locally 2026-11-22 and in dedicated free-only CI.
- [✓] Mock MCP handshake and response tests with no paid calls; GitHub PR check passed: [run `44124068318`](https://github.com/Gtownrter77/roof-os/actions/runs/44124068318) on PR #455 head `2209a852a` (`free-only-contract` success, including the public-source live smoke).
- [!] Live BAILEY production network test, source-quality comparison and hosted deployment require evidence.
- [—] Parallel authenticated web_research and paid API: explicitly outside owner-approved $0 scope.

See docs/PARALLEL-FREE-RESEARCH.md; source creation and CI smoke are not production verification.


Markers: [ ] pending, [~] in progress, [✓] verified, [!] blocked, [—] out of scope.

## 2026-11-17 — Driveway grade + 3D estimation: TDD math slice (PR #466)

- [✓] Added `docs/contractor-os/DRIVEWAY-3D-GRADING-ESTIMATOR-PLAN.md` reviewing actual 3D plugin tool limits, GIS/data licensing, grade/tonnage assumptions, address-first/manual workflow, field/permit and Supabase release gates. All 20 AI functions and nine releases remain mandatory.
- [✓] **Observed test-first RED:** dedicated CI job `134173178277` on test-only PR head `ee709177b48ad237f806bfd75599dc11aa335d49` failed `ERR_MODULE_NOT_FOUND` for new earthwork module, as intended before code.
- [✓] **Isolated GREEN:** after adding `lib/measurements/driveway-earthwork.ts` at commit `d92c161eba1570187f079195380a41d54612490e`, the dedicated `earthwork-precision` job succeeded. Synthetic unit assertions cover tapered area, depth-to-cubic-yards conversion, benchmark-referenced grade, cut/fill survey cells, incompatible density basis, absent supplier yield, and 150-ton-per-yd³ unit-safety rejection.
- [✓] Full latest-head PR check and post-merge verification observed: PR #466 merged as `9b97ffe`; `test:driveway-earthwork` passes locally and in exact-head main CI run `44984769341`. This is repository evidence, not a production release.
- [!] **Not implemented or field-approved:** actual Michigan property terrain/scale measurement, lidar rights/accuracy, legal imagery, address-first driveway UI, supplier prices, road/drainage permits, geotechnical/utility checks, mobile grade sync, 3D rendering, real site quantities, owner-approved customer bid. No quantity, price or permit was guessed.
- [ ] Follow-on retaining wall/landscaping/cabinet domains reuse verified geometry and CAD tools but remain planned work; never silently fabricate a load-bearing design.
- [✓] Separately confirmed PR #465 merged as `e2740b4a7d1ab6319d4c07edd408ffaa1e74a7cd`; the five main CI jobs and Vercel succeeded. This is measurement software evidence, not site measurement accuracy.
- [!] Active Supabase Roof OS read-only verification: human review columns and ContractorOS control-plane tables have not been applied; PR #461 merged in source as `9708aff` with renumbered migration `107_reviewed_plane_pitch.sql`, but do not deploy it to production without staging, backup, schema/RLS checks, and owner authorization.
- [✓] PR #455 merged as `29f9e32`; isolated anonymous MCP smoke and mocked contract passed with no API key in [run `44124068318`](https://github.com/Gtownrter77/roof-os/actions/runs/44124068318). [!] Real BAILEY app-host and source-quality pilot remain unverified, no paid API fallback.

## 2026-11-17 — Mako Check-In: verified R2 merge + hardening in progress

- [✓] PR #462 merged into main at `1b8393a09bec55a87766eee3aa3d0903ed5e4b61`. All five exact-head CI jobs, Vercel, preview-feedback check, and five post-merge main CI jobs succeeded. This is repository evidence, **not** field acceptance.
- [✓] Reviewed per-plane pitch entry, saved `reviewed:<rise>/12` provenance, cached pitch restoration, and provisional mixed-pitch draft save are present in merged source. The helper-only notation in the older PR #460 checkpoint below is historical and superseded by #462 at source level.
- [✓] ContractorOS controlled foundation PR #463 merged as `68fc020e733cf504c10473997201b859f2b8221f`; migration `102_contractor_os_control_plane.sql` is in main, **not** confirmed applied to hosted Supabase.
- [✓] This follow-up adds explicit top-down/pitch attestation, saves review metadata in existing `aerial_measurements.ai_formulation.human_geometry_review`, recomputes draft quantities server-side from persisted workspace-scoped polygons and reviewed pitch markers, and rejects stale client previews. Merged as `9708aff` (#461) with migration `107_reviewed_plane_pitch.sql`; `test:roofing-precision`, `test:auto-measurement` and exact-head CI pass. [!] Runtime authentication/RLS and independent review remain separate gates.
- [✓] PR #461 version conflict resolved: it merged as `9708aff` with renumbered migration `107_reviewed_plane_pitch.sql` (not the conflicting `102`), and migration-safety CI passed at main head `764976f`. [!] Backup, staging, RLS and target-schema application still require hosted evidence before deployment.
- [✓] PR #455 (free-only anonymous Parallel research) merged as `29f9e32`; dedicated free-only check `44124068318` passed with no paid API fallback. [!] Deployment-host connectivity and source-quality pilot remain separate gates.
- [✓] Superpowers ledger records all 15 skills reviewed at upstream commit `22f0b46` in `HANDOFF.md`, with performed/blocked/not-triggered status and evidence. It preserves the unperformed subagent, independent-review, SD3 worktree and field-verification boundaries. The approved 20 AI functions and nine releases remain mandatory, not implicitly completed.
- [!] Production field accuracy, authenticated read/write/reload, inter-workspace isolation, owner approval, UI/mobile-device checks, backup/rollback, address-first aerial coverage, and driveway/grade estimating remain separate release gates.

## 2026-11-16 — Dossier R2 roof-plane precision (PR #460)

- [✓] Test-first overlap/shared-edge/calibration regressions: observed RED in PR CI `43967807554` before implementation, then corrected and verified with full five-job green PR CI `43968942343` on source SHA `e9e65a8304df860e8b22be91dffbee1ac5c4ed07`.
- [✓] Reject cross-plane overlaps, containment and duplicate outlines in the manual trace and calibrated draft paths; prevent double-counted plan area.
- [✓] Exclude valid shared internal boundaries from summed plan-outline perimeter. This number is **not** inferred eave, gutter, ridge, hip or valley footage.
- [✓] Require reviewed geometry, top-down confirmation and explicit pitch confirmation before draft quantities; mixed pitch must supply each plane's measured pitch to the calculation helper.
- [✓] Manual drawing refuses an overlapping newly finished plane; supported geometry/area/perimeter tests run in PR CI.
- [✓] Link per-plane pitch editing, evidence, approvals and persistence through the measurement UI and versioned record. Follow-up merged as `1b8393a` (#462) and `9708aff` (#461); mode is no longer calculation-helper-only. `test:roofing-precision` and exact-head CI pass.
- [!] Verify real address-first imagery coverage, scale and legal attribution, classification of all roof edges, actual site pitch and owner-rule estimate integration; do not require photo where real aerial can be obtained and do not invent imagery. Still blocked by provider/field/owner evidence.
- [!] Customer/field operational approval remains blocked by production-auth, full staging/restore, provider, device and owner acceptance gates. GitHub CI is not field certification.

## 2026-10-29 — Storm theme collection

- [✓] Six theme choices: Professional, Tornado Alley, Storm Tracker 11, Hail Core, Lightning Front, After the Storm.
- [✓] Global theme preference: page roots, shell, navigation and panels use the selected scene and palette. Login initializes Storm Tracker 11 only when no explicit preference exists.
- [✓] Existing Professional/Storm quick toggle remembers the chosen storm. Preferences are device/browser-local, not account synchronization.
- [✓] Original detailed imagery; Atlanta skyline command-center plate; balanced darker exposure; CSS 3D pointer parallax, camera moves, lighting, radar sweep, hail effects.
- [✓] Preview without applying, Escape/skip and focus return; session intro, motion preferences, OS reduced motion, low-power mode.
- [✓] Opt-in local storm ambience, mute, stop on hidden tab/unmount; no paid sound service.
- [✓] Real 36-second 1280×720 H.264/AAC trailer, generated storm sound, native playback controls, pause on hidden tab.
- [✓] Runtime preference tests and browser tests: six themes, saved choice, cross-tab, denied storage, mobile layout, audio, video, preview focus.
- [✓] Existing auth, radar, dashboard weather, settings, security, release, reliability and production gate checks pass locally.
- [✓] Implementation PR #370 merged as `4623a3e549504122144d8e61cc3afa800c41719e`; PR CI `40823969333` and post-merge main CI `40824724249` passed.
- [✓] Both reviews completed; the hidden-tab issue was fixed before merge. The later corrupted-preference suggestion is addressed with parser/prepaint regressions and a validated saved-choice helper.

Verification snapshots name the tested implementation SHA. Follow-up preference-recovery changes must also pass their attached GitHub CI before merge.
- [!] Runway authentication verified: connected Free workspace exposes no video models. Actual actor/video generation requires a paid plan. No purchase or generation credits used.
- [—] Rigged 3D actor/lip-sync or full fluid/cloth/weather simulation: not produced by still artwork and camera effects.

Source/UI evidence is separate from authenticated production workflows, Supabase, field-device and provider execution. This checkpoint does not change the existing release NO-GO decision.

## 2026-11-01 — PR #374 merge remediation

- [✓] Preserve pre-fix head `a1ea24d` at `backup/pr374-before-audit-fix-a1ea24d`.
- [✓] Reproduce field audit failure, replace vulnerable glob/minimatch with exact upstream patches `14.0.2`/`11.0.1`, regenerate the lockfile, clean-install and pass the existing audit. Existing pinned build-only zod risk acceptance is unchanged; this is not a zero-vulnerability claim.
- [✓] Run roof-slope and estimate-creation tests and require both in the web CI job.
- [✓] Exercise the real estimate POST handler with a synthetic Supabase boundary: reject malformed items before writes, preserve draft defaults and totals, and attempt cleanup on line-write failure. Regression tests exposed and now prevent non-string item-code crashes and overflowing numeric totals.
- [✓] Regenerate the web lockfile with patched follow-redirects/qs and selector-parser, preserving platform selectors. The production audit no longer reports its former high/moderate findings.
- [✓] Correct stale navigation assertions after template-first creation replaced inline creation; continue requiring detail, edit, and new-estimate destinations.
- [✓] Final repair commit `85c064f` passed PR checks; PR #374 merged as `b74d234`, and post-merge main CI passes at head `764976f` (run `44984769341`, five required jobs green).

Local handler/source checks do not verify Supabase Auth/Storage or deployed database policies. Hosted migration-safety uses disposable PostgreSQL only. Preview readiness does not prove authenticated production workflows. No production database, authorization, or approval controls are relaxed by this repair.
