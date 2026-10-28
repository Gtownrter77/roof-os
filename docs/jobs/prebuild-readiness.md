# Prebuild readiness checklist (Day 21)

Migration: `supabase/migrations/068_production_job_readiness.sql`.
Code: `lib/jobs/readiness.ts`,
`app/api/production-jobs/[id]/readiness/route.ts`, `app/jobs/[id]/page.tsx`.

## What this is

One internal checklist per production job, computed on read from evidence that
already exists:

| Check | Source | Ready when |
| --- | --- | --- |
| Approved work order | migration `064` handoff | a recorded acceptance, an accepted total above zero, and at least one approved scope line |
| Deposit | migration `063` deposit ledger | the derived state is `received` or `waived`, with no ledger problem |
| Crew | migration `067` assignments | at least one active assignment and a crew lead |
| Materials | migration `067` material lines | at least one active line and zero still `needed` |
| Permit | migration `068` decision | `issued` or `not_required`, with a server-stamped check |
| Weather | migration `068` decision | `clear`, with a server stamp no older than 24 hours |

`evaluatePrebuildReadiness` returns the six checks, the blockers, and the
deposit, permit, and weather status. It never returns a stored "ready" flag.

## Database rules (migration 068)

1. One row per job (`job_id` is unique).
2. The row workspace must match the job workspace.
3. RLS: members read; owners and admins write; there is no delete policy.
4. The database stamps `permit_checked_at` / `permit_checked_by` and
   `weather_checked_at` / `weather_checked_by`. A client value is overwritten.
5. Restamping happens only when the decision itself changes. Editing a
   reference or a source does not fake a fresh check.
6. Setting a decision back to `unknown` clears both the time and the checker.
7. `job_id`, `workspace_id`, and `created_at` are immutable.
8. `DELETE` is refused with `23514`. Record a new decision instead.

Permit statuses: `unknown`, `not_required`, `needed`, `applied`, `issued`.
Weather decisions: `unknown`, `clear`, `hold`.

## API

- `GET /api/production-jobs/[id]/readiness`: job snapshot, deposit state,
  assignments, materials, the stored decisions, the computed checklist, and
  `can_edit`. Member-readable and workspace-scoped. A foreign job is `404`.
- `PATCH /api/production-jobs/[id]/readiness`: `set_permit` or `set_weather`.
  Owner/admin only. A completed or cancelled job returns `409`.
- `permit_reference` is required for `needed`, `applied`, and `issued`.
  `weather_source` is required whenever the weather is checked.

The route writes only `production_job_readiness`. It never touches the handoff
snapshot, the deposit ledger, the schedule tables, or any customer record.

## Weather freshness

Clear weather is only evidence while it is fresh. `WEATHER_FRESHNESS_MS` is
24 hours. A clear decision at exactly 24 hours is still accepted; one
millisecond older is stale and blocks the job. A missing or unparsable stamp is
treated as no evidence, never as fresh. A future stamp is clamped to zero age.

The evaluator takes `now` as a parameter, so tests have no hidden clock.

## What this is not

- Not a live permit-office lookup. The permit decision is a human entry.
- Not a live weather-provider call. The source is a recorded note.
- Not proof that Gate 3 is closed. A green checklist is a local computation
  over recorded rows.
- Not a deposit charge, a payment, a crew commitment, or a purchase order.
- No email, SMS, customer contact, insurer submission, or export.

## Evidence boundaries

| Layer | Evidence | Result |
| --- | --- | --- |
| Helpers | `npm run test:production-job-readiness` | PASS — six checks, blockers, deposit/waiver/problem cases, crew lead, needed material, permit enum, 24h weather boundary, no input mutation |
| Source contracts | same test | PASS — admin-gated writes, no delete, server-stamped checks, no other ledger write, no outbound call, no Gate 3 claim |
| PostgreSQL | `scripts/ci/production-job-readiness-assertions.sql` via `migration-safety` | Member write denial, owner write, server stamps, reference edit does not restamp, `unknown` clears stamps, one row per job, immutability, no delete, cross-workspace denial, handoff unchanged; the PR check reports the real result |
| Supabase Auth/API | Not run | **Not tested** |
| Browser | Not run | **Not tested** |
| Production | Not deployed, not migrated | **Not touched** |

The database assertions run on the disposable local PostgreSQL database
`roofos_job_ci`. They are not a production or Supabase Auth test.
