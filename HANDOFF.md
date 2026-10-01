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


## Final release-readiness update

The latest source commit is `db42c0b`. Local validation passes with and without Supabase environment variables. The source branch is clean and synchronized with GitHub. The public production URL remains available at `https://roof-os-lemon.vercel.app`, with the login route returning 200 and protected routes redirecting unauthenticated users to `/auth/login`.

The PR’s GitHub web, mobile, migration-safety, and preview-comment checks pass. A Vercel preview deployment continues to report a generic failure. The deployment inspector requires authentication to the Vercel work profile; the connected browser session has not exposed that authenticated state, so the provider-side build log cannot be read from this task. A new CI `preview-build` job now reproduces the preview build without deployment-only secrets and will prevent this class of missing-variable failure from returning silently.

Do not merge PR #1 solely on the green GitHub checks while the Vercel deployment check is red. The remaining external step is to open the Vercel deployment inspector while authenticated to the project owner account, read the provider log, and either correct the Vercel project setting or rerun the deployment. No further source-side blocker is known from local or GitHub validation.


## Feature completion audit and remediation

The prior audit correctly found that estimate templates and supplements were prototypes, the task screen was browser-local, measurements were reviewable footprint candidates rather than certified roof measurements, and building codes were state/category fixtures rather than ZIP-specific jurisdiction lookups. This pass began remediation:

- Migration 018 and `/api/supplements` now persist supplement candidates and review decisions under workspace RLS.
- `/supplement` now saves reviewable candidates instead of using random local-only detection.
- `/api/estimate-templates` now persists draft templates, versions, and items using the existing estimate schema.
- `/templates` now saves selected templates as draft records and clearly retains price-book/review gating.
- `/tasks` now reads and updates persisted Supabase tasks, including trigger-created follow-ups.

Measurements remain intentionally review-gated: the property API provides geocoded OpenStreetMap building-footprint candidates and OpenAerialMap metadata, not certified roof-surface quantities. Building codes remain a hardcoded state/category reference and are not yet a ZIP-to-jurisdiction authoritative lookup. Automatic reminder delivery and LLM-based supplement inference remain separate implementation tasks.


## State of the Union — 2026-09-15

### Release position
The release branch is `release/inspection-report-labor-rates`. GitHub Actions for web, mobile, preview build, and migration safety passed on the latest release commit. The open release PR remains unstable because the Vercel preview status failed. The exact Vercel build log could not be retrieved in this environment because the Vercel CLI requires account authentication; its GitHub status only reports deployment failure and provides deployment ID `dpl_Fj8hjdLBQfVrE54t7qDq6EkXUs79`. The local `pnpm build` succeeds with Next.js 15.5.25, indicating that the remaining Vercel issue is likely deployment configuration, project settings, or environment-specific rather than a reproducible source compilation error.

### Current capabilities and boundaries
ROOF/OS has workspace-scoped inspections, GPS and measurement persistence, review-gated reports, owner labor rates, local-tax persistence, estimate templates, supplements, building-code lookup, aerial and storm evidence boundaries, bounded agent contracts, retailer price snapshots, and a weekly Home Depot reference-price worker. The system-owner lock remains the governing write boundary. Only Ryan Michael Long is authorized to activate protected system updates.

Retailer data remains reference pricing. It is not a licensed Xactimate or Verisk price list and must not be represented as one. Prices used in estimates require a source, market or ZIP code, retrieval timestamp, effective date, and owner review. Photo analysis alone is not currently a customer-ready insurance estimate.

### This implementation checkpoint
Migration `019_material_catalog_workspace_settings.sql` adds a structured catalog covering GAF Timberline HDZ and Royal Sovereign shingles, designer shingles, starter and ridge-cap products, synthetic felt, ice and water shield, Cobra 3 ridge vents, box and bathroom vents, pipe boots by size, drip edge, gutter apron, step-flashing variants, coil nails, staples, button caps, NP1, OSB, VELUX skylights, gutters, dumpster rentals, and delivery fees. Catalog rows intentionally contain product metadata rather than fabricated current prices.

