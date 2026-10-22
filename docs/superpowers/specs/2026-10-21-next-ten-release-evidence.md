# Next ten release-evidence fixes — 2026-10-21

## Intent

Close the next ten highest-risk gaps without expanding product scope. The target is a dependable pilot: honest documentation, safe staging migration proof, a complete invitation path, and field-app recovery controls. This batch must not claim production schema parity, real-device success, provider execution, or customer-data recovery unless those are actually exercised.

## Items

### 1. Reconcile current release documentation

Add a dated current checkpoint to `AUDIT-STATUS-2026-10-21.md`, `HANDOFF.md`, `STATE-OF-THE-UNION.md`, and related deployment docs. Preserve history, but clearly supersede stale SHAs, old PR states, and statements that the login is break-glass-only.

### 2. Correct the migration deployment guide

Update `MIGRATION-ORDER.md`, `DEPLOYMENT.md`, and `SUPABASE-MANUAL-MIGRATION.md` to identify migration 053 as source-present, 054 as the next local prefix, and production application as unverified. Add an explicit preflight/read-only verification sequence and prohibit replaying historical migrations.

### 3. Add a protected staging migration verification workflow

Create a manual GitHub Actions workflow using the Supabase CLI and a protected `staging-migration` environment. It may inspect migration status and produce checksums/diffs against an explicitly supplied staging database, but it must not touch production, upload customer data, or claim a restore. Missing secrets must fail clearly.

### 4. Make unauthenticated invitation acceptance recoverable

When an invitation acceptance page receives a 401, route the user to normal login with a safe `next=/team/invitations/accept&invitationId=...` path. Preserve the invitation ID through the Supabase callback and return the user to acceptance after sign-in.

### 5. Make invitation acceptance idempotent in the UI

Prevent React re-mount/strict-mode duplicate POSTs, show a clear accepted/already-accepted/expired state, and provide a sign-in/return action. The server RPC remains the authority; the UI must never claim membership on a failed response.

### 6. Add explicit field-app sign-out and local-session hygiene

Add a visible sign-out control that revokes the Supabase session, clears in-memory draft selection and sensitive cached identity state, and returns to the auth screen. Do not delete local inspection evidence on sign-out; drafts remain scoped by owner ID for later recovery.

### 7. Add a manual retry-now path for failed mobile queue rows

A scheduled retry is not enough in the field. Add a retry-now action that resets only the selected draft's retry timestamps/status and immediately attempts sync, while preserving idempotency keys and failed error messages.

### 8. Handle mobile auth/session expiry distinctly from transient sync failures

Detect expired/invalid sessions during sync, stop retry escalation, preserve local evidence, sign the user out safely, and show a re-authentication message. Network, RLS, workspace mismatch, and missing-file errors remain visible and retryable according to their own category.

### 9. Instrument cron workers with truthful heartbeat evidence

Add a shared worker-observability contract and apply it to the approved internal cron routes where workspace context exists. Record starting/healthy/degraded/stopped transitions and last error without pretending a worker is deployed when it is not. Add static tests for heartbeat wiring and stale-state reporting.

### 10. Add a release-evidence contract and owner checklist

Add one CI-safe contract test and an owner checklist that enumerate the remaining external gates: staging migration, two-workspace browser/storage test, invitation delivery, physical device capture/offline/retry, worker heartbeat, provider tests, and encrypted backup/restore. The checklist must distinguish source/CI evidence from authenticated live evidence.

## Non-goals

This batch will not apply production SQL, run customer-data tests, send invitations, produce an APK, use a payment/provider credential, enable production cron, or add paid dependencies.

## Safe defaults and implementation calls

- The builder may choose exact component wording and test names.
- Login redirect paths use the existing `safeNextPath` helper and never accept external origins.
- Sign-out preserves local drafts and removes only session/identity state.
- Retry-now changes only rows owned by the selected local draft and never deletes failed evidence.
- Session errors are identified from Supabase auth status/code/message patterns; ambiguous errors remain visible and bounded.
- Worker heartbeats remain optional observability. Status is `unknown` when the table is absent or no worker has reported.
- The staging workflow is manual and protected; it has no production URL or production secret default.

## Feature shortlist captured while repairing

These are candidates, not commitments in this batch. They are ranked by likely poverty-reducing value and proximity to the existing product:

1. A dependable inspection-to-Golden-Report pilot: checklist completion, photo evidence, technician verification, manager approval, and printable report.
2. Field queue recovery center: per-photo retry, missing-file repair, upload progress, and exportable failure log.
3. Workspace member administration: invite, accept, role change, revoke, resend, and audit history in one screen.
4. Appointment-to-field handoff: today’s route, property details, checklist, and offline closeout from one job card.
5. Evidence timeline: one chronological view of photos, notes, measurements, verification, approvals, and changes.
6. Owner backup center: encrypted export instructions, migration ledger, retention policy, and tested staging restore evidence.
7. Local/free document intake: bounded PDF extraction with provenance, page citations, review queue, and no automatic claim decisions.
8. Simple lead follow-up automation: deterministic reminders and task assignment before any customer-facing automation.
9. Weather/storm context on a job: candidate NOAA evidence with source/time/location and explicit human confirmation.
10. Pilot analytics: response time, inspection completion, pending uploads, report turnaround, and follow-up aging without invasive tracking.

Anti-features remain explicit: no autonomous insurance coverage decisions, no unapproved customer messages, no fabricated measurements, no silent provider substitution, and no claim that retailer prices are licensed carrier pricing.

## Verification contract

Before implementation: current `main` must be clean at the post-merge SHA. After implementation: run focused auth/invitation/mobile/worker/documentation tests, typecheck, build, audit, security and release checks, the complete CI-equivalent suite, workflow YAML validation, and `git diff --check`. Commit the batch, open a PR, wait for all required checks, merge only when green, and verify post-merge main CI. Stop after these ten items.
