# ROOF/OS Final Handoff

**Handoff date:** 2026-09-14

## Current production site

- **Production URL:** https://roof-os-lemon.vercel.app
- **Hosting:** Vercel Hobby
- **Vercel project:** `roof-os`
- **Source:** GitHub `Gtownrter77/roof-os`, branch `main`
- **Supabase project:** `xksumagfbegdlapwysps`

The permanent Vercel deployment was previously verified with a `200 OK` login route and redirects from protected routes to `/auth/login`. GitHub `main` is connected to automatic Vercel production deployments.

## Completed features

1. Repaired the Next.js production build and standalone asset serving.
2. Restored Tailwind/PostCSS styling and route navigation.
3. Replaced the demo auth cookie with Supabase email authentication.
4. Added Supabase magic-link login and account creation.
5. Added `/auth/callback` authorization-code session exchange.
6. Updated middleware to refresh and validate Supabase sessions server-side.
7. Connected GitHub `main` to the free Vercel Hobby project.
8. Added Supabase URL and publishable key to Vercel Production environment variables.
9. Configured the Supabase Site URL and callback allowlist for the Vercel domain.
10. Created the initial `public.leads` table and owner-based RLS policies.
11. Replaced the hardcoded leads list with authenticated Supabase reads.
12. Replaced simulated lead saving with real Supabase insertion.
13. Implemented lead status updates with persisted status-change activity events.
14. Implemented persisted activity notes for leads.
15. Prepared workspace and workspace-member tables, new-user workspace provisioning, existing-user backfill, workspace-scoped lead/activity RLS, and private inspection-photo Storage policies.
16. Replaced browser/localStorage photo saving with private Supabase Storage uploads using workspace-scoped object paths.
17. Added the reusable `roof-os-production-review` Manus skill for future review, remediation, verification, deployment, and handoff tasks.
18. Added `PRODUCT-VISION.md`, defining ROOF/OS as a sellable two-surface product: a desktop control plane plus a camera-first phone/tablet field app.
19. Added `MOBILE-FIELD-ARCHITECTURE.md` with the Expo/React Native stack, offline sync model, photo pipeline, security model, navigation, and release gates.
20. Added `DATABASE-SCHEMA.md` and `003_status_history_inspection_photos.sql` for durable lead status history, inspection sessions, photo metadata, and RLS.
21. Added Google Maps and OpenStreetMap navigation deep links from leads without requiring a Maps API key.
22. Added real appointments and follow-up task schema in `004_appointments_tasks.sql`, a calendar entry form, Supabase appointment reads/writes, and downloadable `.ics` events.
23. Added the initial `apps/field` Expo/React Native field-app shell with camera capture, job-address navigation, and EAS Android APK profile.
24. Added `AUTOMATION-AGENTS.md` defining four bounded, auditable agents: intake/router, scheduler/follow-up, inspection quality, and office copilot/reporting.
25. Configured `apps/field/eas.json` for an internal Android APK preview build. The EAS build reached the Expo authentication gate; an Expo login or `EXPO_TOKEN` is required before Expo can produce the APK artifact.
26. Added `OWNER-MANUAL.md` with setup, daily office workflows, field procedures, migrations, security, automation, APK release, backup, troubleshooting, and release-readiness instructions.
27. Added `005_default_automation_agents.sql`, which seeds four workspace agent rules and creates idempotent first-response and status-based follow-up tasks assigned to the lead owner.
28. Added `OPERATING-CADENCE.md` with scheduled daily, weekly, monthly, and release routines derived from the owner checklist.

## Sellable product direction

The product blueprint now defines the desktop web app as the system of record for administration, production scheduling, estimating configuration, reporting, billing, integrations, and team oversight. It defines the field app for leads, appointments, guided inspections, camera capture, photo albums, annotations, offline drafts, background uploads, calls, notes, tasks, status updates, crew checklists, check-in/out, and job communication.

The recommended commercial path is a responsive mobile pilot followed by a dedicated Expo/React Native iOS and Android application. The next product implementation priorities are applying the workspace migration, adding a first-class inspection/photo metadata model, building offline upload queues, creating the guided inspection flow, and then scaffolding the dedicated field app.

See [PRODUCT-VISION.md](PRODUCT-VISION.md) for the complete feature map, architecture, release phases, and pricing direction.

See [MOBILE-FIELD-ARCHITECTURE.md](MOBILE-FIELD-ARCHITECTURE.md), [AUTOMATION-AGENTS.md](AUTOMATION-AGENTS.md), and `apps/field/eas.json` for the mobile and automation implementation details.

See [OWNER-MANUAL.md](OWNER-MANUAL.md) for the detailed owner operating instructions and [OPERATING-CADENCE.md](OPERATING-CADENCE.md) for the scheduled routines.

To produce the APK after authenticating with Expo:

```bash
cd apps/field
npx eas login
npx eas build --platform android --profile preview
```

For CI, set `EXPO_TOKEN` instead of using an interactive login. The expected artifact is an `.apk` from the EAS build page.

## Important external step still required

The workspace and Storage migration is committed as:

```text
supabase/migrations/002_workspaces_activity_storage.sql
```

It was validated locally and is ready to run, but it was **not applied to Supabase** because the authenticated Supabase dashboard session expired during the SQL Editor step. Until it is applied, the workspace-aware lead status/activity and photo upload code should be treated as pending integration rather than fully production-verified.

Follow the exact instructions in:

```text
SUPABASE-MANUAL-MIGRATION.md
```

After applying the migration, complete the documented authenticated CRUD, Storage, and cross-workspace RLS checks.

## GitHub commits

Key commits, oldest to newest:

- `27d90fc` — restore auth flow and enforce build validation
- `d207c27` — persist onboarding settings and refresh lockfile
- `6092151` — restore Tailwind styling and route navigation
- `945ee14` — serve standalone static assets and document review
- `af0bdeb` — connect Supabase email authentication
- `b2873fd` — document permanent Vercel deployment
- `597d4f4` — add project handoff
- `7818e60` — persist leads with Supabase RLS
- `c2a1982` — add workspace security, lead activity, and photo uploads
- `5b67e82` — finalize production handoff metadata
- `2cb66df` — define sellable desktop and field app product
  - `dd92762` — add field navigation, calendar, automation foundation, and Expo shell
  - `8b98433` — add detailed owner manual

The current workspace/activity/Storage implementation, field-app shell, calendar layer, navigation links, automation configuration, and owner routines are committed and pushed in the latest `HEAD`.

## ZIP files

- [Current job handoff ZIP](</home/ubuntu/roof-os-job-handoff.zip>)
  - SHA-256: `160a3e2b8775203f67c54a3c8c10ee9927b89f729298656876d3c1a9b6e7e1ba`
  - Contains the committed source through `7818e60`.
- [Supabase authentication job ZIP](</home/ubuntu/roof-os-supabase-auth-job.zip>)
  - SHA-256: `fcda3d10e395ac3ea261cac31991846398a4bc59803d9d22a5da2fbf77a5bd6a`
  - Contains the earlier Supabase authentication handoff.

A refreshed ZIP containing the final workspace/activity/Storage source should be generated after the final commit is pushed.
- [Final source handoff ZIP](</home/ubuntu/roof-os-final-handoff.zip>)
  - Refresh this archive after the handoff documentation commit below; it should contain the final `HEAD`.

## Validation status

The current source batch passes:

```text
npm run build
npx tsc --noEmit
git diff --check
```

The three-level verification status is:

- **Level 1 — Static:** passed locally, including web build, TypeScript checks, Expo type check/config, and Expo web export.
- **Level 2 — Runtime:** prior production route verification passed; rerun after the final Vercel deployment.
- **Level 3 — Data/security:** pending execution of migrations `002` through `005` and cross-workspace tests.

## Security notes

The Supabase publishable key is appropriate for browser use. Never commit `.env.local`, database passwords, service-role keys, or generated `.next` output. The inspection-photo bucket is designed to be private and uses paths beginning with `<workspace_id>/<user_id>/`.

## Resume commands

```bash
gh repo clone Gtownrter77/roof-os
cd roof-os
npm ci
npm run build
npx tsc --noEmit
```

Then apply `supabase/migrations/002_workspaces_activity_storage.sql` through the Supabase SQL Editor and complete the Level 3 data/security checks.


## 2026-09-14 hardening update

The live Supabase project `xksumagfbegdlapwysps` has migrations 001 through 017 applied. Ryan’s authenticated account (`rlongmbox@gmail.com`) is the workspace owner and the system owner. Migration 016 aligns the existing `agent_runs` table with the worker runtime contract. Migration 017 adds auditable workspace invitations and an atomic owner price-book save function.

The five highest-risk gaps identified and addressed in this hardening pass were:

1. **Partial owner price-book writes:** the pricing API could leave an empty price-book header when item insertion failed. It now uses the transactional `save_owner_price_book` RPC.
2. **Missing invitation persistence and authorization:** the new `workspace_invitations` table and `/api/team/invitations` endpoint validate email and role, restrict creation to workspace admins, prevent self-invites, and expose pending records. Email delivery and acceptance still require a provider/flow implementation.
3. **Runtime schema drift:** `agent_runs` was created by migration 004 with an older shape than the worker expected. Migration 016 adds the missing runtime columns and status support.
4. **Magic-link retry storm:** the login page now disables repeated requests for 60 seconds and presents a visible countdown after success or a rate-limit error.
5. **Insufficient migration CI coverage:** CI now requires migrations through 017 and checks the runtime, invite, and atomic price-book safeguards.

The remaining release blockers are a real authenticated browser CRUD test, saving Ryan’s actual labor rates and local tax into a draft price book, reviewing and activating that draft, and completing invitation email delivery/acceptance before treating team invites as production-ready.

### Current live verification

- Required core tables: present.
- Ryan owner/system-owner match: verified.
- Price-book tax columns: present.
- Agent runtime columns: present.
- Owner-managed price books: none saved yet.
- Team invitation records: none yet.
- PR #1: open; the latest hardening commit will trigger fresh CI checks.