The new authenticated material API supports search by product, brand, product line, and variant. The pricing configuration screen now exposes that catalog and separate state, county, city, and special-district tax inputs. The owner pricing API persists those jurisdiction rates while retaining a computed combined rate for compatibility.

Workspace settings now persist weekly, manual-only, or disabled price refresh; default language; default ZIP code; preferred brands; and catalog-only versus catalog-plus-retailer search. The Settings screen provides a manual refresh action for the active Home Depot watchlist. The scheduled worker honors the workspace refresh setting and skips manual-only or disabled workspaces.

### Remaining shipment blockers
Migration 019 must be applied to the target Supabase project. Production Supabase variables, `RAPIDAPI_KEY`, `CRON_SECRET`, and the service-role key must be configured in the deployment environment. Vercel must be re-run after those settings are checked. A real authorized claims-price import or licensed provider is still required before insurance pricing can be called current. Level 3 workspace isolation, worker heartbeat, provider-response, and approval-transition evidence remain outstanding.


## 2026-09-17 2026 hardening release

The five highest-impact repository weaknesses were addressed without changing customer-facing workflow semantics:

1. **Vulnerable framework dependency chain:** upgraded Next.js to `16.3.5` and PostCSS to the patched `8.5.10` line; `npm audit --omit=dev --audit-level=high` now reports zero vulnerabilities.
2. **Missing browser security headers:** added CSP, HSTS, frame protection, MIME sniffing protection, referrer policy, permissions policy, and disabled the framework-powered-by header in `next.config.ts`.
3. **Repeated workspace authorization risk:** added shared UUID and membership checks and applied them to CapOut, property measurements, drone evidence, Home Depot pricing, and NOAA storm routes. Cross-workspace requests fail closed before provider calls or writes.
4. **Unbounded request/provider behavior:** added 64 KB JSON body limits, object-only JSON validation, 10-second upstream timeouts, and bounded provider response parsing.
5. **Weak release gates:** added `release-check`, `typecheck`, and `audit` scripts; CI now runs them in addition to the build and migration safety checks. The deprecated Next.js middleware convention was migrated to the Next.js 16 `proxy.ts` convention.

### Three-level verification

- **Level 1 — Static:** passed `npm run build`, `npm run typecheck`, `npm run release-check`, `npm run audit`, `git diff --check`, and migration/secret-hygiene checks.
- **Level 2 — Runtime:** local standalone server returned `200` for `/auth/login`, emitted all configured security headers, and redirected unauthenticated `/leads` requests to `/auth/login`.
- **Level 3 — Data/security:** migration policy and secret scans passed; protected workspace routes are statically required to call `requireWorkspaceMember`. Live Supabase CRUD and cross-workspace RLS execution remains dependent on the target project's migrations being applied and authenticated test accounts being available.


### Final release verification update

The hardening commit was rebased onto current `origin/main` and expanded to cover eight workspace-scoped API routes, including manual measurements, labor rates, and pricing refresh. Final checks passed: `npm run release-check`, `npm run verify:security`, `npm run build`, `npm run typecheck`, `npm run audit`, root and field reproducibility checks, Expo config validation, migration/secret scans, and standalone runtime smoke tests. The runtime emitted the configured security headers and redirected unauthenticated `/leads` requests to `/auth/login`. Live Supabase cross-workspace CRUD remains an environment-dependent check requiring authenticated test accounts.


## 2026-09-30 recovery-branch handoff

**Working directory:** `/home/ubuntu/roof-os-backup-temp`
**Branch:** `rebuild/roof-os-recovery`
**Last verified remote HEAD:** `8600fd50f16393cfd647402eb1ad81cf83c21462`

### Already pushed and verified

