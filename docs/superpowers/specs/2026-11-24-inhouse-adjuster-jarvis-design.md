# In-house Autonomous Adjuster in JARVIS — Rebuilt Design (2026-11-24)

**Status:** Implemented on branch `rebuild/jarvis-adjuster`. Awaiting full-suite verification,
fresh whole-branch review, and merge to `main`. No hosted migration or external send has occurred.

## Shape
The adjuster is not an application. It is a set of capabilities inside the existing 15 logical
JARVIS agents, using the existing `jarvis_jobs` queue and the single existing worker:

- `intake_router` proposes `run_claim_plan` and sandbox checks.
- `scheduler` / `receptionist` own `send_message` and status updates.
- `inspection_quality` / `estimator` own extraction and sandbox checks.
- `office_copilot` / `report_writer` / `supplement_specialist` own document generation.
- `orchestrator` is the **only** claim-state writer.

Every claim auto-enrolls unless disabled. `adjuster_messages` is the thread of record. One
deployment-level identity is configured once and routed per claim; no per-claim identity store.

## Decision chain (every outbound message)
1. `normalizeE164()` or `isValidEmail()` — strict, no guesses.
2. `hasValidConsent()` — channel-specific consent and global opt-out.
3. `isWithinQuietHours()` — contact window 08:00–20:00 in the claim timezone.
4. `canSendNow()` — the single gate; no provider path may bypass it.
5. `assertNoFabrication()` — every value needs provenance; missing price is `null`.
6. `prepareNote()` + `messageIdempotencyKey()` — thread of record, replay-safe.
7. `enqueueShape()` — real `payload_hash` and `idempotency_key` on every job.

## Execution policy
PLAN ONLY by default. Execution transitions are rejected with `plan_only` until an owner
explicitly authorizes them. Free/open-source tooling first; a paid fallback requires explicit
owner approval. The sandbox allowlist defaults to `blocked`, re-checks redirects, and fails
honestly with `adjuster_error` — never a fabricated success.

## Stop controls
`adjuster_set_claim_disabled` and `adjuster_set_workspace_enabled` cancel queued jobs in the
same database call. The UI stop button calls the claim route, which calls the real RPC; there is
no UI-only flag that leaves work running.

## Boundaries
No per-send or per-document human approval in v1 (legal/safety/policy guardrails remain). No
fabricated measurements, prices, coverage, or Xactimate codes. Missing carrier price is `null`,
never `$0.00`. The golden report no-dollar rule is unchanged. ODE keeps its name.
