# Weak-link remediation ledger — 2026-11-22

**Work package:** find the 10 weakest links, fix them, repeat until 100 fixes are complete.
**Branch/worktree:** `weak-links` at `/tmp/opencode/roof-os-weak-links` (git worktree fallback; native `worktree_create` failed).
**Baseline:** `276c6d5` (contains prior docs commit `docs: record technician review verification evidence and superpowers ledger`).
**Upstream catalog:** `github.com/obra/superpowers` commit `22f0b463e7a5e579904dd6211a520321035526f7` (15/15 SKILL.md files re-read at start of this work package).

## Evidence boundary (reliability + verification skills)

- **Source-tested:** deterministic local scripts, typecheck, release checks, CI source jobs. Every claim below records command + exit code.
- **Database-tested:** only GitHub-hosted disposable PostgreSQL (`migration-safety`) counts. No local/hosted DB claim is made here.
- **Unverified:** hosted Supabase RLS/application, deployed SHA, provider execution, physical device, two-workspace live isolation, backup/restore.
- God Mode stays **disabled**; loading its skill does not activate it. RLS/API auth are never disabled to make a test pass.
- No applied migration is edited; any DB change requires a new numbered migration.

## Dossier reconciliation limitation

`AGENTS.md` names `ContractorOS_Unified_Master_Dossier.pdf` as source of truth. The repository contains `masterplaybook-GoogleDocs.pdf`, but this model cannot read PDF input, and the environment has no `pdftotext`, `pip`, or PDF Python library. Direct dossier-text reconciliation is therefore **BLOCKED**. Reconciliation was performed against `ROOFOS-BUILD-CHECKLIST.md`, `HANDOFF.md`, `CURRENT-STATE.md`, `UPDATE-CHECKPOINT-LAW.md`, `README.md`, and actual `main` source instead. No approved requirement is being replaced.

## 15-skill mandatory ledger

| # | Upstream skill | Status | Evidence / limitation |
|---|---|---|---|
| 1 | `using-superpowers` | PERFORMED | Re-cloned upstream at `22f0b46`, enumerated 15 skills, re-read every SKILL.md, invoked `ponytail-audit`, `reliability`, `verification`, `god-mode` (inspection only; not activated). |
| 2 | `brainstorming` | PERFORMED (with blocker) | Scope reconciled with explicit user instruction (10×10 fixes) and approved docs/checklist; no new product design. PDF dossier text extraction BLOCKED as recorded above. |
| 3 | `writing-plans` | PERFORMED | This ledger defines 10 batches of 10 findings, each with test-first gate, verification command, and checkpoint cadence. |
| 4 | `using-git-worktrees` | PERFORMED (fallback) | Native `worktree_create` failed; git fallback created `/tmp/opencode/roof-os-weak-links` on branch `weak-links`. SD3/Chromebook mounting not applicable in this environment. |
| 5 | `test-driven-development` | PERFORMED (baseline); per-fix in batches | Baseline `npm run test:all` PASS (exit 0) before edits. Behavior changes get a failing assertion first; pure doc/config changes record why no RED phase exists. |
| 6 | `systematic-debugging` | PERFORMED | Root-cause investigation required before each fix; baseline failures were checked first (none in `test:all`). |
| 7 | `executing-plans` | PERFORMED | Inline execution batch by batch with this ledger as memory. |
| 8 | `subagent-driven-development` | PERFORMED (audit phase) | Six real read-only audit subagents dispatched via supported `subagent` tool; per-task implementer/reviewer gates applied during fix batches. |
| 9 | `dispatching-parallel-agents` | PERFORMED | Six independent audit domains dispatched concurrently: security, core logic, frontend, data layer, tests/CI/docs, mobile/field. |
| 10 | `requesting-code-review` | PENDING | Evidence-based reviewer dispatch after each completed batch; acceptance criteria = fresh tests + no new auth/RLS weakening. |
| 11 | `receiving-code-review` | PENDING | Actual reviewer feedback to be verified against code/tests and disposition recorded. |
| 12 | `verification-before-completion` | PERFORMED (baseline); per-batch | Fresh `npm run test:all`, `npm run typecheck`, `npm run test:reliability`, targeted contract tests before any batch is marked complete. |
| 13 | `finishing-a-development-branch` | PENDING | Checkpoint law: commit + push every 3 verified batches, compare local SHA with `git ls-remote`, update `HANDOFF.md`. |
| 14 | `writing-skills` | NOT TRIGGERED | No upstream or local reusable `SKILL.md` content is authored/edited in this work package. |
| 15 | `diagnosing-superpowers` | NOT TRIGGERED | No prior-session skill failure is under investigation here; no transcript diagnosis claimed. |

