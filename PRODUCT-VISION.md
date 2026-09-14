# ROOF/OS Sellable Product Blueprint

**Status:** Product direction and implementation roadmap

## Executive conclusion

ROOF/OS should become a two-surface roofing operations product. The **desktop application** should remain the system of record for company administration, production scheduling, estimating configuration, reporting, financial visibility, integrations, and team oversight. A dedicated **field application for phones and tablets** should optimize the fast, intermittent, camera-heavy work performed at a property or job site.

This split follows the strongest pattern in AccuLynx’s current product description. Its Field App emphasizes leads, tasks, appointments, job files, estimates, communications, calls, notes, milestones, and photo workflows. Its web application retains the production calendar and detailed company reporting.[1]

ROOF/OS should reproduce the underlying workflow capabilities, not AccuLynx’s branding, proprietary code, visual identity, or text. The product should differentiate through faster inspection capture, stronger offline behavior, clearer evidence organization, and a simpler first-run experience for small roofing companies.

## Product surfaces

| Surface | Primary user | Job to be done | Design priority |
| --- | --- | --- | --- |
| Desktop web app | Owner, office manager, estimator, production manager | Run the company and control the pipeline | Density, keyboard speed, reporting, permissions |
| Field app | Sales rep, inspector, project manager, crew lead | Capture evidence and move a job forward from the property | Camera-first workflow, offline reliability, minimal typing |
| Customer portal | Homeowner or property contact | Review status, documents, photos, approvals, and messages | Clarity, trust, mobile responsiveness |

The field app should be a responsive mobile experience at minimum and should mature into a distributable iOS and Android application. A Progressive Web App can provide the first pilot because it reduces distribution friction. A React Native/Expo application is the stronger commercial path when background upload, offline queues, push notifications, camera controls, geolocation, and app-store distribution become requirements.

## Field-app feature set

### 1. Today screen

The first screen should show today’s appointments, assigned inspections, overdue tasks, weather warnings, pending uploads, and a prominent **Start inspection** action. It should support large touch targets and one-handed use.

### 2. Lead and appointment capture

A field user should be able to create a lead, add contact details, save the property address, schedule an appointment, assign the appointment, and add a call or visit note. The form should support address lookup and should preserve drafts when connectivity is poor.

### 3. Inspection capture

An inspection should be a guided sequence rather than a generic camera screen. The first release should support:

| Capture group | Required capability |
| --- | --- |
| Exterior | Roof planes, elevations, gutters, vents, flashing, siding, windows, doors, driveway, landscaping, and access constraints |
| Evidence | Photo, timestamp, location when permitted, caption, category, and inspection note |
| Deficiency | Severity, description, recommended action, and linked photos |
| Measurements | Manual dimensions first; provider integrations later |
| Completion | Checklist, customer summary, next action, and sync state |

The app should allow rapid multi-photo capture, retain the original image, generate a thumbnail, support annotations, and upload in the background. Each image should carry an album/category and a stable inspection reference.

### 4. Photo management

AccuLynx emphasizes capture, annotation, albums, filtering/search, and sharing.[1] ROOF/OS should implement these capabilities with a more explicit evidence model:

- Albums such as **Before**, **Damage**, **Measurements**, **Materials**, **Work in progress**, and **Completed**.
- On-image arrows, rectangles, text labels, and blur/redaction.
- Captions and voice-to-note transcription.
- Duplicate detection and upload retry.
- Offline queue with visible progress.
- Private workspace-scoped Storage policies.
- Shareable, time-limited customer or adjuster links instead of public bucket access.

### 5. Job communication and activity

The field app should provide a job timeline containing status changes, notes, calls, appointments, tasks, messages, uploads, and approvals. The user should be able to log a call, write a note, assign a task, mention a teammate, and mark an action complete without returning to the desktop.

### 6. Sales actions

The first sellable release should let a field user review a lead, create or edit an estimate from a template, show line items and allowances, capture customer approval, and schedule the next step. More advanced capabilities can add material pricing, financing, proposal packets, digital signatures, and aerial measurement ordering.

### 7. Crew mode

A crew-oriented role should expose only the information needed to execute work: scheduled jobs, directions, work orders, site instructions, checklists, check-in/check-out, photos, messages, and completion notes. AccuLynx describes these as core crew workflows, including bilingual use.[2] ROOF/OS should include English and Spanish labels for crew mode in the commercial roadmap.

## Desktop feature set

The desktop system should be the control plane for:

- Pipeline and lead management.
- Full customer and property records.
- Production calendar and capacity planning.
- Estimate templates, price books, margins, and approval rules.
- Job milestones and company-wide checklists.
- Photo, document, and inspection search.
- Material orders and supplier integrations.
- Payments, balances, commissions, and profitability.
- Reporting, exports, audit logs, and workspace administration.
- Team roles, permissions, invitations, and subscription billing.

The desktop interface should support dense tables, bulk actions, filters, saved views, keyboard shortcuts, and reporting dashboards. It should not simply mirror the mobile navigation.

