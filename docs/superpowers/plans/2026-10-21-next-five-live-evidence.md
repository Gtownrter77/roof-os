# Next Five Live-Evidence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make five remaining live-release gates repeatable without claiming evidence that has not been collected.

**Architecture:** Add manual protected workflows for read-only authenticated smoke and heartbeat-only staging probing. Harden the status/heartbeat code, then add local validators for physical-device evidence and the final PASS/FAIL/UNKNOWN summary. No product feature or production side effect is included.

**Tech Stack:** Node.js scripts, Supabase JS, Next.js route handlers, GitHub Actions, Markdown/JSON evidence files.

**Spec:** `docs/superpowers/specs/2026-10-21-next-five-live-evidence.md`

## Global Constraints

- Exactly five items; no sixth item enters this batch.
- Production is never targeted; all staging workflows require project-reference and non-production confirmation.
- Authenticated smoke is read-only and uses two dedicated staging users.
- The heartbeat probe may write only a heartbeat row in protected staging.
- Evidence validators never print credentials/customer data and never convert `UNKNOWN` into `PASS`.

## Review Focus

- Read-only smoke must contain no insert/update/delete/upload operation; Task 1 contract scans all operations.
- Heartbeat probe must not dispatch business cron work; Task 2 contract requires a dedicated route and rejects business executor imports.
- Status must not report healthy when heartbeat persistence returned a Supabase error; Task 3 tests the error branch.
- Device evidence must reject secrets, customer data, and unsupported success claims; Task 4 tests all three.
- Summary must preserve UNKNOWN and avoid network access; Task 5 tests status semantics and static behavior.

---

### Task 1: Authenticated read-only staging smoke

**Files:**
- Create: `scripts/authenticated-readonly-smoke.mjs`
- Create: `.github/workflows/staging-auth-readonly-smoke.yml`
- Create: `scripts/authenticated-readonly-smoke-contract-test.mjs`
- Modify: `package.json`

- [ ] Implement a Supabase JS smoke using two credential pairs that signs in, calls `current_workspace_id`, performs bounded `select`/Storage read operations only, and signs out in `finally`.
- [ ] Require `STAGING_PROJECT_REF`, `ROOF_RLS_TEST_NONPROD=true`, and explicit confirmation; reject the production host and missing target identity.
- [ ] Add a manual protected workflow with no push/PR trigger and no artifacts.
- [ ] Add a contract that rejects mutation/upload verbs and requires sign-out/cleanup, then register `npm run test:authenticated-readonly-smoke`.
- [ ] Run the contract and parser; expect PASS without staging credentials.

### Task 2: Heartbeat-only staging probe

**Files:**
- Create: `app/api/cron/heartbeat/route.ts`
- Create: `.github/workflows/staging-heartbeat-probe.yml`
- Create: `scripts/heartbeat-probe-contract-test.mjs`
- Modify: `package.json`

- [ ] Implement `POST /api/cron/heartbeat` requiring `CRON_SECRET`, using the admin client to select bounded workspace IDs and write only `agent_worker_heartbeats` with agent key `staging_probe`.
- [ ] Ensure the route contains no imports or calls for action executor, Twilio, retailer, payment, claims, or customer workflow code.
- [ ] Add the manual protected staging workflow with target allowlist and explicit non-production confirmation.
- [ ] Add a contract for secret gating, staging gates, heartbeat-only behavior, and no artifacts.
- [ ] Register and run the contract locally.

### Task 3: Worker-health reporting correctness

**Files:**
- Modify: `workers/heartbeat.ts`
- Modify: `app/api/status/route.ts`
- Modify: `scripts/worker-heartbeat-contract-test.mjs`
- Modify: `scripts/status-health-check-test.mjs`

- [ ] Make `writeWorkerHeartbeats` inspect the Supabase upsert result and return a count/error summary without throwing into business cron paths.
- [ ] Make status query heartbeat rows in deterministic `last_seen_at` order, distinguish query error from zero configured workers, and expose bounded stale/error counts without secret values.
- [ ] Add static contracts for returned upsert errors, ordering, and degraded/unknown status semantics.
- [ ] Run both focused tests and typecheck.

### Task 4: Physical-device evidence packet

**Files:**
- Create: `docs/evidence/field-device-0.4.0.example.json`
- Create: `scripts/field-device-evidence-test.mjs`
- Modify: `OWNER-MANUAL.md`
- Modify: `package.json`

- [ ] Define a redacted manifest schema with device platform/model, app version, build identifier, test timestamp, and the seven required test case statuses.
- [ ] Require artifact identifiers for PASS, reject credentials/customer data, and reject a fully passing manifest without an APK/build identifier.
- [ ] Add a contract validator and owner procedure for collecting the real packet; example data must remain clearly `UNKNOWN`/redacted.
- [ ] Register `npm run test:field-device-evidence` and run it locally.

### Task 5: Release-gate summary

**Files:**
- Create: `scripts/release-gate-summary.mjs`
- Create: `scripts/release-gate-summary-test.mjs`
- Modify: `OWNER-MANUAL.md`
- Modify: `package.json`
- Modify: `.github/workflows/ci.yml`

- [ ] Generate a local Markdown summary with named gates and only `PASS`, `FAIL`, or `UNKNOWN`; default absent external evidence to `UNKNOWN`.
- [ ] Read only local evidence/CI files, never fetch, print secrets, or infer live proof from source presence.
- [ ] Add tests for unknown preservation, failed gate propagation, and no-network behavior.
- [ ] Register the command in CI as a repository-evidence summary, explicitly not a production-release approval.
- [ ] Run the summary contract and full local verification.

## Final verification

Run all five focused contracts, root/field TypeScript, build, release/security checks, full existing regression suite, dependency audit, workflow YAML parsing, and `git diff --check`. Commit exactly this batch, open a PR, wait for every required check, merge only when green, verify post-merge main CI, and stop.
