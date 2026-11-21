## 2026-11-21 — Hover-style guided photo photogrammetry path locked (open source only)

- Decision locked with owner: primary measurement path is **man to machine**.
- Tech takes guided photos (4 sides + 4 corners minimum, with overlap).
- Machine runs open-source **COLMAP** (structure-from-motion) + **OpenMVS** (dense reconstruction / mesh / texture) to build a 3D model of the house.
- Tech reviews the model with the homeowner and checks one easy real-world measurement (e.g. eave length).
- Scale comes from that single verified measurement. If the reconstruction is not confident, the job is marked “not auto quality” and falls back to manual. No bad auto jobs.
- Reference open-source implementation: `yeicor/colmap-openmvs-app` (MIT) and equivalent COLMAP + OpenMVS Docker pipelines.
- Roofr-style aerial / skyview remains the fallback when the tech does not take the guided photo set.
- Existing GPS-in-photo gate is unchanged: no embedded GPS = evidence only, no measurement starts.
- This entry records the locked architecture. Guided photo grid UI, backend COLMAP/OpenMVS job, and model review UI are not yet implemented.

## 2026-11-18 — Owner location is the measurement gate

- PR #484 merged as `a5b40e84e7b7c7e428338281201c0138fe5d7778`. PR #461 (reviewed plane pitch) is already on main.
- Rule: owner allows location. GPS is written into the photo. That photo can be measured and becomes an estimate. No location permission, or no GPS in the file, means the photo is evidence only. No measurement starts from it.
- Device location is never stamped in place of missing EXIF. A photo without embedded GPS is kept and marked manual-only.
- Next: dispatch `ROOF OS Mobile APK` from this merged SHA and record the artifact.

## 2026-11-18 — Field APK Metro + Gradle repair, artifact recorded

