# JARVIS Autonomous Adjuster — Rebuild + Desktop Stabilization (2026-11-24)

## Governing constraints
- Rebuild on SD1 only. Worktree: `.worktrees/rebuild-adjuster`, branch `rebuild/jarvis-adjuster`, base `main` @ `be190fd`.
- Fold the adjuster into the existing 15-logical-agent JARVIS. No 16th agent, no second queue, no second worker, no separate app.
- `orchestrator` is the sole claim-state writer. Capabilities are scoped inside existing agents. `adjuster_messages` is the thread of record. One deployment-level identity with per-claim routing.
- Auto-enroll all claims unless disabled; all channels; TCPA consent/opt-out; quiet hours 08:00–20:00; strict NANP E.164.
- No per-send/per-document human approval in v1. Legal/safety/policy guardrails remain.
- Plan-only unless explicitly authorized. Free/open-source first; no paid fallback without permission; no data loss.
- Never fabricate measurements, quantities, prices, values, coverage, or Xactimate codes. Missing carrier price is `null`, never `$0.00`. Keep the name ODE. Golden Report no-dollar rule unchanged.
- Every task: RED → GREEN → VERIFY → REVIEW → COMMIT. Finish with a fresh whole-branch reviewer and full suite, then merge to `main` (owner authorization 2026-11-24).

## Five Critical reviewer findings baked in from the start
1. `jarvis_jobs` enqueue supplies both NOT NULL `payload_hash` and `idempotency_key`.
2. Worker registers real handlers for all six `JarvisJobType`s — never `handlers: {}`.
3. Note/FK/UUID values are real UUIDs or `''` — never `leadId = claimId`, never `identityId: 'unknown'`.
4. Workspace/claim disable toggle calls `setClaimDisabled` / `setWorkspaceAdjusterEnabled` and asserts cancellation.
5. Inbound webhooks bind the claim workspace to the configured `webhookWorkspaceId` before any write.

## Tasks
1. **Data model & guards.** Migration `114_jarvis_adjuster.sql` (jobs, claims, messages, settings, RLS, RPCs, indexes). Pure `types.ts` + `guards.ts` (E.164, quiet hours, consent, no-fabrication, null money). Gate: behavior test importing the pure modules + schema assertions.
2. **Queue & journal.** `payloadHash()`, stable idempotency keys, explicit note idempotency, FK-safe note values, claim/complete/fail state machine. Gate: behavior test.
3. **Orchestrator & capabilities.** Sole claim-state writer, scoped capability map, stop control/cancellation, plan-only default. Gate: behavior test.
4. **Sandbox & facts.** Allowlist defaults to `blocked`, unhandled jobs fail honestly with `adjuster_error`, `ClaimFacts.scopeGaps`, null-price discipline. Gate: behavior test.
5. **API & worker.** Claim/settings routes, inbound correlation (phone/email match), workspace binding, disable toggle, six registered worker handlers. Gate: runtime test with doubles asserting real handler calls, plus schema-faithful insert shape.
6. **UI.** Claim console folded into existing JARVIS shell; 15-agent count unchanged. Gate: UI contract test.
7. **Desktop stabilization.** Weather/radar (NOAA/NWS/MRMS), agent settings/actions, AI wizard. Gate: route + CSP + behavior tests.
8. **Close out.** Docs/ledger, full suite, fresh reviewer, commit/push/merge, record SHAs and UNVERIFIED list.

## Honesty boundary
Green local/source gates are not field or production evidence. No hosted migration, external message, paid spend, Ollama, or device-location test is implied. The UNVERIFIED list stays explicit in the ledger.