- D.3 route/RLS compatibility correction: `ae4a0d221b4b5a65cf1b5c0d4f9465eaec4cc1c6`.
- D.2 photo upload now creates an inspection session and `inspection_photos` metadata rows, and sends UUIDs plus `inspectionId`: `8600fd50f16393cfd647402eb1ad81cf83c21462`.
- Upload milestone checks passed before this handoff: `npm run typecheck`, `npm run test:photo-estimate-flow`, `node scripts/security-check.mjs`, `node scripts/ai-vision-endpoint-test.mjs`, and `git diff --check`.

### Current uncommitted work — do not assume tested

After syncing and confirming the clean `8600fd5` local/remote baseline, `app/photo-estimate/page.tsx` was edited to add an optional D.3 AI analysis UI:

- A Supabase browser-client role check controls whether the analysis button is shown; the D.3 server route remains authoritative and requires workspace admin.
- `Analyze roof photos` sends the workflow ID to `/api/photo-estimate/analyze` only when explicitly clicked.
- `Force fresh analysis` sends `forceRefresh: true` after a result exists.
- The UI renders the summary, classification, damage observations, warnings, and contract disclaimer as non-authoritative information.
- Building a review packet does not automatically call Gemini.

This UI edit was **not typechecked, tested, committed, or pushed**. Current expected change is `M app/photo-estimate/page.tsx`. The working tree was clean before the edit; check `git status --short` and `git diff` before resuming.

### Resume safely

1. Stay in `/home/ubuntu/roof-os-backup-temp` and branch `rebuild/roof-os-recovery`; do not create another checkout.
2. Inspect `git status --short` and the page diff. The resume task is only to complete/test the opt-in analysis UI unless the user changes scope.
3. Extend `scripts/photo-estimate-flow-test.mjs` with regression assertions that analysis is admin-gated in the UI, starts only from an explicit click, calls `/api/photo-estimate/analyze`, supports `forceRefresh`, and displays the D.2 disclaimer. Keep tests from making provider calls.
4. Run `npm run typecheck`, `npm run test:photo-estimate-flow`, `node scripts/security-check.mjs`, `node scripts/ai-vision-endpoint-test.mjs`, `node scripts/auth-flow-test.mjs`, `node scripts/ai-vision-contract-test.mjs`, and `git diff --check`.
5. Show `git status --short`; commit and push only after the checks pass. Immediately verify with `git ls-remote --heads origin rebuild/roof-os-recovery` and record the exact hash.

No live Gemini execution has been verified. Do not claim it was tested; no provider request was made during this in-progress UI edit.


## D.3 opt-in UI milestone completed — 2026-09-30

The explicit admin-only analysis UI and focused regression assertions are now tested and pushed. Commit: `7141922553e2bbcb0de8382d046a3034664837fd` on `rebuild/roof-os-recovery`; `git ls-remote --heads` confirmed the exact hash.

Passed checks: `npm run typecheck`, `npm run test:photo-estimate-flow`, `node scripts/security-check.mjs`, `node scripts/ai-vision-endpoint-test.mjs`, `node scripts/auth-flow-test.mjs`, `node scripts/ai-vision-contract-test.mjs` (11 assertions), and `git diff --check`.

The D.3 call is explicit user-triggered only; packet creation does not invoke Gemini. The browser checks workspace-admin status for UI visibility, and the server remains authoritative. No live Gemini request was made.


## 2026-09-30 production authentication verification checkpoint

### Repository/recovery state

- The former `rebuild/roof-os-recovery` branch was merged through PR #30 (merge commit `c68faf4e4b80aaa7e0555c1e47920f929c8049b2`) and is no longer a remote branch. PR #32 was also merged into `main`.
- Current verified baseline: `main` at `852048a0925b24f5a92aee3b7554254bdac0b934`; local and remote `main` matched before this documentation checkpoint.
- Current-task remote backup: `backup/auth-verification-20260930` at `852048a0925b24f5a92aee3b7554254bdac0b934` (remote SHA verified before edits).
- The historical path `/home/ubuntu/roof-os-backup-temp` is absent in this sandbox. Work resumed from the existing clean `Gtownrter77/roof-os` clone at `/home/ubuntu/roof-os`, based on the verified current `main`; no source code was changed for this checkpoint.

