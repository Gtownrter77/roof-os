# ROOF/OS Owner Manual

**Product:** ROOF/OS roofing operations platform  
**Audience:** Company owner, administrator, office manager, production manager, estimator, field representative, inspector, and crew lead  
**Current web site:** <https://roof-os-lemon.vercel.app>  
**Source repository:** <https://github.com/Gtownrter77/roof-os>

## 1. Purpose and product boundaries

ROOF/OS is designed as a two-surface operating system for a roofing company. The desktop web application is the company control plane. It is intended for pipeline oversight, administration, scheduling, reporting, configuration, and team coordination. The mobile field application is intended for fast work at a property. It is designed around the camera, lead address, appointment, inspection evidence, follow-up, and communication.

The current project is a production-oriented foundation and field-app pilot. It is not yet a fully released commercial SaaS product. The most important external prerequisite is applying the Supabase migrations to the target project and completing cross-workspace security tests. The Android APK source and EAS build profile are present, but an Expo account or `EXPO_TOKEN` is required to produce the signed APK.

| Capability | Current state | Owner action |
| --- | --- | --- |
| Web login and Supabase Auth | Implemented | Configure and test the Supabase project |
| Leads and lead status updates | Implemented in source | Apply migrations and verify RLS |
| Activity notes | Implemented in source | Test with multiple workspace users |
| Private inspection Storage | Migration and client flow prepared | Apply migration and test upload isolation |
| Lead navigation | Implemented | Use Google Maps or OpenStreetMap buttons |
| Appointments and follow-ups | UI and migration prepared | Apply migration 004 |
| Expo field app | Initial camera-first shell | Complete Auth, sync, inspection, and upload slices |
| Android APK | EAS profile configured | Authenticate to Expo and run the build |
| Automation agents | Architecture and database foundation | Implement workers or Edge Functions |
| Level 3 security verification | Pending | Run the manual SQL and isolation tests |

## 2. Owner responsibilities

The owner controls the company workspace, users, workflow rules, data retention, billing decisions, and external service credentials. The owner should appoint at least one backup administrator before the company begins relying on the application for production work.

The owner is responsible for ensuring that every user has an individual account. Shared logins should not be used because they make activity history, photo ownership, and permission auditing unreliable. The owner should remove former employees promptly and review workspace memberships monthly.

The owner should define the company’s lead status vocabulary, inspection photo categories, approval rules, follow-up standards, and retention policy before turning on automation. Automation should assist the staff, not silently make binding customer, financial, or legal decisions.

## 3. First-time setup

### 3.1 Confirm the web deployment

Open the production URL in a desktop browser. The expected public route is the login page. Protected routes should redirect unauthenticated visitors to `/auth/login`.

Create an account using the Supabase email flow. If the confirmation email does not arrive, check the spam folder and verify that the Supabase Site URL and redirect allowlist contain the production Vercel URL.

### 3.2 Configure Supabase

The current project uses Supabase project reference `xksumagfbegdlapwysps`. The browser application uses the publishable key. Never place a database password or service-role key in the browser, GitHub, `.env.local`, or an APK configuration that is visible to users.

Open the Supabase project SQL Editor and execute the migrations in this order:

```text
supabase/migrations/001_leads.sql
supabase/migrations/002_workspaces_activity_storage.sql
supabase/migrations/003_status_history_inspection_photos.sql
supabase/migrations/004_appointments_tasks.sql
supabase/migrations/005_default_automation_agents.sql
```

The migrations are intended to be applied in numeric order. Migration 002 creates workspaces, memberships, activity records, workspace-aware lead access, and the private inspection-photo bucket. Migration 003 adds status history, inspection sessions, photo metadata, and related RLS policies. Migration 004 adds appointments, tasks, automation rules, and agent-run audit records. Migration 005 seeds the four default agent configurations and creates deterministic lead-assignment and follow-up task triggers.

Use the [manual migration guide](SUPABASE-MANUAL-MIGRATION.md) for the detailed SQL Editor process. After each migration, inspect the SQL Editor result and confirm that it completed without an error.

### 3.3 Verify the workspace

Create a test owner account and confirm that a workspace and owner membership are created. Confirm that the owner can read the workspace and membership. Create a second test account in a separate workspace.

