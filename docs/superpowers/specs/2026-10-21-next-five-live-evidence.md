# Next five live-evidence fixes — 2026-10-21

## Intent

Turn the remaining release blockers into bounded, repeatable evidence procedures. This batch contains exactly five items and does not add customer-facing features.

## Items

### 1. Protected authenticated read-only smoke

Add a manual protected workflow and Node script that signs in two dedicated staging users, resolves each user’s workspace, reads only bounded workspace-scoped records, checks that private Storage listing/download behavior does not cross the workspace boundary, and signs out. It must perform no inserts, updates, deletes, uploads, provider calls, or production requests. Require the existing project-reference and non-production gates.

### 2. Staging cron/heartbeat probe

Add a manual protected staging workflow that invokes a bounded internal cron heartbeat probe using `CRON_SECRET` and the allowlisted staging target. The probe may write only the worker heartbeat row needed to prove scheduler reachability; it must not execute agent actions, Twilio, retailer, payment, claims, or customer workflows. Report the returned heartbeat status without uploading secrets.

### 3. Worker-health reporting correctness

Strengthen the status endpoint and heartbeat helper so Supabase errors are represented as degraded/unknown evidence instead of silently looking healthy, worker rows are ordered deterministically, and stale counts are bounded and explicit. Extend the status and heartbeat contract tests. Preserve fail-open behavior for business cron side effects.

### 4. Physical-device evidence packet contract

Create a versioned, redacted evidence manifest and validation script for the required Android/iOS field test: sign-in, camera capture, offline close/reopen, retry, private upload, sign-out, and cross-workspace denial. The validator must reject credentials, customer data, and claims of success without artifact identifiers. This documents the gate; it does not pretend to run a device test.

### 5. Single release-gate summary

Add a deterministic report generator that summarizes repository checks, manual staging checks, physical-device evidence, backup/restore, schema parity, worker runtime, and provider gates as `PASS`, `FAIL`, or `UNKNOWN`. It must read only local evidence files/CI inputs, never print secrets, never call the network, and never promote `UNKNOWN` to `PASS`. Add an owner procedure for publishing the summary internally.

## Non-goals

No production mutation, customer record, provider call, payment, agent action, claims parse, real backup restore, APK installation, or browser takeover will occur in this batch. The staging probe is the only intentional write and is limited to a heartbeat row in the protected staging project.

## Safe defaults

- All workflows are manual and protected by GitHub environments.
- Every staging workflow requires `STAGING_PROJECT_REF`, rejects the production host, and requires explicit non-production confirmation.
- Authenticated smoke uses two dedicated users and read-only queries; it does not create synthetic rows.
- The heartbeat probe uses a dedicated route that cannot dispatch business work.
- Evidence summaries expose statuses and identifiers only, never secrets or customer data.

## Verification contract

Run focused smoke, heartbeat, status, device-manifest, and release-summary contracts; root and field TypeScript checks; build; security; full regression; dependency audit; workflow YAML parsing; and `git diff --check`. Commit this exact five-item batch, open a PR, wait for all required checks, merge only when green, verify post-merge main CI, and stop.