### Authentication evidence — 2026-09-30

Passed locally from the current `main` source:

- `node scripts/auth-flow-test.mjs` — PASS (OTP, callback result types, cooldowns, and safe redirects).
- `npm run test:api-security` — PASS.
- `npm run verify:security` — PASS.
- `npm run typecheck` — PASS.
- `npm run release-check` — PASS (9 protected routes, security headers, and secret scan).
- `git diff --check` — PASS.

Read-only production route smoke checks:

- `GET https://roof-os-lemon.vercel.app/auth/login` — HTTP 200.
- `GET https://roof-os-lemon.vercel.app/leads` without a session — HTTP 307 to `/auth/login?next=%2Fleads`.

Source review confirms email-link and 6-digit email OTP flows, callback result validation, rate-limit cooldown handling, and same-origin `next` path validation. No email was sent and no production sign-in was attempted.

### Verification boundary and next action

**Production authentication is only partially verified.** The route and code-level checks above pass, but a real production magic-link/OTP delivery, successful callback/session establishment, and authenticated protected-workflow test were not performed. Do not claim end-to-end production login is verified. The remaining action is to run that test with an authorized test account and confirm the resulting authenticated workspace flow; no user credentials were requested or used in this checkpoint.


## 2026-09-30 D.3 production schema and Gemini readiness

- Production Supabase project `Roof OS` was active and healthy. Before the fix, the migration ledger ended at `035_retailer_quota_hardening`, and `public.photo_estimate_workflows` was missing the four D.3 persistence columns.
- Applied `supabase/migrations/036_photo_estimate_ai_analysis.sql` as migration `photo_estimate_ai_analysis` (ledger version `20260930165224`). A read-only schema query confirmed `ai_analysis jsonb`, `ai_analyzed_at timestamptz`, `ai_model_version text`, and `ai_content_hash text` now exist and are nullable. This was additive schema DDL; no workflow data was changed.
- Configured `GEMINI_API_KEY` in Vercel as a sensitive, production-only environment variable. Its value is not recorded in this repository or handoff. This setting will be consumed by the next production deployment.
- Source change on this branch sends the Gemini key in Google's documented `x-goog-api-key` header instead of a URL query parameter; the endpoint regression test now asserts both behaviors.
- Production smoke checks observed `/auth/login` returning 200 with security headers, unauthenticated `/leads` redirecting to login, and an invalid callback rejecting a hostile `next` target with `Cache-Control: no-store` and a safe `next=/`. An unauthenticated analysis POST was redirected by the auth proxy.
- Local checks passed: photo-estimate flow, AI endpoint/auth regression, all 11 AI contract tests, TypeScript typecheck, security check, and release check (9 protected routes, headers, secret scan). `git diff --check` passed.
- Source backup: `backup/pre-d3-migration-20260930` at `9f32401553e77c74a9814573113824ed75564270`.
- **Not verified by design:** the user directed us to skip login. No authenticated workspace-admin flow was attempted, and no photo or live AI request was sent. After the header patch reaches production, a signed-in admin run remains the end-to-end proof for D.3.


## 2026-09-30 measurement-to-estimate authority checkpoint

