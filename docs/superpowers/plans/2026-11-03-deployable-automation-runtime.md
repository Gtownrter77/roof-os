# Deployable Automation Runtime and Heartbeat Verification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a deployable worker registry and heartbeat verification path that reports only registered workers as healthy and exposes missing agent implementations without claiming false readiness.

**Architecture:** Keep the existing Supabase service-role heartbeat table and idempotent `agent-runtime.ts`. Add a small static registry describing the four bounded agents and the currently deployed entry points. Add a pure readiness evaluator and a protected HTTP probe that writes `starting`/`healthy`/`stopped` heartbeats for every workspace and returns a machine-readable readiness summary. Do not execute customer, estimate, payment, or communication side effects from the probe.

**Tech Stack:** Next.js Node route, TypeScript, Supabase service-role client, Node contract tests.

**Spec:** `AUTOMATION-AGENTS.md`, `GOLDEN-REPORT.md`, Master Playbook phases 32–39.

## Global Constraints

- AI observations remain non-authoritative.
- No external customer communication, estimate approval, signature, payment, or contract action may occur from the heartbeat probe.
- A missing worker must be reported as `stopped`/not ready, never healthy.
- Workspace IDs are read server-side; callers cannot supply a workspace scope.
- The endpoint requires `CRON_SECRET`.
- Existing routes and wording remain unchanged.

## Review Focus

- Unknown or unregistered agent keys must never be marked healthy.
- Empty workspace results must be explicit and not treated as deployed evidence.
- A worker heartbeat write failure must produce a non-200 response.
- The readiness report must distinguish source registration from live heartbeat evidence.
- The probe must not import or invoke side-effectful action executors.

---

### Task 1: Add registry and readiness evaluator

**Files:**
- Create: `workers/agent-registry.ts`
- Test: `scripts/agent-registry-test.mjs`

**Interfaces:**
- `AGENT_KEYS`
- `getAgentRegistration(agentKey)`
- `evaluateAgentReadiness(registration, heartbeat, now, freshnessMs)`

- [ ] Write failing tests for all four keys, the missing intake worker, fresh healthy heartbeat, stale heartbeat, and stopped heartbeat.
- [ ] Run `node scripts/agent-registry-test.mjs` and observe the expected missing-module failure.
- [ ] Implement the registry with explicit entry points and `registered`/`implemented` flags.
- [ ] Run the test and verify it passes.

### Task 2: Add deployable heartbeat verification route

**Files:**
- Modify: `app/api/cron/heartbeat/route.ts`
- Modify: `scripts/heartbeat-probe-contract-test.mjs`
- Modify: `scripts/worker-heartbeat-runtime-test.mjs` if needed

**Interfaces:**
- Protected `GET` and `POST` `/api/cron/heartbeat`.
- Response includes `heartbeatOnly`, `workspaces`, `agents`, `ready`, and `notReady`.

- [ ] Extend the failing contract test to require all four agent keys, registry use, stopped status for unimplemented agents, and no side-effectful executor imports.
- [ ] Run the contract test and observe failure.
- [ ] Implement server-side workspace enumeration, heartbeat writes for registered workers, stopped records for missing workers, and readiness summary.
- [ ] Run the route contract and heartbeat runtime tests.

### Task 3: Add package/CI gate and documentation

**Files:**
- Modify: `package.json`
- Modify: `.github/workflows/ci.yml` only if the gate is not already included
- Modify: `workers/README.md`
- Modify: `HANDOFF.md`

- [ ] Add `test:agent-registry` and include it in the existing web CI gate.
- [ ] Document that the probe is heartbeat-only and that source registration is not production proof.
- [ ] Run Level 1 static/type/contract checks.
- [ ] Run Level 2 security and migration checks.
- [ ] Run Level 3 build and relevant CI-equivalent checks.
- [ ] Record exact commit, test results, and remaining external production heartbeat evidence in `HANDOFF.md`.