## Baseline verification evidence

- `npm run test:all` → `TEST_ALL_EXIT:0`, final line `[test-all] PASS` (2026-11-22).
- `npm run test:reliability` → `REL_EXIT:0`, `PASS (14 checks)` (2026-11-22).
- `npm audit --omit=dev --audit-level=moderate` → `found 0 vulnerabilities`, exit 0.
- Repository surface: 94 API routes, 126 test scripts, 107 migrations, 90 pages, 39 components.

## Batch plan

| Batch | Findings | Status | Checks | Commit/checkpoint |
|---|---|---|---|---|
| 1 | 1–10 | COMPLETE (source-tested) | `test:all` exit 0, `typecheck` exit 0, `test:release-foreman` exit 0, `diff --check` exit 0 | no push yet; checkpoint at batch 3 |
| 2 | 11–20 | COMPLETE (source-tested) | 10 targeted gates exit 0; `test:all` exit 0; `typecheck` exit 0; `test:reliability` exit 0; `diff --check` exit 0 | no push yet; checkpoint at batch 3 |
| 3 | 21–30 | COMPLETE (source-tested) | `test:all` exit 0; `typecheck` exit 0; 12 targeted gates exit 0; `test:reliability` exit 0; `test:release-foreman` exit 0; `diff --check` exit 0 | committed locally; push BLOCKED (no GitHub credentials, exit 128) |
| 4 | 31–40 | Pending | — | — |
| 5 | 41–50 | Pending | — | — |
| 6 | 51–60 | Pending | — | checkpoint after verification |
| 7 | 61–70 | Pending | — | — |
| 8 | 71–80 | Pending | — | — |
| 9 | 81–90 | Pending | — | checkpoint after verification |
| 10 | 91–100 | Pending | — | final handoff checkpoint + HANDOFF update |

## Finding register

Filled as audit subagents return. Columns: ID, severity, file:line, defect, fix, test, status.

| ID | Severity | Location | Defect | Fix | Verification | Status |
|---|---|---|---|---|---|---|
| 1 | HIGH | `scripts/mobile-release-check.mjs:12` | Hardcoded `client_version: 'field-0.4.0'` while `apps/field/app.json` is `0.5.0`; gate failed and was unregistered | Derive marker from `expoApp.expo.version` | RED exit 1 observed before fix; GREEN exit 0 after | FIXED |
| 2 | HIGH | `package.json:137` | 7 deterministic gates existed but had no npm script (`ai-chat-auth`, `estimate-creation-runtime`, `estimate-navigation`, `mobile-release`, `parallel-anonymous`, `release-foreman`, `worker-heartbeat-runtime`) | Added 7 `test:*` scripts | all 7 scripts exit 0 | FIXED |
| 3 | HIGH | `.github/workflows/ci.yml:59` | Auth-before-inference, real estimate POST handler, navigation and mobile-version gates ran in no workflow | Added 4 steps to required `web` job | `test:release-foreman` PASS; full suite PASS | FIXED (source only; CI not yet observed) |
| 4 | HIGH | `README.md:3` | Advertised main `5ae0af6`, 11 commits stale | Verified `origin/main` = `764976f…` via `git ls-remote`; updated with run `44984769341` and migration head `109` | `git ls-remote` output recorded | FIXED |
| 5 | MEDIUM | `README.md:173` | Claimed PR #72 open/unmerged though `6d46a4a` is an ancestor | Replaced with merged historical note | `git merge-base --is-ancestor 6d46a4a HEAD` → ANCESTOR | FIXED |
| 6 | MEDIUM | `CURRENT-STATE.md:1,5,24` | Three mutually exclusive "current main" baselines | Kept `764976f` authoritative; demoted 2026-10-26, 2026-10-09 and 2026-11-08 claims to historical | `git log`/`ls-remote` cross-check | FIXED |
| 7 | MEDIUM | `HANDOFF.md:48,56` | Said PR #461 conflicting/unmerged while merge `9708aff` is in main | Replaced with merge SHA + migration `107` note | `git merge-base --is-ancestor` | FIXED |
| 8 | MEDIUM | `HANDOFF.md:115,120` | Said PRs #443/#444/#445 unmerged though all are ancestors | Recorded `8763aa0`/`a9aadf7`/`b7ae96e` and removed stale verification warning | `git merge-base --is-ancestor` ×3 → ANCESTOR | FIXED |
| 9 | MEDIUM | `DEPLOYMENT.md:3` | Claimed 2026-10-26 main/production parity at migrations 053–056 while source head is 109 | Relabelled historical and added explicit unverified boundary | `ls supabase/migrations` tail → `109_foreman_sos.sql` | FIXED |
| 10 | MEDIUM | `.github/workflows/field-apk-pixel8.yml:5-10` | Push triggers pinned to two one-off branches, one deleted; workflow could never run from main | Removed dead push block; explicit `workflow_dispatch` only | `test:release-foreman` PASS (no YAML parser available locally; CI will parse) | FIXED (source only) |

