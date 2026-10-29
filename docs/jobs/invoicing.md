# Production invoicing (Day 24)

Migration: `supabase/migrations/071_production_invoice.sql`.
Code: `lib/jobs/invoicing.ts`, `app/api/production-jobs/[id]/invoices/route.ts`, `app/jobs/[id]/page.tsx`.

The table is `production_invoices`.

## What this is

A **production invoice** is a snapshot of what the customer already accepted:
the approved scope lines, the recorded tax, the approved change-order deltas, and
the deposit already received. The database computes every amount. The browser
cannot supply a total, a tax, a line item, or a deposit credit.

### Lifecycle

| Status | Can transition to | Notes |
|---|---|---|
| `draft` | `issued`, `void` | Draft created by owner; database computes all amounts |
| `issued` | `void` | Immutable once issued; server stamps who issued and when |
| `void` | — | Terminal; can only be voided, never re-issued or edited |

No payment state is stored in this migration. Payment and failed/reversed outcomes
are a separate record.

### Invoice fields (computed by the database)

| Field | Source |
|---|---|
| `source_accepted_total` | `production_jobs.accepted_total` |
| `source_tax` | `estimate_acceptances.accepted_tax` |
| `scope_lines_total` | Sum of approved scope line `line_total` values (non-tax) |
| `change_order_total` | Sum of approved change-order `amount_delta` values |
| `subtotal` | `scope_lines_total + change_order_total` |
| `tax` | `source_tax` |
| `total` | `subtotal + tax` |
| `deposit_credit` | Received deposit minus refunds from the estimate deposit ledger |
| `balance_due` | `total - deposit_credit` |
| `scope_item_count` | Number of approved scope lines |
| `line_items` | Approved scope lines plus approved change-order lines (jsonb array) |

### API routes

| Route | Method | Who |
|---|---|---|
| `GET /api/production-jobs/[id]/invoices` | List invoices + draft preview | Member can read; owner/admin can manage |
| `POST /api/production-jobs/[id]/invoices` | Create draft invoice | Owner/admin only |
| `PATCH /api/production-jobs/[id]/invoices` | Move status (issue/void) | Owner/admin only |

### Route contract highlights

- `POST` body must be empty (`{}`) — the database computes all amounts
- `PATCH` body: `{ action: 'issue' | 'void', invoice_id: uuid, void_reason?: string }`
- Only workspace owner or administrator may create or move invoices
- A cancelled production job cannot be invoiced
- An unreconciled scope (scope + tax ≠ accepted total) is refused
- Only **approved** change-order deltas are included; declined/pending are excluded
- The invoice number is server-generated: `INV-XXXXXXXXXXXX`
- All money amounts, scope evidence, and identity are immutable after insert/update

### Database triggers

- `enforce_production_invoice()` fires before insert/update/delete
- INSERT: database reads the approved scope, tax, change orders, and deposit ledger;
  computes every amount; generates invoice_number; sets status to `draft`
- UPDATE: only status transitions are allowed (draft → issued → void)
  All money, scope, and identity fields are immutable
- DELETE: refused with `23514`; invoice is voided instead
- `deposit_credit <= total` and `balance_due = total - deposit_credit` check constraints

### Verification

- `npm run test:production-job-invoice` runs the contract test script
- `scripts/ci/production-job-invoice-assertions.sql` runs on the disposable `roofos_job_ci` database
- Verifies: member invoice denial, owner draft creation with correct computed amounts,
  issuer stamping, issued immutability, void terminal, no re-issue, cancelled-job refusal,
  scope reconciliation refusal, cross-workspace denial, handoff snapshot unchanged

### Not claimed

- Not a payment, receipt, card charge, insurer submission, or promise that money was received
- Not an ESX document
- No gate claims beyond internal evidence in a disposable database