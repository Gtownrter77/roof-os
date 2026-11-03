# Two Bounded AI Agents Implementation Plan

> **For agentic workers:** Implement with test-first development and verify every task before commit.

**Goal:** Implement the Intake Router and Office Copilot bounded workers as auditable, workspace-scoped, idempotent runtime functions.

**Architecture:** Each worker uses the existing `createAgentRuntime` for heartbeat, workspace validation, idempotent `agent_runs`, and failure review tasks. Deterministic planning is authoritative; local Ollama is optional advisory output only. Proposed internal actions are stored through the existing approval-bound action ledger and no customer-facing, financial, legal, or estimate action is auto-executed.

**Tech Stack:** TypeScript, Supabase server client, existing agent runtime/action ledger, Node contract tests, optional Ollama JSON adapter.

**Spec:** `AUTOMATION-AGENTS.md` and the latest `HANDOFF.md` entry.

## Global Constraints

- Preserve workspace isolation by filtering every worker read and write by `workspace_id`.
- Preserve idempotency through stable `eventKey` and action idempotency keys.
- Keep deterministic validation authoritative over model output.
- Do not send messages, book appointments, approve reports, issue payments, or create authoritative estimates.
- Keep Office Copilot report output in `agent_runs` as draft/review-required evidence.

## Review Focus

- Duplicate intake records must produce a review task rather than silent reassignment.
- Invalid or missing contact data must never be normalized into fabricated values.
- Office report drafts must flag missing albums, failed uploads, and missing captions.
- Model failure or malformed JSON must fall back to deterministic output.
- Rerunning the same event must not create a second action batch.

### Task 1: Intake Router

**Files:** Create `workers/intake-router.ts`, `scripts/intake-router-test.mjs`; modify `workers/agent-registry.ts`, `package.json`, `.github/workflows/ci.yml`.

- [ ] Write failing pure planning tests for contact normalization, duplicate detection, owner suggestion, and first-response/review-task actions.
- [ ] Implement deterministic planning and runtime-backed execution.
- [ ] Verify the focused test and typecheck.
- [ ] Commit the Intake Router batch.

### Task 2: Office Copilot

**Files:** Create `workers/office-copilot.ts`, `scripts/office-copilot-test.mjs`; modify `workers/agent-registry.ts`, `package.json`, `.github/workflows/ci.yml`.

- [ ] Write failing pure report-draft tests for evidence deficiencies and approval state.
- [ ] Implement deterministic report drafting with optional Ollama advisory output.
- [ ] Verify focused tests, full typecheck, production build, and relevant regression checks.
- [ ] Commit the Office Copilot batch.

### Integration

- [ ] Update registry tests to assert both agents are implemented and point to real entry points.
- [ ] Run the complete required CI command set locally.
- [ ] Push the branch, open a protected PR, wait for all checks, merge, and verify merged main.