- Starting baseline was clean `main` at `a35ddbf52415fdf5345c538e8c44e475a790a633` (PR #35 merge). Recovery branch `backup/pre-estimate-authority-20260930` was pushed and independently verified at the same SHA before edits.
- Added `scripts/measurement-estimate-authority-test.mjs`, exposed as `npm run test:measurement-estimate-authority`, and wired it into the web CI job. This is a source-contract regression only; it makes no database, login, or provider calls and changes no API behavior.
- The test asserts that D.3 writes only AI-analysis metadata, technician verification is workspace-admin gated and records the approving user/time, manual measurement rows remain `unverified`, and estimate packets remain unpriced `needs_price_review` drafts with measurement-source, price-book, and human-approval steps.
- Local checks passed: the new regression, photo-estimate flow, all 17 AI contract cases, AI endpoint/provider-request regression, API security, security scan, typecheck, release check, production build, dependency audit (0 high-severity vulnerabilities), and `git diff --check`.
- Login troubleshooting stopped after the preview displayed “Too many sign-in requests. Please wait 60 seconds and try again.” Both the initial request and one retry after the full 60-second cooldown showed that message. No successful app session was established and no further OTP requests were made. The login route itself had loaded; production/authenticated workflow acceptance remains incomplete.
- **Next product gap (not changed here):** technician approval is recorded on `photo_estimate_workflows`, while `/api/estimates/draft` accepts client-supplied quantities and can create an explicitly unpriced, review-gated packet without requiring that approved workflow. A future behavior change could link a verified workflow/measurement server-side and derive quantities from persisted technician data. That would change the draft API contract, so it is intentionally not part of this test-only checkpoint and needs an explicit product decision.


## 2026-09-30 strict technician-approved estimate gate

This implementation starts from clean `main` at `fff6593329b2bcf7efada4e66a8e28288e4afb42`; the exact source baseline is preserved at `backup/pre-strict-estimate-gate-20260930`. On `feat/strict-approved-estimate-gate-20260930`, the technician verification form now requires an explicit gutter length (enter 0 when none). The verify endpoint persists the rounded gutter value alongside the approver, timestamp, eave/rafter/pitch/waste inputs, and server-calculated roof squares. Initial roof/gutter values remain unverified candidates and are not accepted by the estimate-draft endpoint.

`/api/estimates/draft` now accepts only workspace, approved workflow ID, optional same-inspection storm evidence, and notes; client-supplied quantities and measurement IDs are rejected. It requires an approved workflow with consistent actor/time/roof/gutter values, re-derives roof squares server-side, and links the resulting packet to that workflow. Migration 037 adds the source foreign key and an RLS insert validator that rejects unapproved/mismatched workflows, altered quantities, extra line items, or priced packets. Drafts remain `needs_price_review`, unpriced, and blocked from external use until human approval.

Local validation passed: measurement-authority tests (including stale/mismatched approvals and explicit zero gutters), photo-estimate flow, all 17 AI contract tests, AI endpoint/provider-request regression, API security, mobile offline sync, security scan, TypeScript typecheck, release check, production build, dependency audit (0 high-severity vulnerabilities), migration-order/policy checks, and `git diff --check`. Migration 037 parsed and ran against a disposable in-memory PostgreSQL instance; a valid packet was accepted and a tampered roof quantity was rejected by RLS. No production database migration or deployment was performed. Apply migration 037 before merging/deploying this API change; production/authenticated login verification also remains incomplete after the previously recorded Auth rate limit, and no further OTP requests were made.


## 2026-09-30 production login-loop remediation (in progress)

- Work is on a separate worktree/branch from the verified `main` baseline `fff6593329b2bcf7efada4e66a8e28288e4afb42`. Existing strict estimate-gate PR #37 remains open and untouched.
- The login page now defaults to email/password via Supabase `signInWithPassword`; email-link and six-digit-code options remain available. Password success follows the validated same-origin `next` path and refreshes server auth state. No password or API key is stored in source or handoff.
- Existing `/auth/callback` exchanges the authorization code with `exchangeCodeForSession`; the server Supabase client writes session cookies. The Next.js proxy treats `/auth/*` as public while unauthenticated, so it does not redirect the callback before session establishment.
- Read-only live checks: `/auth/login` returned HTTP 200; an invalid callback safely returned to login with `Cache-Control: no-store`; an unauthenticated `/leads` request redirected to login. These checks do not prove a successful authenticated session.
- Vercel Production has both `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` set across environments. The URL matches production project `xksumagfbegdlapwysps`, and the public key matches an active publishable key; raw key material is intentionally not recorded.
- The hosted Supabase Auth URL Configuration page requires the owner to sign in interactively. Its current Site URL/redirect allowlist has not yet been inspected or changed. Target requested by owner: Site URL `https://roof-os-lemon.vercel.app`, production redirect allowed, and no localhost redirects.
- The available Supabase SDK credential is a publishable key, not an admin key. No account password was changed and no OTP was sent in this work. Setting an owner password requires a supported admin/dashboard path; ask the owner to sign in to Supabase and approve the exact temporary password before applying it.
- Validation passed: auth-flow regression (including public callback/cookie assertions), API security, mobile offline sync, photo-estimate flow, measurement-estimate authority, 17 AI contract cases, AI endpoint regression, typecheck, release check, security scan, production build, dependency audit (0 high-severity vulnerabilities), and `git diff --check`.
- **Remaining acceptance:** inspect/apply Supabase URL settings after owner browser sign-in, set a temporary owner password only after approval of its exact value, push/open a separate auth PR, wait for green CI, deploy, and verify the full authenticated production flow without inspecting customer data.

## 2026-10-01 estimate-gate integration checkpoint

- Integrated current `main` (including Phase D aerial geometry and verified production-status documentation) into `feat/strict-approved-estimate-gate-20260930`.
- Resolved the handoff-only merge conflict while preserving both the strict estimate-gate and login-remediation records.
- Renumbered the estimate packet source migration from `037_estimate_packet_photo_workflow_source.sql` to `038_estimate_packet_photo_workflow_source.sql` because `main` already owns migration 037 for aerial geometry; updated the authority regression references accordingly.
- Verified locally: `npm run typecheck`, `npm run test:measurement-estimate-authority`, `npm run test:photo-estimate-flow`, `npm run release-check`, `npm run verify:security`, and `git diff --check` all pass.
- Pushed the corrected branch at `7914b23`; GitHub required `web`, `mobile`, and `migration-safety` checks are passing on PR #37. Merge is the next repository action.

## 2026-10-01 AI receptionist integration checkpoint

- Reconciled the receptionist branch with the post-PR #37 `main` baseline.
- Kept current main’s Next.js 16.3.8 and all existing web, mobile, preview, migration, security, and audit gates; added the receptionist contract check to CI.
- Preserved the receptionist routes, atomic booking migration, Twilio/Stripe/OpenAI adapters, runbook, realtime voice contract, and follow-up cron.
- Added the required runtime dependencies (`openai`, `stripe`, and `twilio`) without retaining the stale Next.js 15 pin from the feature branch.
- Production provider configuration remains environment-driven; no provider credentials were changed.

## 2026-10-01 simple-auth integration checkpoint

- Reconciled PR #17 with the post-PR #37 `main` baseline.
- Kept the newer main login implementation from PR #38 because it already contains the safer default-password mode, bounded password input, safe redirect handling, and the existing email-link/code fallback.
- Preserved PR #17’s distinct additions: `/auth/reset` password update flow, explicit user-chosen signup passwords, and corresponding auth-contract changes.
- This branch is ready for local verification and GitHub CI; no auth secrets or production credentials were changed.

## 2026-10-01 repository-wide branch review checkpoint

- Merged PR #40 (verified state-of-union documentation), PR #37 (strict technician-approved estimate gate with migration 038), PR #17 (password sign-in/reset flow), and PR #16 (hardened AI receptionist workflows) into `main`; each completed with all required `web`, `mobile`, `preview-build`, `migration-safety`, Vercel, and preview-comment checks passing.
- Closed PR #9 and PR #11 as superseded: newer photo-estimate/estimate-gate and Lowe’s quota/provider hardening are already on `main`.
- Closed PR #8 as stale/superseded after review: it reintroduced migration-version collisions and a broad unreviewed public route surface; its remote branch remains available for a focused redesign.
- Main branch protection remains enabled with required `web`, `mobile`, and `migration-safety` checks, admin enforcement, conversation resolution, no force-pushes, and no deletions.
- All integrations in this review were pushed to their source branches before merge; no production credentials or database deployments were performed.

## 2026-10-01 branch-wide CI trigger checkpoint

- Updated `.github/workflows/ci.yml` so every branch push and every pull request target receives the same web, mobile, preview-build, migration-safety, security, and audit coverage; `main` protection still requires the three configured checks.


## 2026-10-01 Golden Report / photo-to-report checkpoint

- User priority: complete the photo-to-finished-report path; use only free/open-source software; checkpoint completed work frequently so it is not lost.
- Canonical report template: `GOLDEN-REPORT.md`, indexed from `README.md`. The web report uses the 12 required sections and a dependency-free rules check in `lib/reports/golden-report.mjs`.
- PR: https://github.com/Gtownrter77/roof-os/pull/43 (`feat/photo-full-report-20261001`). Code checkpoint commit: `ed3ef426fbf93a55bb10146719ddc1a5d9baf230`; remote ref matched local SHA. A backup ref `backup/pre-photo-report-upgrade-20261001` preserves pre-checkpoint SHA `d42afc240d2bb10cef9783295a1a1b910b29d14c`.
- Implemented in that checkpoint: resume an inspection by URL; load its saved workflow and photo metadata; create fresh private signed photo URLs; generate and persist the standard report only from an approved workflow; check each photo belongs to the same workspace and inspection and is fully uploaded; match displayed photos to persisted IDs; print only the report with alt text and a repeating footer; and run the Golden Report contract before saving.
- Honesty gates: missing facts render **Unknown**; each measurement shows its source; unconfirmed AI observations are omitted; NWS weather alerts are not presented as NOAA Storm Events Database entries; the report is a **Draft** until required signatures and manager approval exist; there are no dollar amounts or prices.
- No new packages, paid software, or external services were added.
- Local checks passed on the code checkpoint: all web regression scripts; Golden Report positive and negative contract tests; `npm run typecheck`; `npm run release-check`; `npm run verify:security`; `npm run audit` (0 production vulnerabilities); production `npm run build`; mobile `npm audit --audit-level=moderate` (0 vulnerabilities), `npx tsc --noEmit`, and `npx expo config --json`; `git diff --check`.
- Live smoke test of the then-current production deployment (read-only): `/auth/login` returned 200; `/leads` redirected unauthenticated users to login (307); `/api/photo-estimate/report` also redirected to login (307). This does not verify the new PR code in production.
- Production database/deployment evidence remains blocked: Supabase and Vercel connectors are disabled/not available in this session. No production database, migration, deployment, or customer data was changed.
- At the code checkpoint, PR checks had 1 success and 9 pending, no failures; recheck after the handoff-doc push before merging.
- Remaining Golden Report product gates (do not describe the report as customer-ready): capture a technician’s name/license and actual signature; record owner/manager approval before delivery; add per-photo usability/coverage and technician-confirmed observation review; connect NOAA Storm Events Database records (not NWS alerts); add verified jurisdiction-code citations, supported supplements, and homeowner Q&A. Keep each field **Unknown** until its source is implemented and verified.
- Next: check PR #43 CI; fix any failures and push a new verified checkpoint. After CI is green, merge only within the already requested main-update scope; then verify the deployed report route and record actual production/database evidence when authorized access is available.


## User-directed checkpoint law — mandatory for future work

**Checkpoint after every 3 completed, verified work batches; do not let a 4th accumulate.** Commit and push the accumulated work, verify local and remote SHAs match, and update this handoff. Checkpoint sooner before a handoff, long pause, task/device switch, major milestone, merge, or risky/destructive action. Never merge while required CI checks are pending or failing. The full rule is `UPDATE-CHECKPOINT-LAW.md`, linked from the top of `README.md`.
