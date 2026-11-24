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

## Important items disposition
- Inbound correlation requires a valid phone **plus** a matching lead phone/email in the same
  workspace (`correlateInbound`).
- `createClaim()` verifies the lead exists in the caller workspace before the claim write;
  an enqueue failure is surfaced with `retry: true`, never hidden and never “compensated” by
  deleting a durable claim.
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
`test:all` derives its list from `package.json`; this branch registers **180 gates + 4 build/release
checks** with 3 documented waivers (`test:all`, `test:runtime-smoke`, `test:two-workspace-isolation`)
unchanged. Eight new adjuster gates and one desktop resilience gate are wired in
`.github/workflows/ci.yml` and in the registry.

## Verification
- Fresh RED→GREEN evidence above for every task.
- Full suite / typecheck / build / release-check / foreman / registry / coverage / `git diff --check`:
  see the final verification block appended after the build completes.
- BUILD_ID: **pending build**.
- Final checkpoint SHA: **pending**.
- Merge SHA: **pending**.

## Still UNVERIFIED (never claimed as production evidence)
Hosted application of migration 114; live Twilio/SMTP/IMAP credentials and external message
delivery; paid dedicated phone/email deployment (needs owner cost approval); Ollama/agent
inference on the owner’s desktop; real device geolocation and Doppler tile rendering;
staging parity; independent reviewer verdict on the final head. Local green gates prove source
and deterministic-behavior contracts only.

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
10 `requesting-code-review` — pending final fresh reviewer.
11 `receiving-code-review` — performed on the five Critical findings from the lost branch.
12 `verification-before-completion` — performed; final block pending build.
13 `finishing-a-development-branch` — pending push/merge.
14 `writing-skills` — not triggered (no skill files edited).
15 `diagnosing-superpowers` — not triggered (no session-failure investigation requested).