| 11 | CRITICAL | `supabase/migrations/109_foreman_sos.sql:12` | SOS hold has SELECT-only policy and no release RPC while the trigger blocks all job resumption — permanent deadlock | Added forward-only `110_release_job_safety_hold.sql`: admin-only SECURITY DEFINER RPC, closed search_path, timestamp/actor update, least-privilege revoke | RED exit 1 (file absent) → GREEN exit 0; `test:job-safety-hold-release` PASS | FIXED (source only; hosted application UNVERIFIED) |
| 12 | HIGH | `apps/field/App.tsx:433` | Field leads query lacked workspace filter while appointments/tasks were scoped; cross-tenant lead links possible | Added `.eq('workspace_id', workspaceId)` | `test:field-workspace-scoping` PASS | FIXED |
| 13 | HIGH | `apps/field/App.tsx:481,495` | Drafts stored `workspace_id = null`, so sync guard never detected a workspace switch | Cache active workspace in `workspaceRef` during `loadFieldData`; stamp it on drafts; existing sync mismatch guard now fires | RED exit 1 → GREEN exit 0; `test:field-workspace-scoping` PASS; `test:mobile-offline-sync` PASS | FIXED |
| 14 | HIGH | `proxy.ts:22,48,102` | Field web POSTs with Authorization to `/api/photo-provenance/verify` and `/api/photo-to-report`, but preflight/CORS applied only to supplements/review | Replaced single-endpoint helper with `isFieldCorsPath` covering all three token endpoints for OPTIONS and final responses | RED exit 1 → GREEN exit 0; `test:field-preflight-contract` PASS; `test:field-cors` PASS | FIXED (source only; browser preflight not observed) |
| 15 | HIGH | `scripts/security-definer-migration-test.mjs:10` | `$$`-only regex skipped 11 `$function$` bodies; test reported 63 of 74 SECURITY DEFINER functions | Delimiter-aware parser + independent statement-slice count equality; accept `=` and `to` search_path syntaxes | Measured 63 vs 74 before fix (RED evidence); now 74 checked, 11 tagged bodies, PASS | FIXED |
| 16 | MED-HIGH | `scripts/field-device-evidence-test.mjs:11,37` | Hardcoded `appVersion === '0.4.0'` while shipped build is 0.5.0; template printed `PASS` for zero device evidence | Derive version from `apps/field/app.json`; require version only for real PASS manifests; template forced UNKNOWN and reported as `UNVERIFIED` | RED exit 1 with valid 0.5.0 manifest → GREEN exit 0; template now prints `UNVERIFIED` | FIXED (device execution still UNVERIFIED) |
| 17 | HIGH | `scripts/mobile-apk-provenance.mjs:59-88`, `.github/workflows/mobile-apk.yml:206-216` | Provenance recorded but never compared the signing certificate; re-signed APK could ship as official | Pinned fingerprint `7a1c64b0…74868f` in generator and release gate; fail closed on mismatch | RED exit 1 → GREEN exit 0; `test:mobile-apk-provenance` PASS | FIXED (source only; no APK built) |
| 18 | HIGH | `app/voice-ai/page.tsx:87` | Read `data.action.url`, but `/api/ai/chat` emits `suggestedAction.href`; spoken navigation never worked | Read `suggestedAction.href`, require internal `/` path and reject `//`; reviewer follow-up added an explicit `navigate` flag so unmatched questions do not auto-navigate to `/` | RED exit 1 → GREEN exit 0; `test:voice-ai-navigation` PASS; `test:ai-chat-bar` PASS | FIXED |
| 19 | HIGH | `app/estimate/[id]/page.tsx:291` | Lock-tag fetch had no catch/finally; network failure left the control permanently disabled | Added try/catch/finally with owner-facing error and guaranteed `setSaving(false)` | RED exit 1 → GREEN exit 0; `test:estimate-owner-actions` PASS | FIXED |
| 20 | MEDIUM | `app/estimate/[id]/page.tsx:309,315` | `encodeURIComponent` on mailto/sms recipients produced `%40` addresses | Use readable recipients; reviewer follow-up added `safeMailtoRecipient`/`safeSmsRecipient` to block CR/LF and URL-parameter injection while keeping `@`/`+` intact | RED exit 1 → GREEN exit 0; `test:estimate-owner-actions` PASS | FIXED |