The first test user must be able to create and read a lead. The second test user must not be able to read, update, delete, or download the first user’s lead, activity, appointment, task, inspection session, photo metadata, or Storage object.

Delete test accounts only after recording the results of the security checks. Do not use real customer data until the isolation checks pass.

## 4. Roles and permissions

| Role | Recommended responsibilities | Access principle |
| --- | --- | --- |
| Owner | Workspace settings, users, billing, exports, all operational records | Full workspace administration |
| Admin | Office operations, leads, appointments, reports, assignments | Broad operational access without ownership changes |
| Member | Sales, inspection, notes, assigned jobs, photos | Work only within the workspace and assigned responsibilities |
| Crew lead | Assigned work orders, checklists, directions, photos, completion notes | Minimal field execution access |

The current database model provides owner, admin, and member membership roles. A commercial release should add explicit crew permissions and feature-level role checks. Until then, use separate workspace memberships and operational procedures to limit access.

## 5. Daily desktop workflow

### 5.1 Start-of-day review

Open the dashboard and review new leads, overdue tasks, today’s appointments, failed photo uploads, and status changes from the prior day. Open the calendar and confirm that inspection and follow-up times do not conflict.

Assign each unowned lead to a responsible user. Every lead should have a next action. A lead without a next action is considered operationally stalled.

### 5.2 Create a lead

Open **Leads** and choose **New lead**. Enter the customer name, property address, phone number, email address, source, and initial note. Use a complete property address because the address powers navigation and becomes the location used by future appointments.

Save the lead. Confirm that it appears in the lead list and that the status is `new`. Add an activity note if the lead came from a call, referral, storm campaign, or website form.

### 5.3 Update lead status

Use the status selector on the lead record. The supported vocabulary is:

```text
new
assigned
qualified
inspection_scheduled
inspected
report_pending
report_approved
won
lost
```

Change the status only when the underlying business event has occurred. The change should produce an activity event and, after migration 003 is applied, a durable `lead_status_history` record. Do not use status changes as private notes.

### 5.4 Add an activity note

Open the activity section for the lead. Write one factual note per event. Include the contact method, date, customer request, decision, and next action when applicable.

Good note:

> Spoke with customer by phone. Customer approved inspection for Thursday at 9:00 AM. Confirm ladder access and send arrival message the day before.

Avoid vague notes such as “talked to customer” because they do not help the next employee continue the work.

### 5.5 Navigate to a lead address

On a lead card, choose **Navigate Google** to open Google Maps directions. Choose **Navigate OpenStreetMap** to use the open map fallback. These buttons use web deep links and do not require a Google Maps API key.

If the route is incorrect, correct the lead address before driving. Do not rely on a map result to correct an incomplete or misspelled customer address.

### 5.6 Schedule an appointment or follow-up

Open **Calendar**. Enter a title, appointment type, start time, location, and notes. The appointment types are inspection, meeting, follow-up, review, delivery, and other.

Use the lead address as the location for an inspection. Use the customer’s preferred contact method and the expected outcome in the notes. Save the appointment and confirm that it appears in the upcoming list.

Use **Export .ics** to download a calendar event. Import the file into Google Calendar, Apple Calendar, Outlook, or another calendar application. The `.ics` file is a portable event export; it does not create a two-way calendar synchronization.

For a quick follow-up, use **Add 7-day follow-up** from the lead card. This downloads an event scheduled seven days in the future at 9:00 AM. Adjust the event in the receiving calendar if the customer requires a different time.

## 6. Field workflow on a phone or tablet

### 6.1 Install the field app

The field app is an Expo/React Native Android project under `apps/field`. A signed APK is produced through Expo Application Services.

An owner or release manager must authenticate to Expo before creating the APK:

```bash
cd apps/field
npx eas login
npx eas build --platform android --profile preview
```

The build profile produces an internal distribution APK. Download the resulting APK from the EAS build page and distribute it only to approved company users during the pilot. Use a production app bundle for public Google Play distribution after store assets, privacy documentation, signing, and release testing are complete.

### 6.2 First launch

Open the app and grant camera access when prompted. Grant location access only when the app has a location-based feature enabled and the employee understands why it is needed. Do not grant permissions permanently to an app build that has not passed the security and privacy review.

