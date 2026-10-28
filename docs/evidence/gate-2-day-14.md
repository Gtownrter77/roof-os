# Gate 2 decision — Day 14

Gate 2 definition from issue #339:

> A user can complete lead → inspection → real priced estimate → recorded acceptance → job without mock approvals.

## Status: OPEN, partially demonstrated

The final link, sales → production job handoff, now exists and is enforced in the
database. The gate is **not** closed, because two required links have no real
evidence yet.

## What was demonstrated

| Link | Evidence | Layer |
| --- | --- | --- |
| Lead qualification → inspection appointment | `062_inspection_appointment_gate.sql`, `verify-inspection-appointment-postgres.sh` | disposable PostgreSQL + required CI |
| Estimate approval authority | `059_estimate_approval_admin_guard.sql`, `verify-estimate-authority-postgres.sh` | disposable PostgreSQL + required CI |
| Recorded customer acceptance | `063_estimate_acceptance_deposit.sql`, `verify-estimate-acceptance-postgres.sh` | disposable PostgreSQL + required CI |
| Accepted estimate → production job | `064_production_job_handoff.sql`, `verify-production-job-postgres.sh` | disposable PostgreSQL + required CI |

The Day 14 PostgreSQL suite proves one customer can be handed from an accepted
estimate to exactly one production job with server-owned customer, amount and
scope evidence, and that the lead is marked `won`.

## Why the gate stays open

1. **No real priced estimate.** Day 11 still lacks owner-supplied price-book and
   tax provenance. The test fixtures use synthetic line items. A real priced
   estimate from the owner's market data has not been produced.
2. **No real Supabase Auth/Storage run.** No credentials are available. The
   Supabase-backed API and the real browser flow are untested.
3. **No real customer flow.** The handoff has not been exercised by a user in a
   deployed environment from lead to job.

No mock approval was used or added. The gate is open because the real inputs are
missing, not because a shortcut was taken.

## What would close it

- Run the flow against a real Supabase project with two workspaces and real
  signed-in users.
- Load the owner's real price book and tax source (Day 11).
- Produce one estimate from that data, approve it as owner, record acceptance
  and create the production job.
- Capture the lead, inspection, estimate, acceptance and job identifiers from
  that run.
