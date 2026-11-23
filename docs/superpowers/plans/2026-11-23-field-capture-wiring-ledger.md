# SDD ledger — plan: docs/superpowers/plans/2026-11-23-field-capture-wiring.md

Base commit: 44e7305cecfe3ea05f810bf5f7b8c9a8a7837ef4
Branch: feat/field-capture-wiring
Spec: docs/superpowers/specs/2026-11-23-field-capture-wiring-design.md (owner-approved)

## Pre-flight interface scan

- Task 1 → Task 3: local queue columns (`hover_slot`, `gps_verified`, `blur_score`, `light_score`, `superseded_*`) and `inspection_hover_anchors` consumed by mappers and `supersedeSlot`. Found: consistent names; Task 1 uses `gps_verified` while design text earlier said `gps_in_file` on the local row. Ruling: local column is `gps_verified` (stamping succeeded on device), server column is `scan_images.gps_in_file` (byte-verified); Task 3's `toScanImages` maps local → `gpsInFile` for field guidance only, and Task 5's server mapper overrides with byte-verified truth — what it costs if wrong: an unverified device flag could become metric-eligible server-side; prevented by Task 5's explicit `verifiedGpsInFile` argument and test.
- Task 2 → Task 3: `scorePixels` consumed by the WebView sampler. Found: consistent signature and `[0,1]` normalization; uniform grey yields blurScore 1, which reads as "sharp" for a zero-variance image. Ruling: follow the plan's literal expectation and document the normalization; a flat grey photo is also low-information but the merged contract's blur gate is about focus, not texture — what it costs if wrong: a flat grey image can pass focus scoring; light/anchor gates and human review remain.
- Task 3 → Task 5: `ScanImage`/`ScaleAnchor` shapes consumed by ingest helpers. Found: consistent; Task 3 fixes anchor `confidence: 1`, Task 5 keys idempotency on kind/value/unit. Ruling: fixed confidence plus idempotency key keeps manifest hashes reproducible — what it costs if wrong: retries duplicate anchors and change hashes; Task 5 test covers stability.
- Task 1 + Task 4 → Task 6: queue columns and migration-112 columns consumed by the upload upsert. Found: consistent three-column server set (`hover_slot`, `blur_score`, `light_score`); `gps_verified` stays local only. Ruling: no `gps_in_file` column in 112 and no client GPS key in the upload — what it costs if wrong: client claim bypasses byte verification; Task 5 test covers it.
- Task 5 → Task 6: ingest accepts `inspectionDraftId` and auto-creates the job. Found: consistent; the existing `jobId` path must remain unchanged. Ruling: add draft mode as a second POST branch, never remove the original — what it costs if wrong: existing ingest callers break; `npm run test:hover` is the regression gate.

## Owner directive: upstream skill inventory audit (15 skills)

Source: https://github.com/obra/superpowers/skills (catalog verified 2026-11-16 per project directive).
Status values: performed | blocked (exact limitation) | not triggered (condition absent).

1. `using-superpowers` | reviewed | current inventory loaded via skill tool; all relevant skills invoked | performed
2. `brainstorming` | reviewed | approaches A/B/C laid out, owner chose C, design doc written and owner-approved | performed
3. `writing-plans` | reviewed | 7-task file-specific plan with interfaces and TDD steps written | performed
4. `using-git-worktrees` | reviewed | branch `feat/field-capture-wiring` created off main from existing isolated checkout; plan workspace created via sdd-workspace; SD3 mounting not relevant to this host | performed
5. `test-driven-development` | reviewed | governing all tasks; RED→GREEN→REFACTOR with recorded command output | performed
6. `systematic-debugging` | reviewed | CI `mobile` TS5097/TS2345 failure root-caused (field tsconfig missing allowImportingTsExtensions; PhotoAlbum union missing 'model'), reproduced locally RED, fixed GREEN with regression guard | performed
7. `executing-plans` | reviewed | inline executor, ledger and per-task briefs in use | performed
8. `subagent-driven-development` | reviewed | builder-check subagent dispatched and returned 8 ranked questions; per-task implementer/reviewer dispatch superseded by inline executor per plan | performed
9. `dispatching-parallel-agents` | reviewed | tasks sequential by shared interfaces (pre-flight rows above) | not triggered
10. `requesting-code-review` | reviewed | whole-branch reviewer planned at final review; a fresh reviewer was already used at design stage | performed
11. `receiving-code-review` | reviewed | design-stage review feedback dispositioned into owner questions and design edits | performed
12. `verification-before-completion` | reviewed | task-done script re-runs named tests; final full suite before merge claim | performed
13. `finishing-a-development-branch` | reviewed | PR created after all gates green; required checks `web`, `mobile`, `migration-safety`, `field-security` awaited before squash-merge; local/remote SHA verified | performed
14. `writing-skills` | reviewed | no upstream SKILL.md content edited in this work package | not triggered
15. `diagnosing-superpowers` | reviewed | no prior-session failure to diagnose in this work package | not triggered

