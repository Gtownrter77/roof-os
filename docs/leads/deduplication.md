# Lead deduplication

Migration: `supabase/migrations/061_lead_deduplication.sql`.

## Rule

One phone number identifies one lead inside a workspace. `(555) 010-2000`,
`555.010.2000` and `5550102000` are the same number.

- The check runs in the database (`prevent_duplicate_lead` trigger), so two devices cannot create the same prospect at the same time.
- The guard is scoped to `workspace_id`; the same number is allowed in a different workspace.
- A lead with no phone, or fewer than 10 digits, is never blocked.
- An update that would move an existing lead onto another lead's number is also blocked.
- `pg_advisory_xact_lock` serialises inserts per workspace.

## Deliberate duplicate

If the office decides a duplicate is correct, force it inside the same transaction:

```sql
select set_config('roofos.allow_duplicate_lead', 'on', true);
-- insert the lead here
```

The setting is transaction-scoped and is not a permanent bypass.

## User experience

`app/leads/new/page.tsx` turns the database error into a plain message and an
**Open existing leads** button. A raw database error is never shown for this case.

## Evidence boundaries

- Source contract: `npm run test:lead-dedup`.
- PostgreSQL trigger/RLS: `scripts/ci/verify-lead-dedup-postgres.sh` in the `migration-safety` job, using a dedicated disposable database.
- Supabase Auth/API and production data: **not tested**.
- Historic duplicate rows are not deleted or merged by this migration.