The initial field shell presents a **Today**-style screen with a prominent inspection action, photo count, navigation, and checklist. The shell is a pilot foundation. The production field release must add Supabase Auth, real workspace membership, inspection persistence, offline queueing, and private Storage uploads.

### 6.3 Navigate to the property

Enter the job address in the field app and choose **Open Google Maps directions**. Confirm the destination before starting the route. Do not use the app while driving.

### 6.4 Capture inspection evidence

Choose **Open camera**. Capture wide context photos before close-up damage photos. Photograph each roof elevation, visible damage, penetrations, flashing, gutters, vents, siding, windows, doors, access constraints, and relevant landscaping.

Use one photo for one purpose whenever possible. Add a caption that states what the image proves. The planned production workflow organizes evidence into albums such as Before, Damage, Measurements, Materials, Work in progress, and Completed.

Do not photograph unrelated people, documents, payment cards, or private information unless the company’s policy requires it and the customer has been informed.

### 6.5 Complete the inspection checklist

Confirm the customer and property. Capture the roof elevations and relevant deficiencies. Add notes and the next action. Review the photo count and upload status before leaving the property.

If connectivity is weak, do not delete the local draft. The production architecture uses SQLite for durable drafts and an upload queue. The current shell demonstrates camera capture but does not yet represent the completed offline synchronization release.

### 6.6 Close the field visit

Before leaving, confirm that the correct property is selected, that required categories are documented, and that the next office action is clear. If a follow-up appointment is needed, create it from the desktop calendar during the pilot or from the mobile appointment workflow after it is implemented.

## 7. Automation agents

ROOF/OS defines four bounded agents. Each agent must have a workspace, event key, status, input reference, output, and error record in `agent_runs`.

| Agent | Primary job | Human approval required |
| --- | --- | --- |
| Intake and Lead Router | Normalize leads, detect duplicates, assign owner, create first-response task | Required for uncertain duplicate merges or unusual assignments |
| Scheduler and Follow-up Coordinator | Suggest appointments, reminders, and overdue tasks | Required before external rescheduling or customer communication |
| Inspection Quality Agent | Check categories, captions, failed uploads, duplicates, and incomplete checklists | Required before rejecting an inspection or contacting a customer |
| Office Copilot and Report Agent | Draft summaries, deficiencies, missing-data lists, and reports | Required before sending, signing, approving, or submitting anything |

The first release should implement deterministic rules for Agents 1–3. Those rules are free to run and easier to audit. A local open-source model such as Ollama can later assist with extraction and summarization. A self-hosted model still requires persistent compute, memory, monitoring, and model updates.

Agents must not send customer messages, approve estimates, sign contracts, submit payments, or change security permissions without an explicit human approval step. The owner should review agent runs weekly during the pilot and disable an agent immediately if it produces repeated incorrect assignments or summaries.

## 8. Security and data protection

Keep the Supabase publishable key in the production environment configuration. It is designed for browser use when RLS policies are correct. Never expose the Supabase service-role key, database password, JWT signing secret, or private integration token.

Keep the inspection-photo bucket private. The object path should use the following structure:

```text
<workspace_id>/<user_id>/<inspection_id>/<photo_id>.<extension>
```

Use signed URLs when displaying private files. Do not paste permanent public image URLs into customer messages.

Review workspace memberships monthly. Remove former employees immediately. Rotate any credential that may have been exposed. Keep `.env.local`, generated `.next` output, local SQLite files, and device logs out of GitHub.

Use the minimum necessary personal information. Establish a retention period for inspection photos, customer contact information, documents, and activity history. Provide an export and deletion procedure before selling the product to external companies.

## 9. Backup and recovery

The source of truth for application code is the GitHub repository. The source of truth for production data is Supabase. A ZIP of the source code is not a database backup.

The owner should maintain:

- A GitHub repository with protected `main` branch access.
- A record of Supabase migration versions applied to production.
- Periodic Supabase database exports or provider backups.
- A list of Vercel environment variable names without secret values.
- An inventory of Expo project ownership and build credentials.
- A documented process for exporting customer records and inspection photos.

After a recovery, apply migrations in order, restore environment variables, verify Auth redirects, verify RLS isolation, verify private Storage access, and test a complete lead-to-inspection workflow before reopening the product to users.

## 10. Troubleshooting