Source-of-truth reconciliation: owner-approved Hover dossier (`docs/superpowers/plans/2026-11-23-hover-dossier.md`),
`HOVER-PARITY-ROADMAP.md`, `HANDOFF.md` and merged main 44e7305 were checked before edits; this design
supplements, and does not replace, those requirements.

## Tasks
Task 1: complete (commits e7d66e9..46bf2d9, tests: bash -c 'node --experimental-strip-types scripts/field-hover-schema-test.mjs && npm run test:field-localdb-web' → field-localdb-web-test: PASS (retry reset, backoff-aware due count, photo count, AI cleanup, strict SQL))
Task 2: complete (commits 46bf2d9..83af8cc, tests: bash -c 'node --experimental-strip-types scripts/field-hover-quality-test.mjs && npm run typecheck' → npm notice run tsc --noEmit)
Task 3: complete (commits 83af8cc..6d8de7b, tests: bash -c 'node --experimental-strip-types scripts/field-hover-capture-test.mjs && npm run typecheck' → npm notice run tsc --noEmit)
Task 4: complete (commits 6d8de7b..c3e32d5, tests: bash -c 'node scripts/field-hover-migration-test.mjs && node scripts/release-foreman-check.mjs && node scripts/gate-registry-integrity-test.mjs' → gate-registry-integrity-test: PASS (no duplicate gate keys, derived foreman set, evidence-complete release decision))
Task 5: complete (commits c3e32d5..afa05a6, tests: bash -c 'node --experimental-strip-types scripts/field-hover-ingest-test.mjs && npm run typecheck && npm run test:hover' → hover-estimate-test: PASS)
Task 6: complete (commits 6f13992..3b04ad3, tests: bash -c 'node scripts/field-hover-upload-test.mjs && npm run typecheck' → npm notice run tsc --noEmit)
Task 7: complete (commits 3b04ad3..HEAD, tests: npm run test:all → PASS (166 registered gates + 4 build/release checks); npm run test:hover → 13/13 PASS; npm run typecheck → PASS; npm run build → BUILD_ID tCgxZ5kIDL1aylbZXU6QS; npm run release-check → PASS)
Evidence: `npm run test:all` EXIT=0 with 166 gates; build EXIT=0 (Next.js 16.4.6 Turbopack); release-check PASS (15 protected routes, 436 files scanned). Six new field-capture gates registered in package.json and wired into ci.yml web job; release-foreman-check / gate-registry-integrity-test / test-all-coverage-test all PASS.
CI `mobile` failure diagnosed and fixed: TS5097 (field tsconfig lacked allowImportingTsExtensions while App.tsx imports shared Hover .ts modules) and TS2345 (PhotoAlbum union missing 'model'); fixes in apps/field/tsconfig.json + apps/field/src/fieldCoach.ts with a guard in mobile-release-contract-test.mjs. Re-verified: field `npx tsc --noEmit` exit 0, field-coach-test PASS, hover 13/13, typecheck PASS, test:all 166 gates.
Hosted migration 112 application, device capture, staging parity, ground-truth benchmark, SLA evidence and independent reviewer run remain UNVERIFIED.