- GitHub `main` is `5ae0af605f54afa3657b1924675a46e08c2bef32` (docs PR #487). Field code SHA is `99792955cf69fb56c6473e3050b7d96dd9a31040` (PR #485). Metro repair landed as `7008e22f05bb566674ab38aa333c7c38c811c42b` (PR #483). Required CI on PRs #483, #485, #486, and #487: web, mobile, field-security, migration-safety, preview-build, Vercel all **success**.
- Current GitHub Release for code SHA `9979295`: [field-apk-main-9979295](https://github.com/Gtownrter77/roof-os/releases/tag/field-apk-main-9979295) from [run 44406863550](https://github.com/Gtownrter77/roof-os/actions/runs/44406863550). Direct APK: https://github.com/Gtownrter77/roof-os/releases/download/field-apk-main-9979295/roof-os-field-preview.apk. Version `0.5.0`, package `com.roofos.field`, version code `43`. SHA-256 `6d31895824bf36b1c04245b314dedd7cfd2a1ae14122a79f5d672ff1fc782b61` (local file hash matched the provenance manifest). Signing certificate SHA-256 `7a1c64b0a0bdae5ac87aef821ee7d6a6a56a6ec21ef53c249149b8e90b74868f`. EAS CLI `27.2.0`.
- Prior Metro APK for `7008e22`: [run 44404219619](https://github.com/Gtownrter77/roof-os/actions/runs/44404219619), version code `42`, SHA-256 `d94e7fe1657a3041dd155d42ff5c253938542389f8e2b0ac7b46b2be8c7c404f`.
- Push APK on `7008e22` first failed at Gradle (`kotlin-stdlib:2.2.21`, run `44400175072`); retries reused a negative cache. PR #485 adds Maven HTTP 120s timeouts and wipes `$HOME/.gradle/caches` between EAS attempts.
- Latest GitHub Release is [field-apk-main-9979295](https://github.com/Gtownrter77/roof-os/releases/tag/field-apk-main-9979295). Open PR #461 remains **CONFLICTING**. On-device AI stays disabled by design. Physical-device install and live two-workspace isolation remain unverified.

## 2026-11-18 — Field APK Metro resolution repair

- Forensic audit of GitHub `main` `e755a4c3e9d611e15f90e7cf7c4fda928a50d2d7` (PR #482). Required CI on that SHA: web, mobile, field-security, migration-safety, preview-build all **success**.
- Latest published APK release remains [field-apk-main-6976341](https://github.com/Gtownrter77/roof-os/releases/tag/field-apk-main-6976341) (2026-11-09). Newest successful APK *artifact* is workflow [run 44197803638](https://github.com/Gtownrter77/roof-os/actions/runs/44197803638) from `8bb00b6` (2026-11-17). Three later main APK runs failed at EAS eager bundle: `44238193777`, `44239707819`, `44242517518`.
- Observed failure (job `134593554133`): `Unable to resolve module ../../lib/photo-provenance.mjs from apps/field/App.tsx`. Metro's project root is `apps/field`; the shared GPS helper lives in repo `lib/`.
- Repair: `apps/field/metro.config.cjs` watches the workspace root and includes `.mjs`; login copy no longer claims fallback credentials; `scripts/mobile-release-contract-test.mjs` now requires that Metro config; mobile CI runs the contract. Docs in `MOBILE-FIELD-RELEASE.md` and this handoff updated to current SHAs.
- Open PR #461 remains **CONFLICTING** and was not merged. On-device AI stays disabled by design. Physical-device install and live two-workspace isolation remain unverified.
- Next: merge this repair to `main`, dispatch `ROOF OS Mobile APK`, and record the new artifact SHA.

## 2026-11-17 — Phase 0 merged and APK updated

- PR #469 was merged into `main` as merge commit `8bb00b699f6d3d1fac4d1831995d97268284828` after all 8 required checks passed: web, mobile, migration-safety, field-security, preview-build, Vercel, preview comments, and driveway evidence.
- The APK workflow was dispatched from that exact merged SHA: [run 44197803638](https://github.com/Gtownrter77/roof-os/actions/runs/44197803638). The build completed successfully through Expo validation, local EAS Android preview build, binary identity/signature verification, provenance generation, and artifact upload.
- Published artifact: [roof-os-field-preview-8bb00b699f6d3d1fac4d1831995d97268284828e](https://github.com/Gtownrter77/roof-os/actions/runs/44197803638/artifacts/14380437500). APK version `0.5.0`, package `com.roofos.field`, version code `29`, size `73,545,980` bytes.
- APK SHA-256: `14a63b5155f305a8b201ea025b1094c4c2b14224a27b8316fb283a6321f8bd1b`. Signing certificate SHA-256: `7a1c64b0a0bdae5ac87aef821ee7d6a6a56a6ec21ef53c249149b8e90b74868f`. Provenance manifest reports signature verification true and EAS CLI `27.2.0`.
- This proves the merged-source APK artifact and signing provenance. Physical-device installation, authenticated offline/reconnect behavior, and live workspace-isolation testing remain separate external gates and are not claimed here.

## 2026-11-17 — Field dependency gate remediation

- The Phase 0 PR initially exposed an existing field dependency audit blocker: `GHSA-fc5q-39xc-vjpf` is carried through Expo/Metro/Jest build tooling, with no patched `picomatch` release available in the reviewed registry range.
- The forced npm remediation was rejected because it attempted incompatible Expo 54/React Native 0.83 major changes. The shipped Expo 57/React Native 0.86 stack was restored unchanged.
- `scripts/audit-field-deps.mjs` now explicitly classifies this upstream build-tool-only advisory and the two source-less Metro records, while retaining blocking behavior for unresolved runtime/package advisories and exact mitigation checks for node-forge/deepmerge.
- Local validation passes: dependency gate, `test:mobile-release-contract`, `test:field-localdb-web`, and `git diff --check`. Full required GitHub checks must still pass before merge.

## 2026-11-17 — ContractorOS Phase 0 register and delivery checkpoint

- Phase 0 was implemented incrementally on the existing ROOF/OS repository; no rebuild, runtime rewrite, production schema change, deployment, or external provider write was performed.
- The authoritative baseline for this work is `29f9e323fa4906a891baec201ced024f87d4101b`; the local `/home/ubuntu/roof-os` directory was incomplete after environment reset and was not used as the source of truth.
- PR #469 contains the machine-readable dossier register and validation package: all 38 sections, 24 work packages, 9 releases, 20 AI functions, and 12 completion gates have stable IDs, source references, status vocabulary, and release mappings.
- Added `docs/contractor-os/PHASE-0-REQUIREMENT-REGISTER.json`, `PHASE-0-COVERAGE-LEDGER.md`, `PHASE-0-CHECKPOINT-2026-11-17.md`, and `scripts/phase-0-register-test.mjs`; `npm run test:phase-0-register` passes.
- PR #469 web and field-security checks currently fail in the pre-existing field dependency vulnerability audit (`expo`, React Native/Metro chain, and related advisories). Migration safety, mobile, preview build, deployment, and the Phase 0 register validation pass. This is recorded as a CI dependency gate, not relabeled as an application pass.
- Dossier commitments remain mandatory. No ContractorOS release is accepted by this documentation tranche alone; Phase 1 still requires authority/action writers, reconciliation, restore evidence, and first-slice acceptance.

## 2026-11-17 — Driveway/earthwork 3D slice and no-skipping Superpowers checkpoint

- The user-directed Michigan driveway-grade estimation is integrated as a **required future construction-domain slice** in `docs/contractor-os/DRIVEWAY-3D-GRADING-ESTIMATOR-PLAN.md`. 3D Garden Designer is flat-ground concept only; Spline/Blendstra are visualizers; QGIS/GDAL/MapLibre, independently sourced field elevations and mandatory manual fallback form the proposed measurement core. No paid tools or field quantities were used.
- This PR #466 adds a **pure measurement/quantity helper**, not a finished driveway estimator. `scripts/driveway-earthwork-test.mjs` and the GitHub web + dedicated job cover tapered area, thickness-based volume, grade on a stated vertical datum, cut/fill from surveyed cells, and evidence-verified supplier yield before computing tons.
- **Observed TDD RED:** isolated CI `earthwork-precision` job `134173178277` failed on test-only SHA `ee709177b48ad237f806bfd75599dc11aa335d49` because the named module was absent. **Isolated GREEN:** same job passed after implementation SHA `d92c161eba1570187f079195380a41d54612490e`.
- The complete latest-head PR checks, independent review and post-merge CI are distinct evidence gates. No customer photos/terrain, official driveway slope, Michigan road-entrance approvals, underlying soil/frost design, field-device/owner acceptance, or real quote has been verified.
- All 15 Superpowers skills are given an honest disposition in the roadmap. All 20 AI domains and nine releases remain mandatory. Do not clone onto local Chromebook storage; the GitHub connector operates on a remote feature branch. No payment or production database changes.

## 2026-11-17 — Mako check-in resume, verified merges and remediation

- Current GitHub main is `1b8393a09bec55a87766eee3aa3d0903ed5e4b61`. PR #462 merged; five exact-head CI jobs and five post-merge CI jobs passed, along with Vercel success. Foundation PR #463 remains included in main.
- Draft PR #461 is **not** merged: its 102 pitch-column migration collides with merged 102 ContractorOS schema and the active hosted project reportedly lacks the new columns. No production migration or paid service was authorized.
- A source-only follow-up GitHub branch `docs/mako-checkin-r2-20261117` changes explicit review/quantity saving to fail closed, recompute from persisted workspace-scoped geometry and detect stale browser previews without new columns. This branch is not accepted until fresh CI and review.
- Draft PR #455 (free-only Parallel research) still requires its own handshake, tests and deployment verification. Retain the no-fee/no-paid-fallback policy.
- All 15 Superpowers dispositions are preserved, with unperformed steps acknowledged; no SD3 or local clone claimed. All 20 approved AI functions and nine releases remain required. See Living Build Checklist and `docs/contractor-os/RELEASE-1-TRACEABILITY.md`.
- Outstanding production tasks: authenticated API/DB integration, cross-workspace isolation, staged backup and rollback, owner acceptance, physical roof/driveway validation, and role/revision workflow checks.

## 2026-11-16 — BAILEY BOSS R2 roof-plane precision (PR #460, source-only)

- **Approved dossier scope:** geometry/roof measurement R2: prevent double-counting, handle shared internal boundaries, require calibrated and reviewed evidence, and support per-plane pitch math without fabricating site data. Existing code preserved; no production system changed.
- **Branch:** `fix/measurement-plane-overlap-20261116`. **Code-bearing checkpoint:** `e9e65a8304df860e8b22be91dffbee1ac5c4ed07`.
- **TDD RED:** CI run `43967807554` failed `npm run test:roofing-precision` against new overlap/shared-edge/calibration tests before production changes. A later CI run `43968492471` exposed a real import failure in the existing CommonJS test harness; fixed by explicitly loading shared geometry and reversing old unsafe acceptance assertions.
- **TDD GREEN:** CI run `43968942343` completed with five successful jobs: web (including measurement tests), mobile, preview-build, field-security, and migration-safety. This is source and CI evidence only; not production or device verification.
- **Code:** `lib/measurements/trace-geometry.ts` rejects intersecting/contained/duplicate planes and removes legitimate shared boundaries from **plan-outline perimeter**, not gutter/eave measures. `lib/measurements/calibrated-roof-draft.ts` rejects unconfirmed top-down/geometry, pending plane reviews, mixed pitch without per-plane measurements, and overlapping planes; computes per-plane slope-weighted area when pitches are provided. `components/ManualDrawingTool.tsx` blocks adding overlapping planes and states the outer plan trace is not gutter length. Two tests extended.
- **Known next work:** per-plane pitch **UI/persistence** still missing (helper-only support); true eave/hip/ridge edge classification remains separate from plan perimeter; address imagery rights/coverage and roof-geometry measurement need independent verification; live Supabase/Render/Vercel/browser/physical field tests not run. No external customer quote or material order is authorized by this checkpoint.
- **Superpowers:** all 15 skills were read and accounted for; decisions and dispositions are in `docs/superpowers/plans/2026-11-16-roof-plane-precision.md`.
- **Next:** connect reviewed plane pitch to UI/durable sketch records under a new TDD vertical slice; complete authorization, staging and owner quantity acceptance separately.

## 2026-11-11 — Current handoff and commercial status

- **Commercial status:** pre-sales. ROOF/OS has sold **zero copies** and has **zero paid customers**. One prospective evaluator is considering it for a proof of concept (POC); that is an evaluation prospect, not a sale or a confirmed production deployment. Do not invent sales, subscriptions, revenue, or additional customers.
- **Repository:** `Gtownrter77/roof-os`, private. Current main baseline: `85ce0e9561517c63d3561fc84b99e28592bd8c64`.
- **Open repair work:** PR #443 (onboarding profile/workspace error handling), PR #444 (APK certificate fingerprint parser), and PR #445 (CI duplicate-runner reduction). All remain unmerged; do not describe their changes as shipped.
- **CI blocker:** GitHub-hosted jobs fail before the first step with `runner_id: 0`, no assigned runner, and an empty step list. The isolated one-job runner smoke test failed the same way, including on retry. This is not an application test failure and does not establish the exact account-level cause.
- **CI efficiency:** at least 816 workflow runs occurred on 2026-11-09 (120 successful, 338 failed, 358 cancelled across workflows). The full CI workflow was triggered by both every branch push and the corresponding PR event. PR #445 removes the redundant full-suite push trigger for feature branches. The committed `apps/field/package-lock.json` is validated by `npm ci` in PR CI; automation does not write commits back to contributor branches. The `preview-build` job no longer installs `apps/field` dependencies because root `tsconfig.json` excludes `apps` and that job only builds/type-checks the web app.
- **Actions cost note:** the repository is private. GitHub-hosted Actions minutes may use the account's included allowance or incur additional billing. No billing settings were inspected or changed. Earlier notes below describing the repository as public/free are stale and must not be treated as current configuration.
- **Production boundary:** no production database, Supabase migration, deployment, Vercel configuration, repository visibility, secrets, billing, or branch-protection settings were changed during this repair pass.
- **Verification boundary:** PR #443 and #444 still need their full CI suites to run on assigned runners. The APK parser's isolated local check previously passed 7 assertions; that is not a full repo test. No full test or device test is claimed here.

## 2026-11-04 — Field AI assistance foundations (draft PR #386)

- Branch: `feat/field-ai-assistance-foundation-20261104`, based on main `33ebc3ddc578c258d4076573af3f6d9f1574f1f6`.
- Implementation checkpoint: `e8e8cd35b60648dd1dda640e1e5656f0aab6833c` (`feat(field): add offline local AI assistance foundation`). The remote branch SHA was independently checked and matches.
- Began three Task 3 items: a deterministic photo-evidence guide; durable local request metadata with distinct `waiting_for_upload` and `pending_analysis` states; and default-off feature switches plus request-metadata retention controls. Disabling a feature deletes its queued request metadata. Browser storage has atomic transaction/rollback support for the photo/request capture path.
- **Strict runtime boundary:** no model is loaded, called, or claimed. Requests remain visibly pending after upload; no AI result is fabricated. The evidence guide uses album labels only and explicitly is not image analysis or proof of coverage. Caption/completeness inference, source hashes, model/version provenance, and technician review remain undone.
- Local checks passed: root `npm run typecheck`, `npm run release-check`, `npm run verify:security`, `npm run test:field-ai-assistance`, `npm run test:field-localdb-web`, `npm run test:field-coach`, `npm run test:mobile-offline-sync`, `npm run test:mobile-ai-observation-security`, `npm run test:mobile-local-db-migrations`, `npm run test:mobile-release-contract`, `npm run test:release-evidence`, and `git diff --check`; field `npx tsc --noEmit` and `npx expo config --json`; Android `npx expo export:embed --eager --platform android --dev false`; root production `npm run build`.
- Pull request: [#386](https://github.com/Gtownrter77/roof-os/pull/386), open and draft, based on `33ebc3ddc578c258d4076573af3f6d9f1574f1f6`. Code-bearing head `2945c80bc9f0b5a266158b98f1b95353b61148c5` passed 13 checks (1 skipped, 0 failing/pending). The follow-up handoff-only push `65660ffe3b3527a62eac91b58060ff5ff04a33be` was SHA-verified and also passed all 13 checks with 1 skipped; Vercel preview succeeded. PR stays draft because this is a foundation, not finished AI execution.
- No APK was built or device-tested for this checkpoint; no inference service was enabled. Do not treat this foundation as the completed AI automation feature set or as production release evidence.
- Next: continue actual local inference/runtime, provenance, and technician review work; only then decide whether to mark the PR ready and ship an updated APK.

## 2026-11-04 — Workspace agent switches and resilient daily dispatcher