# Recorded estimate acceptance and deposit state (Day 13)

Migration: `supabase/migrations/063_estimate_acceptance_deposit.sql`.
Code: `lib/estimates/acceptance.ts`, `app/api/estimates/[id]/acceptance/route.ts`, `app/estimate/[id]/page.tsx`.

## What this is

A record that office staff heard the customer accept an **approved** estimate, plus an
append-only deposit ledger.

## What this is not

- **Not an e-signature.** No signature image, signed PDF, certificate or signing provider is stored or claimed.
- **Not a payment.** Nothing charges a card, moves money or contacts a payment processor.
- **Not a contract.** A signed contract remains a separate document and process.

The UI states this next to the record button.

## Acceptance rules

The database enforces every rule:

1. The estimate must be `approved`.
2. The acceptance and the estimate must share a workspace.
3. One acceptance per estimate (`unique (estimate_id)`).
4. `accepted_subtotal`, `accepted_tax`, `accepted_total` and `estimate_formula_version` are copied from the approved estimate by a trigger. A client-supplied amount is overwritten.
5. `accepted_at` is set by the database. A client-supplied time is overwritten.
6. `recorded_by` must be the signed-in workspace member.
7. The row is immutable: `UPDATE` and `DELETE` raise an error, even for the workspace owner.

## Deposit rules

The deposit ledger is append-only. The current state is derived from the events, not stored as a mutable balance.

```
none ──requested──> requested ──received──> received ──refunded──> refunded
  └──waived──> waived
```

- `requested`: the only first event, positive amount, cannot exceed the accepted total.
- `waived`: the only event, zero amount.
- `received`: only after `requested`, positive amount, cannot exceed the requested amount, must have a method, cumulative receipts cannot exceed the accepted total.
- `refunded`: only after `received`, positive amount, cannot exceed the received amount, must have a method. A refund is terminal.
- Every event time is set by the database.
- `UPDATE` and `DELETE` raise an error.

## Current state derivation

`deriveDepositState(acceptedTotal, events)` returns the status, requested/received/refunded totals, outstanding amount, applied amount (received minus refunded), the allowed next events, and a `problem` string when the stored ledger is inconsistent. The UI shows the problem instead of assuming a balance.

## Evidence boundaries

- Source and state machine: `npm run test:estimate-acceptance`.
- Real PostgreSQL trigger/RLS/immutability: `scripts/ci/verify-estimate-acceptance-postgres.sh` in `migration-safety`, on a dedicated disposable database.
- Supabase Auth/API: **not tested** — no credentials.
- Production: untouched.
- Gate 2 is **not** closed by this change. Recorded acceptance still has to be exercised in a real customer flow, and the sales→production job handoff (Day 14) is not built.