## Recommended architecture

### Applications

- **Web:** Continue the Next.js desktop app for the main ROOF/OS system.
- **Mobile:** Create a separate Expo/React Native application using the same Supabase project and shared TypeScript domain types.
- **Shared package:** Define status enums, validation schemas, photo metadata, activity types, and permission constants in a shared package.

### Backend

- Supabase Auth for identity.
- Supabase Postgres for workspaces, memberships, leads, properties, inspections, activities, appointments, tasks, estimates, documents, and billing records.
- Supabase Storage for private original photos, thumbnails, documents, and generated reports.
- Row-level security based on workspace membership and role.
- Edge Functions for signed share links, image processing, notifications, measurement-provider requests, payment webhooks, and report generation.
- Background sync queues for mobile mutations and uploads.

### Core entities

| Entity | Purpose |
| --- | --- |
| `workspaces` | Roofing company account and billing boundary |
| `workspace_members` | User membership and role |
| `properties` | Address and property metadata |
| `contacts` | Homeowners, adjusters, suppliers, and other contacts |
| `leads` | Sales pipeline record |
| `jobs` | Won lead converted into production work |
| `inspections` | Inspection session and checklist state |
| `inspection_items` | Deficiencies, measurements, and recommendations |
| `photos` | Metadata pointing to private Storage objects |
| `activities` | Immutable timeline events and notes |
| `appointments` | Calendar events and visit assignments |
| `tasks` | Work items, assignees, due dates, and completion |
| `estimates` | Versioned pricing and approval state |
| `documents` | Proposals, contracts, reports, and attachments |
| `messages` | Workspace and job communication |
| `subscriptions` | Product plan, limits, and billing state |

## Offline and photo requirements

A sellable field app must not lose inspection work because a user enters a dead zone or closes the app. The mobile client should maintain a local queue containing pending records, upload jobs, and retry metadata. Every mutation needs an idempotency key. The server should accept retries without creating duplicate leads, activities, or photos.

Photo uploads should use a resumable or chunk-capable strategy when file size and network conditions require it. The client should create a low-resolution preview immediately, upload the original in the background, and expose a clear pending/synced/failed state. The server should store metadata in Postgres and the binary in private Storage.

## Commercial release phases

| Phase | Product outcome | Exit criteria |
| --- | --- | --- |
| 0. Foundation | Workspace security, real Auth, product shell, migration discipline | RLS isolation and deployment checks pass |
| 1. Field MVP | Lead capture, appointments, guided inspection, photos, notes, offline drafts | A rep can complete an inspection from a phone and office can see it on desktop |
| 2. Sales MVP | Estimates, proposal preview, approvals, tasks, communication timeline | A lead can move from inspection to approved estimate |
| 3. Production MVP | Jobs, calendar, crew mode, checklists, check-in/out, delivery tracking | A manager can assign work and crew can complete it from mobile |
| 4. Commercial platform | Billing, roles, reporting, customer portal, integrations, audit logs | A paying company can onboard, operate, and export its data without support |

## Packaging and pricing direction

The product should be packaged around a workspace subscription rather than individual app access. A practical initial model is a small-company base plan with included office users, a field-user allowance, storage limits, and paid usage for advanced measurement, AI transcription, signatures, or high-volume photo storage. The field app should be included with the workspace because its value depends on synchronized office workflows.

The product should enforce plan limits in the backend, display usage clearly, and never use client-side-only billing checks. Trial workspaces should have a deterministic expiration, export capability, and a clear conversion path.

## Immediate next implementation order

1. Apply and verify `002_workspaces_activity_storage.sql`.
2. Add a real `photos` metadata table and link every Storage object to an inspection and album.
3. Build a guided inspection flow instead of the current generic camera page.
4. Add offline draft persistence and an upload queue.
5. Add desktop inspection review with album filters, annotations, and activity timeline.
6. Scaffold the Expo field app with shared Supabase Auth and workspace permissions.
7. Add appointments, tasks, maps/directions, check-in/out, and crew mode.
8. Add estimates and proposal/signature workflows after the inspection loop is reliable.

## Scope boundary

“Mirror AccuLynx features” means matching the category-level workflows that roofing contractors expect. It does not mean copying AccuLynx’s proprietary implementation, branding, text, screenshots, or trade dress. ROOF/OS should use its own information architecture, visual system, copy, and product advantages.

## References

[1]: https://acculynx.com/roofing-app/ "AccuLynx Mobile Roofing App"
[2]: https://acculynx.com/acculynx-launches-new-mobile-app-to-help-roofing-companies-manage-labor-crews/ "AccuLynx Mobile Crew App"
[3]: https://acculynx.com/new-acculynx-field-app/ "Introducing the New & Improved AccuLynx Field App"
[4]: https://play.google.com/store/apps/details?id=com.acculynx.field_sales&hl=en_US "AccuLynx Field on Google Play"