| 21 | CRITICAL | `lib/estimates/estimate-types.ts:73` | `generateEstimateNumber` used only workspace + date, so two estimates in one workspace/day shared an identifier | Added a deterministic per-estimate UUID suffix; API imported the shared generator at both GET and POST call sites | RED exit 1 → GREEN exit 0; `test:estimate-number-uniqueness` PASS | FIXED |
| 22 | CRITICAL | `app/api/estimates/[id]/route.ts:113` | PUT forwarded raw `p_items` to a RPC that allows 500 items / unchecked text, bypassing POST's 200-item/500-char/20-char contract | Created shared `validateEstimateLineItems` used by both POST and PUT | RED exit 1 → GREEN exit 0; `test:estimate-put-contract` PASS; `test:estimate-creation-flow` PASS | FIXED |
| 23 | HIGH | `app/api/estimates/[id]/route.ts:127` | Snapshot edits were in an `else if`, silently dropped whenever `line_items` were present in the same request | Snapshot update now independent of the RPC; status/formula/approval stay owned by the RPC when it runs | RED exit 1 → GREEN exit 0; `test:estimate-put-contract` PASS | FIXED |
| 24 | HIGH | `app/api/receptionist/stripe/webhook/route.ts:68` | `providerLinkId` taken from `object.id` for every event; `pi_…`/`ch_…` events never matched the `cs_…` link, so failures/refunds were dropped | Added `resolvePaymentLinkIdentity` (session id or invoice/workspace metadata fallback) | RED exit 1 → GREEN exit 0; `test:stripe-webhook` PASS | FIXED (source only; no live Stripe events) |
| 25 | MEDIUM | `app/api/receptionist/stripe/webhook/route.ts:72` | Replayed `checkout.session.completed` after a refund reset the link to `paid` | Replay short-circuit plus monotonic `canAdvancePaymentLinkStatus` guard | RED exit 1 → GREEN exit 0; `test:stripe-webhook` PASS | FIXED |
| 26 | MEDIUM | `app/api/receptionist/stripe/webhook/route.ts:81` | Refunds updated the payment link but never the invoice; reports overstated collected revenue | `invoiceStatusForEvent` maps `paid`→`paid` and `refunded`→`void` (the legacy invoices table has no `refunded` state) | RED exit 1 → GREEN exit 0; `test:stripe-webhook` PASS | FIXED |
| 27 | MEDIUM | `app/api/estimates/[id]/lockout/route.ts:17` | `status` was read but never validated; a stray tag could downgrade an approved/closed estimate | `canTagEstimateLocks` rejects terminal states with HTTP 409 before any write | RED exit 1 → GREEN exit 0; `test:lockout-status-guard` PASS | FIXED |
| 28 | MEDIUM | `apps/field/App.tsx:435,485,890` | Reviewer follow-up: `workspaceRef` only set after a successful online RPC; offline cold start wrote `workspace_id = null`, bypassing the sync guard | Persist cached workspace per user in SecureStore/localStorage, hydrate on boot, fail closed when unknown, clear on sign-out, reject legacy null-workspace drafts on sync | `test:field-workspace-scoping` PASS; `test:mobile-offline-sync` PASS | FIXED (source only; no device run) |
| 29 | MEDIUM | `app/voice-ai/page.tsx:88`, `lib/ai/chat-copilot.ts:147` | Reviewer follow-up: fixing 18 made every unmatched spoken question navigate to `/` via the fallback suggestedAction | Added explicit `navigate: true` only on matched nav intents; voice page gates on it | `test:voice-ai-navigation` PASS; `test:ai-chat-bar` PASS | FIXED |
| 30 | LOW | `app/estimate/[id]/page.tsx:314,321` | Reviewer follow-up: removing encoding left customer-controlled recipients able to inject `?`/`&`/CRLF into mailto/sms URLs | Added `safeMailtoRecipient`/`safeSmsRecipient` sanitizers | RED → GREEN; `test:estimate-owner-actions` PASS | FIXED |

