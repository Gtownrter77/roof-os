# ROOF/OS Owner Operating Cadence

This cadence converts the owner checklist into repeatable operating routines. The owner should assign a backup administrator and use the same time windows every week so reviews do not depend on memory.

## Daily routine

**Recommended time:** 8:00–8:20 AM and 4:30–4:45 PM on business days.

| Time | Action | Completion evidence |
| --- | --- | --- |
| Morning | Review new leads and assign an owner | No active lead is unassigned |
| Morning | Review today’s appointments and travel addresses | Each appointment has a time, location, and responsible user |
| Morning | Review overdue tasks and create next actions | No overdue item is left without a decision |
| Morning | Review failed or queued photo uploads | Failed uploads have an owner and recovery plan |
| Afternoon | Review new status changes and activity notes | Every status change has an understandable business reason |
| Afternoon | Confirm tomorrow’s inspections and customer communications | Field users know their first appointment and address |
| Close | Check agent runs for failed or `needs_review` records | Failures are corrected or explicitly deferred |

The owner should not attempt to read every activity note. The daily review should focus on exceptions: unassigned leads, overdue tasks, failed uploads, incomplete inspections, and agent errors.

## Weekly routine

**Recommended time:** Friday afternoon or Monday morning, 45–60 minutes.

1. Review leads by status. Identify leads that have remained in the same status longer than the company standard.
2. Review lost leads and record the reason for loss. Separate pricing, timing, competition, no-contact, and unqualified reasons.
3. Review unassigned appointments, tasks, and inspection sessions.
4. Review inspection quality failures. Confirm required photo categories and captions are being used consistently.
5. Review the `agent_runs` table. Look for repeated failures, duplicate actions, unexpected assignments, or outputs awaiting approval.
6. Review workspace memberships. Remove people who no longer need access.
7. Review photo storage volume and failed uploads.
8. Confirm that the office and field teams use the same lead status vocabulary.
9. Select one completed lead and trace it from creation through appointment, inspection, activity, follow-up, and final outcome.
10. Record three operational improvements for the next week.

The weekly meeting should produce a short written decision log. Store it as an owner activity note or a separate internal document rather than leaving it as an informal conversation.

## Monthly routine

**Recommended time:** First business day of each month, 60–90 minutes.

| Area | Monthly review |
| --- | --- |
| Access | Review every workspace member, role, and last-known responsibility |
| Security | Confirm private Storage, RLS policies, redirect settings, and no secret exposure |
| Data | Confirm backups/exports, retention rules, and migration versions applied |
| Operations | Review lead conversion, response time, inspection completion, and follow-up completion |
| Automation | Review agent success/failure rates and disable rules that create noise |
| Product | Test lead creation, appointment creation, navigation, photo upload, and export using a non-production record |
| Deployment | Review GitHub commits, Vercel deployment status, dependency alerts, and Expo credentials |
| Field | Verify at least one Android phone and one tablet can open the current field build |
| Commercial | Review storage usage, user count, customer support process, and data export readiness |

The owner should archive the monthly review with the date, reviewer, findings, corrective actions, and responsible person. A recurring problem should become a product issue or documented process change.

## Release routine

Before any production web deployment or APK distribution:

1. Create or confirm a clean Git branch.
2. Run `npm run build`, `npx tsc --noEmit`, and `git diff --check`.
3. Run `cd apps/field && npx tsc --noEmit && npx expo config --type public`.
4. Review all SQL migration files and confirm the target Supabase project has the required migration versions.
5. Test login, lead creation, status update, activity note, appointment, navigation, and photo flow with non-production records.
6. Test a second workspace cannot read or mutate the first workspace’s data.
7. Test the field camera on a real device and confirm the navigation link opens the expected destination.
8. Review agent-run errors and disable any automation that has not passed human review.
9. Record the commit hash, deployment URL, build version, test result, and rollback plan.
10. Update `HANDOFF.md` and the owner manual when the release changes operational behavior.

## Escalation rules

The owner should stop normal operations and escalate when a user can see another workspace’s data, when a private photo is publicly accessible, when an agent sends an unapproved external message, when an APK is distributed without a known source commit, or when a migration fails partway through execution.

For a security incident, disable affected automation, revoke compromised credentials, preserve logs, restrict affected users, and do not delete evidence before the incident has been documented.
