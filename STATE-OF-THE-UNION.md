# ROOF/OS State of the Union — 2026-10-01

Repo: https://github.com/Gtownrter77/roof-os  
Production: https://roof-os-lemon.vercel.app  
Initial audit basis (2026-09-15): `5fcff9d` plus `fix/sotu-hardening`

## Verdict

The core office loop is a real app, not a mock. Auth, RLS-backed persistence, and owner pricing exist. It is not ready to be represented as a sales-facing estimating platform until licensed claims pricing, invitation email delivery, production Vercel configuration/cron, and cross-workspace isolation are verified. Migration 019 is applied; aerial-geometry migration 037 is not applied in production.

## Verified status — 2026-10-01

- `fix/sotu-hardening` merged as PR #3 on 2026-09-16.
- The production Supabase migration ledger confirms `019_material_catalog_workspace_settings` is applied. `material_catalog` and `workspace_settings` exist with RLS enabled.
- Main contains `037_aerial_geometry_suggestions.sql` and the aerial suggestion API. The schema stores proposed roof planes, edges, and objects with confidence and review states. Calibration and technician review gate confirmation; the API says AI suggestions do not create authoritative estimate quantities. Production does **not** have migration 037 applied: `aerial_measurements`, `roof_planes`, `roof_edges`, and `roof_objects` are absent.
- The migration uses ordinary foreign keys for parent and workspace IDs but does not enforce that each linked inspection, photo, and child geometry row belongs to the same workspace. Add a database-level consistency constraint before applying it.
- Open PR #37 adds a separate migration also numbered `037`; renumber and reconcile it with main before merge. Review the combined schema and ordering before applying either change.
- CI runs builds/typechecks, release/security checks, and targeted API-security, auth-flow, photo-estimate, measurement-authority, and AI-vision tests. An aerial-geometry contract script exists but is not wired into CI. A live two-workspace RLS test and browser E2E test were not verified.
- Invitation creation and acceptance routes/transaction exist; email delivery remains unimplemented.
- PR #24 (retailer quota safeguards) and PR #31 (master playbook PDF) merged on 2026-10-01 after all six required checks passed on their refreshed branches.
- Vercel preview checks passed for those PRs, but Production environment variables and the production deployment were not verified in this recheck.

## Strengths

- Next.js 15 with Supabase SSR auth and `getUser()` on nearly all APIs.
- Ordered Supabase migration history, RLS policies, and a system-owner lock.
- CI covers web/mobile and preview builds, typechecks, release/security checks, and targeted tests.
- Measurement and retailer-price provenance is documented; estimates are not represented as Xactimate or carrier-approved pricing.
- Owner manual and operating cadence exist.

## Remaining weaknesses

### Operations

- Verify Production has `NEXT_PUBLIC_SUPABASE_*`, `SUPABASE_SERVICE_ROLE_KEY`, `RAPIDAPI_KEY`, and `CRON_SECRET`, and verify production cron operation. This recheck lacked authorized Vercel project access.
- Apply the geometry schema only after migration ordering and workspace-consistency constraints are resolved.
- Expo APK build credentials/status were not rechecked.

### Product honesty

- Prior audit identified prototype routes; recheck their current contents before presenting them as production features, and label prototypes in navigation.
- Building-code results were previously found to use a hardcoded state family rather than a legal jurisdiction source; do not describe them as permit-ready.
- OSM footprints and AI-generated roof geometry are suggestions, not certified measurements. Calibration and technician review are required; production geometry tables are not deployed.
- Invitation acceptance exists, but invitation email delivery does not.
- Licensed claims pricing remains unverified; retailer prices are not claims pricing.

### Security and verification

- Run a two-workspace RLS isolation test for leads, photos, price books, and geometry.
- Add a browser-based smoke test for login redirect, authenticated dashboard, and unauthenticated API responses.
- Keep service-role credentials server-side and continue secret scanning.
- Prior audit flagged a root-license gap and a module-scope Supabase client; their current status was not rechecked here.
- Treat this as internal operations software until the isolation and production checks above pass.

## Follow-up order

1. Reconcile PR #37 with main, renumber its migration, add same-workspace integrity constraints, and validate the geometry schema.
2. Verify Vercel Production environment variables and cron operation with authorized project access; preview success does not establish production readiness.
3. Run two-workspace RLS isolation and add browser E2E coverage.
4. Implement invitation email delivery while retaining the existing acceptance transaction.
5. Clearly label prototype routes and avoid claims that AI geometry, footprint estimates, building-code lookups, or retailer prices are authoritative.

## Do not claim

- Photo analysis produces a customer-ready insurance estimate.
- Home Depot / RapidAPI numbers are Xactimate or carrier-approved.
- Building-code results are permit-ready.
- AI-generated geometry or OSM footprints are certified roof measurements.
