# Field work evidence and change-order review (Day 22)

Migration: `supabase/migrations/069_field_work_change_orders.sql`.
Code: `lib/jobs/fieldwork.ts`,
`app/api/production-jobs/[id]/updates/route.ts`,
`app/api/production-jobs/[id]/change-orders/route.ts`,
`app/jobs/[id]/page.tsx`.

## What this is

Two records on top of the immutable handoff:

1. **Daily field update** — append-only evidence of what happened on a date.
2. **Change order** — a requested scope or price change that a workspace owner
   or administrator approves or declines.

Neither record changes the customer, accepted total, approved scope, or
warranty on the handoff. An approved change order is a separate invoice input.

## Database rules

### Field updates (`production_job_updates`)

1. The job must exist and the row workspace must match it.
2. Any workspace member can add one.
3. The author is the caller and the timestamp is server-owned.
4. The work date must be a real calendar date and not in the future.
5. The note is required (1–2000 characters). Percent complete is optional
   (0–100 whole number). Blockers are optional (up to 1000 characters).
6. No `UPDATE` and no `DELETE`. A correction is a new update.
7. A completed or cancelled job refuses new updates.

### Change orders (`production_job_change_orders`)

1. The job must exist and the row workspace must match it.
2. Any workspace member can request one.
3. A new row always starts `requested`. The requester is the caller, and any
   client-supplied decision is overwritten.
4. `description`, `reason`, and `amount_delta` are the request. The amount must
   be nonzero and fit two decimals.
5. Only an owner or administrator can decide. `decided_by` and `decided_at` are
   server-stamped.
6. `requested` moves to `approved` or `declined`, once. A decided row is
   immutable and cannot be re-decided.
7. Request fields are immutable during the decision.
8. `DELETE` is refused. Decline the request instead.
9. A completed or cancelled job refuses new change orders.

Statuses: `requested`, `approved`, `declined`.

## API

- `GET /api/production-jobs/[id]/updates`: member-readable list, newest first,
  `limit(100)`. A foreign job is `404`.
- `POST /api/production-jobs/[id]/updates`: member write. A completed or
  cancelled job returns `409`.
- `GET /api/production-jobs/[id]/change-orders`: list plus a summary of
  approved, pending, and declined deltas, and `can_decide`.
- `POST /api/production-jobs/[id]/change-orders`: request a change. Members may
  request. A completed or cancelled job returns `409`.
- `PATCH /api/production-jobs/[id]/change-orders`: `{ action: 'decide' }`.
  Owner/admin only (`403` otherwise). A decided change order returns `409`.

The routes write only their own table. They never touch the handoff snapshot,
the deposit ledger, the schedule, or a customer record.

## Deltas and invoicing

`summarizeChangeOrders` reports:

- `approved_count`, `requested_count`, `declined_count`,
- `approved_delta_total` — the only invoice input,
- `requested_delta_total` — context only, never invoiced,
- `has_pending`.

A credit keeps its sign. A declined or pending request never adds money. The
handoff `accepted_total` is left alone, so later invoicing can show the accepted
total, the approved change-order delta, and the resulting contract amount
without rewriting history.

## What this is not

- Not a customer signature or a counter-signed contract amendment.
- Not an email, SMS, or customer notification.
- Not a payment, deposit change, or invoice.
- Not a permit, weather, or readiness decision.
- Not an insurer submission or an ESX document.
- Field updates do not approve scope. Only an owner decision does.

## Evidence boundaries

| Layer | Evidence | Result |
| --- | --- | --- |
| Helpers | `npm run test:production-job-fieldwork` | PASS — statuses, decisions, work-date calendar checks, approved/pending/declined totals, credits, rounding, signed labels |
| Source contracts | same test | PASS — append-only updates, member request, owner decision, immutable request fields, no re-decision, no delete, completed-job refusal, no handoff write, no outbound call |
| PostgreSQL | `scripts/ci/production-job-fieldwork-assertions.sql` via `migration-safety` | Server-stamped author/decider/time, refused future and blank updates, member decision denial, decided immutability, zero-amount refusal, no delete (including under a caller that bypasses RLS), completed-job refusal, cross-workspace denial, handoff unchanged; the PR check reports the real result |
| Supabase Auth/API | Not run | **Not tested** |
| Browser | Not run | **Not tested** |
| Production | Not deployed, not migrated | **Not touched** |

The database assertions run on the disposable local PostgreSQL database
`roofos_job_ci`. They are not a production or Supabase Auth test.
