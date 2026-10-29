# Days 27-30 rehearsal and release evidence

Date: 2026-10-28. Source repo: `Gtownrter77/roof-os`.

This file records what was actually executed for the last four sprint days. It
does not claim a live Supabase, physical-device, staging, or production result.

## Day 27 — end-to-end rehearsal, clean and exception path

`scripts/ci/production-job-lifecycle-assertions.sql` runs one continuous
lifecycle against the disposable GitHub Actions PostgreSQL database:

lead → approved priced estimate → recorded acceptance → production job →
crew/materials → permit/weather readiness → field update → approved change
order → QC punch item → supervisor closeout → completion → invoice →
payment attempt → warranty and Roof Passport.

The same file runs exception paths and asserts the refusal, not just the happy
path:

| Exception | Expected result |
| --- | --- |
| Completion before closeout | refused; job stays `in_progress` |
| Closeout with an open critical punch item | refused |
| New critical punch item after closeout | completion refused until resolved |
| Payment attempt on a draft invoice | refused |
| Second live invoice for one job | refused |
| Payment from `pending` straight to `reversed` | refused |
| Voiding an invoice with a successful payment | refused |
| Payment attempt on a void invoice | refused |
| Second warranty for one job | refused |
| Warranty for an incomplete job | refused |
| Reactivating a revoked warranty | refused |
| Revoking a Roof Passport without a reason | refused |
| Reopening a revoked Roof Passport | refused |
| Deleting a payment, warranty, or passport | refused |

Migration `074_payment_warranty_guards.sql` was added because the rehearsal
found real gaps in 072 and 073: payment attempts could attach to a draft or
void invoice, and warranty/passport revocation was not terminal.

Layer: disposable PostgreSQL (GitHub-hosted) plus source assertions. This is
**not** a browser, Supabase Auth/Storage, mobile, or production run.

## Day 28 — backup restore, RLS, Android recovery

`scripts/ci/verify-restore-postgres.sh` takes a custom-format `pg_dump` of the
disposable test database, restores it into a separate database, and asserts:

- row counts match for every production-job table;
- the completed lifecycle job, invoice totals, payment outcome, warranty and
  passport evidence survive the round trip;
- row level security is still enabled on invoices, payments, warranties and
  passports;
- the new payment guard trigger survives restore.

Layer: isolated disposable PostgreSQL. A staging or production restore has
**not** been performed. `staging-backup-verify.yml` remains a manual,
staging-only schema dump/diff workflow; it does not restore anything.

Android recovery and physical-device security remain **untested**: no device is
attached to this environment. Break Glass source and negative tests are
unchanged.

## Day 29 — controlled shop pilot

**Not done.** No shop owner or field user has been onboarded or trained.
Fabricating a trained user would be false evidence. The required prerequisites,
training script, support path, and limitations are recorded in
`docs/evidence/day-29-pilot-readiness.md`.

Blockers for onboarding:

1. Real owner price book and tax provenance (Day 11, Gate 2).
2. Real two-workspace Supabase Auth/Storage run (Gate 1).
3. Physical Android/offline verification (Gate 4).
4. A named shop owner willing to accept the documented limitations.

## Day 30 — go/no-go

Decision: **NO-GO** for customer-facing production use.

`docs/evidence/release-gates.json` records each hard gate. Missing evidence is
`UNKNOWN`, never `PASS`. `scripts/release-gate-summary.mjs` therefore reports
NO-GO. The detailed decision, disabled features, and rollback steps are in
`docs/evidence/day-30-go-no-go.md`.

## Verification commands

```bash
npm run test:production-job-e2e
npm run test:production-job-warranty
npm run test:release-gate-summary
```

CI additionally runs:

```bash
bash scripts/ci/verify-production-job-postgres.sh
bash scripts/ci/verify-restore-postgres.sh
```