### Batch 3 engineering rulings

- Core-logic audit (15 findings) returned during batch 2; the top 10 were selected for batch 3. Remaining audit findings (#4/#5/#6 atomic creation and lockout RPC, #8/#9/#10 photo-workflow approval and report gate, #14/#15 warranty cron) are queued for batch 4+.
- An independent code review of batches 1–2 ran in parallel. It found one blocking stale assertion (`estimate-creation-flow-test.mjs:23`) and two regressions from batch 2 findings 18/20; all three were fixed and verified before this checkpoint. Reviewer finding #3 (offline cold-start workspace) became batch-3 finding 28.
- Test honesty: the new gates for SQL/RPC and route behavior are source-contract tests (regex over source plus pure-helper behavior where extracted). They are **not** proof that migrations parse in PostgreSQL, that CORS preflight works in a browser, or that device evidence exists. `test:field-device-evidence` still reports `UNVERIFIED`.
- No applied migration was edited; no new migration was added in batch 3. No RLS/auth was disabled. God Mode remains disabled.
- New gates registered in `package.json` and the required CI `web` job: `estimate-number-uniqueness`, `estimate-put-contract`, `stripe-webhook`, `lockout-status-guard`.
- `requesting-code-review`: PERFORMED (real `general` subagent reviewed batches 1–2; findings dispositioned above). `receiving-code-review`: PERFORMED (blocking finding + 2 regressions fixed and re-verified).

### Batch 2 engineering rulings

- Migration `110` is forward-only; no applied migration was edited, renamed or replayed. Hosted application, RLS behavior and staging evidence remain UNVERIFIED.
- Finding 15 exposed a wider systemic observation (57 SECURITY DEFINER functions use `search_path = public`, not closed `''`). Those are not silently rewritten here; they are queued as a later batch because changing privileged search paths requires DB-level verification.
- Finding 16 keeps the checked-in device template exiting 0 but now labels it `UNVERIFIED`; a real 0.5.0 PASS manifest was used for the RED→GREEN proof.
- New gates registered in `package.json` and the required CI `web` job: `job-safety-hold-release`, `field-workspace-scoping`, `field-preflight-contract`, `voice-ai-navigation`, `estimate-owner-actions`.
- No workflow YAML parser exists locally; workflow syntax remains unverified until GitHub Actions. `test:release-foreman` passed its line-level CI structure assertions.
- `requesting-code-review`: PENDING (no reviewer subagent dispatched for this batch; deterministic gates + full suite used).
- `receiving-code-review`: PENDING (no feedback received).
- `finishing-a-development-branch`: PENDING (checkpoint due after batch 3).

### Batch 1 engineering rulings

- Pure documentation edits (findings 4–9) have no executable behavior; their verification is ancestry/SHA/ls-remote evidence, not a manufactured RED phase.
- Finding 10 changes CI triggers only; no APK was built or published.
- `python3` lacks `yaml`, `js-yaml`, and Ruby YAML locally; workflow syntax validation is deferred to GitHub Actions on push. `release-foreman-check` passed its line-level CI structure assertions.
- Additional audit returns (frontend, mobile/field, data layer) are queued for batch 2; no claim is made that batch 1 addressed the globally worst defect.

### Batch 1 ledger status update

- `requesting-code-review`: PENDING — no reviewer subagent dispatched for this docs/config batch; CI source checks used instead.
- `receiving-code-review`: PENDING — no feedback received.
- `finishing-a-development-branch`: PENDING — checkpoint due after batch 3.
