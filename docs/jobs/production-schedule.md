# Production job schedule: crew and materials (Day 20)

Migration: `supabase/migrations/067_production_job_schedule.sql`.
Code: `lib/jobs/schedule.ts`, `app/api/production-jobs/route.ts`,
`app/api/production-jobs/[id]/schedule/route.ts`,
`app/jobs/page.tsx`, `app/jobs/[id]/page.tsx`.

## What this is

Operational planning for one production job:

- crew assignments (`production_job_assignments`), and
- material lines (`production_job_materials`).

Both hang off the immutable handoff from migration `064`. They describe who
works when and which material is needed. They do not change the accepted
customer, amount, scope, or warranty.

## Database rules

### Assignments

1. The job must exist.
2. The row workspace must match the job workspace.
3. The assigned person must be a member of that workspace.
4. `scheduled_end` must be after `scheduled_start`.
5. A new row always starts `scheduled`; the server owns that status.
6. `scheduled` to `confirmed` or `cancelled`; `confirmed` to `cancelled`.
7. Source fields are immutable: workspace, job, member, role, window, creator.
8. `DELETE` is refused. Cancel the row instead.

### Materials

1. The job must exist.
2. The row workspace must match the job workspace.
3. An optional `line_item_id` must belong to the job's own approved estimate
   scope.
4. A new row always starts `needed`; the server owns that status.
5. `needed` to `ordered` or `cancelled`; `ordered` to `delivered` or
   `cancelled`.
6. Source fields are immutable: workspace, job, scope link, description,
   quantity, unit, creator.
7. `DELETE` is refused. Cancel the row instead.

### Access

| Action | Member | Owner/admin |
| --- | --- | --- |
| Read assignments and materials | yes | yes |
| Add or update a row | no | yes |
| Delete a row | no | no (no delete policy, trigger refuses) |

RLS enforces this. The API checks the same role and returns `403` before it
writes.

## API

- `GET /api/production-jobs`: workspace-scoped list, member-readable, `limit(100)`.
- `GET /api/production-jobs/[id]/schedule`: job snapshot, assignments, materials,
  workspace members, `can_edit`, and a planning readiness summary.
- `POST /api/production-jobs/[id]/schedule`: `add_assignment` or `add_material`.
  Owner/admin only. A completed or cancelled job returns `409`.
- `PATCH /api/production-jobs/[id]/schedule`: `set_assignment_status` or
  `set_material_status`. The route checks the same transition the trigger
  enforces. An invalid move returns `409`.

Every write is scoped by `id`, `workspace_id`, and `job_id`. A foreign job
returns `404`.

## Planning readiness

`summarizeSchedule` reports:

- active assignments,
- whether a crew lead is assigned,
- materials needed / ordered / delivered,
- `crew_scheduled`, and
- `materials_all_delivered`.

These are planning signals. They do **not** close the Day 21 prebuild readiness
gate. A crew can be scheduled and material can be delivered while a deposit,
permit, or weather check still blocks the job. See
[prebuild-readiness.md](./prebuild-readiness.md) for the checklist that does
block it.

## What this is not

- Not a purchase order. Adding a material line orders nothing.
- Not a crew commitment, dispatch, or calendar confirmation.
- Not a readiness gate, permit check, weather check, or deposit check.
- No automatic email, SMS, insurer, or customer contact.
- No change to the accepted amount or approved scope.

## Evidence boundaries

| Layer | Evidence | Result |
| --- | --- | --- |
| Helpers | `npm run test:production-job-schedule` | PASS — labels, transitions, window validation, readiness counts |
| Source contracts | same test | PASS — admin-gated writes, no delete, immutable source, handoff untouched |
| PostgreSQL | `scripts/ci/production-job-schedule-assertions.sql` via `migration-safety` | Owner-only writes, member reads, outsider denial, window guard, immutability, no delete, scope link, snapshot unchanged; the PR check reports the real result |
| Supabase Auth/API | Not run | **Not tested** |
| Browser | Not run | **Not tested** |
| Production | Not deployed, not migrated | **Not touched** |

The database assertions run on a disposable local PostgreSQL database
(`roofos_job_ci`). They are not a production or Supabase Auth test.
