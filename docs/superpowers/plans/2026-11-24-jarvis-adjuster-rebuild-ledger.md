# JARVIS Adjuster Rebuild + Desktop Stabilization — Evidence Ledger (2026-11-24)

## Authority and honesty boundary
Owner authorization: “ok. work until complete. you have full authorization. this time only”, after
“both” (rebuild the lost adjuster slice **and** fix the reported desktop failures) and
“fix all. get all current loose ends wrappped up and merged to main before we continue”.
Earlier no-push/no-merge gate is superseded. All work is on SD1 at
`/mnt/shared/removable/SD1/projects/roof-os-restore/.worktrees/rebuild-adjuster`; the user
explicitly forbade writing to the Linux filesystem.

GBrain was consulted first (`context_pack`, `recall`, `search`, `query`): it held no recovery copy
of the lost adjuster work, and its search is keyword-only/degraded on this host. Five durable
facts (authorization, worktree location, guardrails, five Critical findings, close-out requirements)
were written to GBrain as the shared ledger so a lost worktree cannot lose the context again.

The original `feat/jarvis-adjuster` branch (11 commits through `e1025e5`) was never pushed and its
local git database disappeared during server restarts; GitHub has no adjuster branch. This is a
**rebuild**, not a recovery, and it bakes the reviewer’s five Critical findings in from the start.

## Task commits (RED → GREEN → VERIFY → REVIEW → COMMIT)
| Task | Commit | Evidence |
|---|---|---|
| 1 Data model + guards | `f4a443a` | `test:jarvis-adjuster-guards` RED (module missing) → GREEN; migration 114 schema assertions |
| 2 Queue + journal | `83cf870` | `test:jarvis-adjuster-queue` RED → GREEN; hash/idempotency/FK behavior + schema-faithful insert shape |
| 3 Orchestrator | `51ea9b8` | `test:jarvis-adjuster-orchestrator` RED → GREEN; 15-agent invariant, plan-only, stop control |
| 4 Sandbox + facts | `5377be7` | `test:jarvis-adjuster-sandbox` RED → GREEN; blocked-by-default, redirect re-check, null price |
| 5 API + worker | `2a5f74a` | `test:jarvis-adjuster-api-worker` RED → GREEN; RPC hash/key, workspace binding, six handlers |
| 5b HTTP routes | `3d2a4f9` | `test:jarvis-adjuster-routes`; stop RPC + config-bound inbound |
| 6 UI | `e5c002d` | `test:jarvis-adjuster-ui`; folded into settings, no new nav/app/agent |
| 7 Desktop fixes | `5880c76` | `test:desktop-api-resilience` RED → GREEN; weather/wizard/agent safe responses |

## Five Critical findings closed
1. `enqueueJob()` always supplies `payload_hash` (SHA-256 of stable JSON) and a stable
   `idempotency_key` to `jarvis_enqueue_job`; both columns are `NOT NULL` in migration 114 and
   the runtime test asserts the RPC arguments.
2. `HANDLERS` registers all six `JarvisJobType`s with real gateway/orchestrator/documents/
   extraction/sandbox/guards calls; the worker fails closed on an unhandled type with
   `adjuster_error`. No `handlers: {}`.
3. `foreignKeysForNote()` returns `''` for a claim id copied into the lead FK and for
   `'unknown'`/malformed identities; real UUIDs pass. Runtime test asserts the inserted row.
4. `/api/jarvis/claims/[id]/disable` calls `adjuster_set_claim_disabled`, which cancels queued
   jobs in the same RPC; workspace kill switch calls `adjuster_set_workspace_enabled`.
5. `writeInbound()` calls `resolveInboundWorkspace()` before any write; a claim in another
   workspace returns `workspace_mismatch` with zero inserts. Workspace comes from deployment
   config (`JARVIS_ADJUSTER_WORKSPACE_ID`), never the request body.

## Fresh whole-branch reviewer (committed head `d7b2fad`) and disposition
The reviewer returned **Ready to merge? No** before the fixes below were applied. Every Critical and
Important finding was verified against the code and then closed in this working tree:

| Finding | Disposition |
|---|---|
| **Critical** — authenticated enrollment wrote directly to an RLS-protected table | `adjuster_enroll_claim()` is a `security definer` RPC with membership and lead-in-workspace checks; `/api/jarvis/claims` calls it and reads the enrolled claim back |
| **Critical** — service-role enqueue rejected by `is_workspace_member(all)`; inbound message and job were two separate writes | `jarvis_enqueue_job()` accepts a verified service role for workspace-exists checks; `adjuster_record_inbound()` writes message + job in one transaction after workspace binding, stop controls and claim-lead correlation. Adapter tests assert the RPC payloads and zero writes on rejection |
| Important — stop flags not durable/effective | `adjuster_claims.disabled` and `workspace_adjuster_settings.adjuster_enabled` are checked inside both mutating RPCs and in the worker's `loadPolicy()`; both stop RPCs cancel queued jobs |
| Important — workspace kill switch unreachable | Admin-only `/api/jarvis/settings` POST plus a workspace stop/restart button in `AdjusterControl`; `readApiJson()` handles non-JSON errors |
| Important — guards and PLAN ONLY not wired to execution | `lib/jarvis/runtime.ts` loads DB policy, scopes capabilities, checks consent/quiet hours, blocks all execution jobs while `planOnly && !authorized`, and sends only through a confirmed-delivery provider; `/api/jarvis/worker` runs one job per authorized request |
| Important — 15-agent roster vs 4 implemented registry keys | Roster stays at exactly 15 product roles; `SCOPED_CAPABILITIES` is keyed by the four real `AgentKey`s in `workers/agent-registry.ts` and the docs state the distinction |
| Important — source-text-only gates | Added `test:jarvis-adjuster-migration` (SQL/adapter contract), `test:jarvis-adjuster-runtime` (zero-side-effect behavior for consent, quiet hours, plan-only, stop and capability checks) and correlation/enrollment RPC behavior assertions |
| Important — claim-lead correlation missing | `correlateInboundToClaim()` plus `p_matched_lead_id` in the atomic RPC; a lead in the right workspace but not on the claim is rejected |
| Important — no auto-enroll trigger | `adjuster_leads_auto_enroll` inserts after every new lead and a replay-safe backfill enrolls existing leads |
| Important — duplicate quiet-hour semantics | `lib/jarvis/guards.ts` delegates to canonical `isWithinQuietHours()`/`normalizeStrictE164()` in `lib/outbound-policy.ts`; midnight and invalid-timezone behavior is tested in both directions |
| Important — sandbox reported success without a capability | `runSandboxAction()` fails with `adjuster_error` when no executable capability exists; async provider rejection is normalized by the runtime |
| Important — request supplied `identity_id` | Claims route reads only `JARVIS_ADJUSTER_IDENTITY_ID`; `'unknown'`/malformed identities normalize to `''` |
| Minor — `deliveryWording('sent') === 'delivered'` | `'sent'` now reports `unknown`; only confirmed `delivered` uses delivered wording |
| Minor — `jobQueued: true` on an idempotent conflict | Route now reports `Boolean(jobId)` and returns 200 for a reused key |
| Minor — migration replay/FK hardening | `if not exists`, `create or replace`, `drop policy/trigger if exists`, claims table created before the FK-bearing jobs table |
| Minor — comments claiming a pre-existing queue/worker | Corrected to state that migration 114 creates the single queue and the adjuster adds job types to the one worker |

The reviewer declined to judge live sends/credentials, hosted migration, paid procurement, Ollama,
EXIF implementation, Golden Report rendering, radar tiles, backfill, download endpoint and the
15-agent product decision; those remain outside local evidence.

## Second whole-branch reviewer (committed head `01c7515`) and disposition
The follow-up reviewer again returned **Ready to merge? No** before the fixes below. Every finding
was checked against the code and closed in this working tree:

| Finding | Disposition |
|---|---|
| **Critical** — worker cast snake_case PostgREST rows to camelCase `JarvisJob`; `claimId` was undefined and every job failed | `lib/jarvis/api/row.ts::mapJobRow()` maps and validates the real row; the worker uses it and fails malformed rows honestly. Behavior gates feed actual DB-shaped rows through the mapper and the runtime |
| Important — TCPA revocation ignored when an older grant remained; `expires_at` ignored | `lib/jarvis/api/consent.ts::resolveConsent()` binds by normalized contact/channel, any revocation wins over older grants, expired grants are rejected, and failed consent reads throw so sends fail closed |
| Important — no lease recovery or ownership check | Stale `running` leases older than five minutes are reset to `queued`; claim and finish update include `locked_by`, so an old claimant cannot complete another worker's job |
| Important — two of six job types always failed as “not configured” | `generate_document` and `extract_estimate` are rejected by `ENQUEUEABLE_JOB_TYPES` at enqueue time and fail explicitly at the runtime guard with `not configured for this deployment`; no document or estimate is fabricated. Only configured types may be queued by this slice |
| Important — `/api/jarvis/worker` had no in-repo caller | The existing daily dispatcher imports and drains the single worker (bounded to ten jobs/run) under `CRON_SECRET`; dry-run reports `jarvis_worker` as skipped. Vercel Hobby stays at two crons |
| Important — auth fallback broke when a dedicated worker secret was set | `isAuthorizedWorkerAuthHeader()` accepts either the dedicated worker secret or `CRON_SECRET`, never an empty value; behavior-tested with both combinations |
| Important — migration/route gates still source-text only | Added real snake_case row mapping and consent behavior assertions; route gate now asserts the mapper, lease ownership, recovery and consent resolver |

