# QC punch list and supervisor closeout (Day 23)

Migration: `supabase/migrations/070_qc_punch_closeout.sql`.
Code: `lib/jobs/qc.ts`,
`app/api/production-jobs/[id]/punch-items/route.ts`,
`app/api/production-jobs/[id]/closeout/route.ts`,
`app/api/production-jobs/[id]/status/route.ts`, `app/jobs/[id]/page.tsx`.

## What this is

Two records on top of the production job:

1. **Punch items** — the QC defects found on a job. Any workspace member may
   record one and resolve one. Severity is `critical`, `major`, or `minor`.
2. **Supervisor closeout** — one immutable record per job. A workspace owner or
   administrator records it while the job is `in_progress`.

Completion of the job is gated on both. A job cannot move to `completed` without
a closeout, and it cannot complete while a critical punch item is open.

## Punch items

1. A new item always starts `open`. A client-supplied status or resolution is
   overwritten.
2. The database stamps `created_by` and `created_at` from the caller.
3. A resolution sets `resolved_by` and `resolved_at` from the caller. A
   `resolution_note` up to 1000 characters may accompany it.
4. The defect fields (`job_id`, `workspace_id`, `severity`, `location`,
   `description`, `created_by`, `created_at`) are immutable.
5. A resolved item is immutable. It cannot be reopened or resolved twice. A
   correction is a new item.
6. There is no delete policy. `DELETE` is refused with `23514`, even for a caller
   that bypasses RLS.
7. A completed or cancelled job refuses new items and new resolutions.
8. The item workspace must match the job workspace.

Only `critical` items block. Open `major` and `minor` items are counted and
reported, and they are recorded in the closeout snapshot as known open work.
The business decision behind that rule is explicit: a supervisor may close out
with known cosmetic or non-critical items, and those stay visible. A critical
defect must be resolved first.

## Supervisor closeout

1. One row per job (`unique (job_id)`).
2. Owner or administrator only. A plain member gets `42501`.
3. Only while the job is `in_progress`.
4. Refused while any critical punch item is open.
5. The database stamps `closed_by` and `closed_at`.
6. The database recomputes `open_critical_count` and `open_total_count`. A
   client value is overwritten.
7. The row is immutable. `UPDATE` and `DELETE` are both refused.

## Completion gate

A trigger on `production_jobs` runs before a status update to `completed` and
checks two things:

1. a closeout exists for the job, and
2. no critical punch item is open **at that moment**.

The second check matters because a defect can be recorded after the closeout.
The closeout does not freeze the punch list. A late critical item still blocks
completion. The job status move itself stays owned by migration `064`.

`evaluateCloseoutGate` returns `can_close`, `open_critical`, `open_total`, and
the blockers. It takes the punch rows, so tests have no hidden state.

## API

- `GET /api/production-jobs/[id]/punch-items`: list plus the computed summary.
  Member-readable and workspace-scoped. A foreign job is `404`.
- `POST /api/production-jobs/[id]/punch-items`: record a defect. Any member. A
  completed or cancelled job returns `409`.
- `PATCH /api/production-jobs/[id]/punch-items`: `{ action: 'resolve' }`. Any
  member. An already resolved item returns `409`.
- `GET /api/production-jobs/[id]/closeout`: the closeout, the gate, the punch
  summary, and `can_close`.
- `POST /api/production-jobs/[id]/closeout`: owner/admin only (`403`
  otherwise). Refused with `409` unless the job is `in_progress` and the gate is
  open.
- `PATCH /api/production-jobs/[id]/status`: owner/admin only. Delegates the
  transition to the migration `064` rules; the completion gate is applied by the
  database.

The routes write only their own tables. They never touch the handoff snapshot,
the schedule, the deposit ledger, a change order, or a customer record.

## What this is not

- Not a warranty. Completing a job creates no warranty record.
- Not an invoice, a final payment, or a deposit change.
- Not a customer sign-off, an electronic signature, or a contract.
- Not an insurer submission or an ESX document.
- Not proof that Gate 3 is closed. A green closeout is a local record over
  recorded rows in a disposable database.
- No email, SMS, customer contact, or export.

## Evidence boundaries

| Layer | Evidence | Result |
| --- | --- | --- |
| Helpers | `npm run test:production-job-qc` | PASS — severities, statuses, resolve-only-open, open/resolved counts, critical-only closeout gate, open minor and major recorded but not blocking |
| Source contracts | same test | PASS — member punch writes, server-stamped author/resolver, resolved-item immutability, no reopen, no delete, owner-only closeout, one closeout per job, completion gate, completed-job refusal, no handoff write, no outbound call |
| PostgreSQL | `scripts/ci/production-job-qc-assertions.sql` via `migration-safety` | Member punch write with forged resolution overwritten, member closeout denial, missing-closeout completion refusal, open-critical closeout refusal, stamped resolver and supervisor, resolved-item immutability, no reopen or re-resolution, no delete (including under a caller that bypasses RLS), one closeout per job, immutable closeout, post-closeout critical block, completion gate, completed-job refusal, cross-workspace denial, handoff unchanged; the PR check reports the real result |
| Supabase Auth/API | Not run | **Not tested** |
| Browser | Not run | **Not tested** |
| Production | Not deployed, not migrated | **Not touched** |

The database assertions run on the disposable local PostgreSQL database
`roofos_job_ci`. They are not a production or Supabase Auth test.
