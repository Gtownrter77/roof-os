# Qualification → inspection appointment (Gate 1 prep)

Migration: `supabase/migrations/062_inspection_appointment_gate.sql`.

## Rule

An inspection appointment is the handoff from a qualified lead to the field.
The database, not the browser, performs the handoff.

Creating an `appointment_type = 'inspection'` row that references a lead now:

1. Refuses the insert when the lead is not `qualified` or `inspection_scheduled`.
2. Refuses the insert when the appointment workspace differs from the lead workspace.
3. Refuses a second `scheduled` inspection for the same lead.
4. Assigns the appointment to the given `assigned_to`, or to `created_by` when it is empty.
5. Refuses an assignee who is not a member of the workspace.
6. Moves the lead to `inspection_scheduled`.
7. Sets one next action: `Complete inspection`, due at the appointment start, owned by the assignee.

Calendar entries without a `lead_id` are not affected.

## UI

`app/leads/[id]/page.tsx`:

- shows the active inspection, its start time, location and assignee;
- keeps the booking disabled until the lead is qualified;
- explains the qualification and duplicate cases instead of surfacing a raw database error;
- writes only the appointment and the activity entry; lead status and next action come from the trigger.

## Evidence boundaries

- Source contract: `npm run test:inspection-appointment`.
- PostgreSQL trigger/RLS: `scripts/ci/verify-inspection-appointment-postgres.sh` in the `migration-safety` job, on a dedicated disposable database.
- Supabase Auth/API: **not tested**.
- Physical device: **not tested**. Day 8 owns Android capture.
- Production: untouched.

## Gate 1 status

| Gate 1 item | Status |
| --- | --- |
| Authenticated login path | Source-verified; live Supabase session not exercised |
| Owner-only Break Glass | Negative coverage merged (#344); live session not exercised |
| Migration 059 on disposable PostgreSQL | Merged and green (#340) |
| Real two-workspace Supabase Auth/Storage | **Blocked** — no Supabase credentials in this environment |
| All required GitHub checks | Per-PR checks required and enforced |

Gate 1 is **not fully closed** until the two-workspace Supabase Auth/Storage test runs with credentials.