| Symptom | Likely cause | Corrective action |
| --- | --- | --- |
| Login loops back to sign-in | Supabase URL or redirect allowlist is incorrect | Confirm the Vercel URL and `/auth/callback` are allowed |
| Leads do not load | Migration not applied, expired session, or RLS mismatch | Check browser console, session, migration status, and workspace membership |
| Appointment page shows a table error | Migration 004 has not been applied | Run `004_appointments_tasks.sql` after migrations 001–003 |
| Photo upload is denied | Storage bucket or object-path policy is missing | Apply migration 002 and verify the first path segment is the workspace ID |
| User sees another workspace’s data | RLS policy or workspace assignment is incorrect | Stop using real data, inspect membership and policies, and repeat isolation tests |
| Google navigation opens the wrong property | Lead address is incomplete or incorrect | Correct the lead address and retry navigation |
| `.ics` file does not import | Calendar application rejected the event format | Re-download the event, verify the device date/time, and import manually |
| APK build stops at Expo authentication | No Expo account session or token | Run `npx eas login` or configure `EXPO_TOKEN` |
| Agent repeats the same action | Missing event-key uniqueness or retry state | Verify `agent_runs` uniqueness and idempotency handling |
| Agent output is unsafe or incorrect | Human approval boundary is missing | Disable the agent, review runs, correct the rule, and require approval |

## 11. Owner operating checklist

### Daily

Review new leads, overdue tasks, today’s appointments, failed uploads, and status changes. Confirm that every active lead has an owner and next action.

### Weekly

Review lost leads, unassigned work, inspection quality failures, agent runs, workspace membership, and photo storage usage. Confirm that office and field staff are following the same status vocabulary.

### Monthly

Review user access, data retention, backups, migration state, deployment history, dependency alerts, Expo credentials, and customer-facing workflows. Test a lead creation, appointment, navigation, photo upload, and export path with a non-production record.

See [OPERATING-CADENCE.md](OPERATING-CADENCE.md) for recommended time windows, completion evidence, weekly decision logging, monthly review controls, and the release routine.

### Before a major release

Run the web build, TypeScript check, diff check, Expo type check, configuration check, migration review, browser route test, mobile camera smoke test, offline recovery test, and cross-workspace isolation test. Do not release an APK or web deployment that depends on an unapplied database migration unless the affected feature is disabled.

## 12. Current project commands

From the repository root:

```bash
npm ci
npm run build
npx tsc --noEmit
git diff --check
```

For the field app:

```bash
cd apps/field
npm install
npx tsc --noEmit
npx expo config --type public
npx eas login
npx eas build --platform android --profile preview
```

For a production Android store build:

```bash
cd apps/field
npx eas build --platform android --profile production
```

For local mobile development:

```bash
cd apps/field
npm start
```

The local development server is useful for Expo Go and development clients. It is not a production deployment and does not replace an EAS-signed release build.

## 13. Release readiness status

The product is ready for continued development and controlled pilot work. It is not ready to be marketed as a fully complete commercial field platform until the following items are complete:

1. Apply and verify Supabase migrations 001 through 005.
2. Complete authenticated CRUD and cross-workspace RLS tests.
3. Add real mobile Supabase Auth and workspace-aware data access.
4. Implement SQLite inspection drafts and upload queue recovery.
5. Link the mobile camera to `inspection_sessions`, `inspection_photos`, and private Storage.
6. Verify the seeded deterministic automation workers and review their audit records.
7. Authenticate to Expo and produce a tested APK.
8. Run device tests on representative Android phones and tablets.
9. Add crash reporting, privacy policy, support contact, data export, and retention controls.
10. Re-run Level 1, Level 2, and Level 3 verification before selling access to external companies.

## References

[1]: https://supabase.com/docs/guides/database/postgres/row-level-security "Supabase Row Level Security"
[2]: https://supabase.com/docs/guides/storage/security/access-control "Supabase Storage Access Control"
[3]: https://docs.expo.dev/build/introduction/ "Expo Application Services Build Introduction"
[4]: https://docs.expo.dev/build-reference/apk/ "Expo APK Build Documentation"
[5]: https://docs.expo.dev/versions/latest/sdk/imagepicker/ "Expo ImagePicker Documentation"
[6]: https://www.openstreetmap.org/ "OpenStreetMap"
[7]: https://www.google.com/maps "Google Maps"
