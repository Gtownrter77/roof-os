# Day 29 — controlled shop pilot readiness

Status: **NOT ONBOARDED**. No shop owner or field user has been trained. This
document is a prerequisite and support plan, not evidence of training.

## Why the pilot has not started

| Requirement | Status |
| --- | --- |
| Real owner price book and tax provenance | Missing (Day 11) |
| Real two-workspace Supabase Auth/Storage run | Missing credentials (Gate 1) |
| Physical Android capture, offline reopen, private sync | No device attached (Gate 4) |
| Real staging restore and schema parity | Not run |
| Named shop owner accepting the limitations below | Not supplied |

## Required before the first pilot user

1. Owner signs off on the price book and tax source.
2. Two synthetic users complete login, tenant isolation, and storage in a real
   Supabase project.
3. One Android device completes capture, offline reopen, and sync without
   duplicate uploads.
4. A staging restore is performed and its row/evidence checks pass.
5. A named shop owner and one field user are identified.
6. Support contact, escalation path, and data-deletion path are confirmed.

## Training script for the pilot session

1. Sign in and confirm the workspace name; confirm the second workspace is not
   visible.
2. Create or open a lead; record the inspection appointment and next action.
3. Open the priced estimate; confirm the owner approval, then record customer
   acceptance with the actual method used. Explain that this is not an
   e-signature.
4. Confirm one production job appears with the accepted amount and scope.
5. Add a crew assignment and material line; set permit and weather decisions.
6. Add a daily field update and request a change order; approve it as the owner.
7. Record a punch item, resolve it, then record the supervisor closeout.
8. Move the job to completed; confirm the completion refusal when a critical
   item is open.
9. Create the invoice draft, issue it, and record a manual receipt as a payment
   attempt. Confirm the invoice totals do not change.
10. Issue the warranty and generate the Roof Passport; revoke the passport with
    a reason and confirm it cannot be reopened.
11. Show the support path and how to report a defect.

## Support path

- Primary contact: owner-designated support channel (to be named before
  onboarding).
- Severity 1 (cannot sign in, cross-tenant data, wrong customer visible):
  stop use immediately, capture the workspace and user id, contact the owner.
- Severity 2 (cannot complete a job or invoice): use the manual fallback and
  report the exact step.
- Severity 3 (cosmetic or wording): report through the normal channel.
- No support process may ask a pilot user to share a password, service-role key,
  or customer payment details.

## Known limitations to state to the pilot user

- No e-signature; acceptance is a recorded statement only.
- No Stripe or automatic payment capture; payments are audit records.
- No insurer submission and no ESX generation or parity claim.
- No automatic warranty creation from Office Copilot or Agent 4.
- Roof Passport is internal documentation, not an insurer document and not proof
  of warranty.
- No autonomous agents, God Mode, drone automation, or public iOS launch.
- Physical offline behavior is not yet verified; do not rely on it.
- Reports are internal review copies; they are not external submissions.

## Exit criteria for Day 29

Recorded training for one named owner and one named field user, a completed
clean-path job, one deliberately triggered exception, and a support contact.
Until then, Day 29 remains open.