The reviewer declined to judge hosted migration application, live delivery credentials/providers,
Ollama inference, Doppler tiles, geolocation, EXIF bytes, deployment topology and the 15-role
business decision. Fixing these findings does not convert local evidence into production evidence.

## Important items disposition
- Inbound correlation requires a valid phone **plus** a matching lead phone/email in the same
  workspace (`correlateInbound`).
- `adjuster_enroll_claim()` verifies the lead exists in the caller workspace inside the same
  transaction as the claim write; an enqueue failure is surfaced with `retry: true`, never hidden
  and never “compensated” by deleting a durable claim.
- Completion evidence is defined as verified DB rows (`jarvis_jobs.status`, `adjuster_messages`);
  no source-only assertion is presented as runtime proof.
- journal idempotency key is an explicit column with a deterministic SHA-256, not an implicit key.
- EXIF stripping is declared required (`EXIF_STRIP_REQUIRED`) before any photo is embedded in a
  document; no photo bytes are embedded by this slice.

## Minor items disposition
- Radar map errors are isolated to the map with an explicit message; weather figures do not
  depend on the map (`dashboard-weather-test` + resilience gate).
- Sandbox re-checks the final URL after a redirect against the same allowlist.
- Inbound channel is derived from the sender (`@` → email, otherwise strict E.164 phone).
- Follow-up cron payloads (if added later) must go through `enqueueShape()` so the hash is real.
- The download endpoint is out of scope for this slice; no metadata-as-PDF behavior is introduced.

## Gate registry
`test:all` derives its list from `package.json`; the rebuilt branch adds **nine adjuster gates**
(guards, queue, orchestrator, sandbox, api-worker, migration, runtime, routes and UI) plus one
desktop resilience gate, all wired in `.github/workflows/ci.yml` and in the registry. The exact registered count is recorded from `test:all` in the final verification block.

## Verification
- Fresh RED→GREEN evidence above for every task.
- Reviewer-fix gates re-run against the uncommitted working tree on 2026-11-24: guards, runtime,
  API/worker, orchestrator, queue, sandbox, migration/adapter, routes, UI, desktop resilience and
  `dashboard-weather` all exited 0. `git diff --check be190fd..HEAD` exited 0 before these edits.
- Full suite / typecheck / build / release-check / foreman / registry / coverage / final
  `git diff --check`: see the final verification block appended after the build completes.
- BUILD_ID: **pending build**.
- Final checkpoint SHA: **pending**.
- Merge SHA: **pending**.

## Still UNVERIFIED (never claimed as production evidence)
Hosted application of migration 114 (including its revised service-role/RLS and atomic inbound
RPCs); live Twilio/SMTP/IMAP credentials and external message delivery; a configured outbound
gateway returning confirmed delivery; paid dedicated phone/email deployment (needs owner cost
approval); Ollama/agent inference on the owner’s desktop; real device geolocation and Doppler tile
rendering; staging parity; independent reviewer verdict on the final head. Local green gates
prove source and deterministic-behavior contracts only.

## 15-skill audit
1 `using-superpowers` — performed (skills loaded before action).
2 `brainstorming` — performed earlier for the design; this rebuild follows the signed plan.
3 `writing-plans` — performed (`2026-11-24-jarvis-adjuster-rebuild.md`).
4 `using-git-worktrees` — performed; SD1 native git worktree.
5 `test-driven-development` — performed per task with observed RED then GREEN.
6 `systematic-debugging` — performed on the desktop fetch/status root causes and test vectors.
7 `executing-plans` — performed inline, no implementer subagent per task.
8 `subagent-driven-development` — not triggered (inline execution chosen).
9 `dispatching-parallel-agents` — not triggered (shared schema/registry files; sequential).
10 `requesting-code-review` — performed (fresh whole-branch reviewer at `d7b2fad`; verdict No, disposition above; final head re-review pending).
11 `receiving-code-review` — performed on the five Critical findings from the lost branch and again on the fresh reviewer's Critical/Important/Minor findings.
12 `verification-before-completion` — performed on the gates; final full-suite block pending build.
13 `finishing-a-development-branch` — owner already authorized merge; pending push/merge.
14 `writing-skills` — not triggered (no skill files edited).
15 `diagnosing-superpowers` — not triggered (no session-failure investigation requested).
