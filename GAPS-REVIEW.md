# Roof OS gap review vs AccuLynx, JobNimbus, Jobber, Roofr

## Current status — 2026-10-19

The repository has a working web/mobile source baseline and a current-main APK build, but this gap review remains a product-readiness document, not a claim that the product is fully live. The owner-only break-glass login screen prevented authenticated dashboard CRUD verification in the latest check. Physical Android installation, cross-workspace isolation, and end-to-end mobile sync still require owner-run verification.

Free Core boundary: local Ollama/Supabase/GitHub and free/open evidence sources remain the default. Paid claims, retailer, telephony, or hosted-AI connectors are not counted as shipped until explicitly enabled and tested.

Reviewed against the current repo. Do not treat prototype routes (`/quantum`, `/vr`, `/genetic`) as product.

## Table stakes we should not sell as unique

Contacts, leads, jobs, estimates, calendar, invoicing, chatbots, lead scoring, AI receptionist, AI-built websites. Competitors already ship those.

## Biggest five — status in this codebase

| Differentiator | Status |
| --- | --- |
| Roof Passport (property-first record) | Schema + `/passport/[leadId]` shipped. Homeowner public portal and transfer packet not built. |
| Warranty + maintenance OS | `warranties` table + `/warranty` shipped. Expiration alerts, transfers, subscriptions not built. |
| Insurance/supplement copilot | Supplement *records* exist. No carrier-PDF extraction or contractor-vs-carrier line compare. |
| Job ready / margin risk | Owner brief exceptions exist. No margin math until an active owner price book exists. |
| Proof-of-work / evidence verifier | Photos now attach to inspection sessions. Completeness score is a first formula, not vision AI. |

## What others do not have as a core product

1. Permanent roof record after final payment.
2. Warranty eligibility as a living checklist, not a file cabinet.
3. Owner exception brief instead of ten dashboards.
4. Owner-locked price books that refuse to pretend they are Xactimate.
5. Storm evidence kept as corroboration, not auto-claim.

## Do not build next

Generic chatbot, Scout-clone CRM editor, lead-rank copy, AI website builder.

## Build next after Passport/warranty/brief work

1. Persist report packets onto the passport.
2. Human-reviewed supplement gap list from uploaded carrier PDFs.
3. Production-ready score (contract, deposit, color, permit, materials, crew, weather).
4. Homeowner-visible passport link with signed URLs only.

## Verified checkpoint — 2026-10-25 (supersedes the "current status" paragraph above)

This checkpoint records what was re-verified against the source and a non-production
Supabase project on 2026-10-25. The older status paragraph is retained as history.

- **Standard authentication is restored.** `/auth/login` ships password sign-in,
  magic-link request, password reset, and signup navigation. Break-glass remains a
  collapsed, owner-only fallback. The earlier "owner-only break-glass is the only
  path" statement is no longer accurate.
- **Multi-tenant RLS verified live.** The repository's own
  `scripts/two-workspace-isolation-test.mjs` ran against a non-production project with
  two synthetic users and passed: cross-workspace lead reads, updates, and deletes were
  denied, and a private inspection photo could not be read across workspaces.
- **Full suite green.** All test scripts pass, along with `typecheck`, `release-check`,
  and the production `runtime-smoke` server boot. One real source fix was required:
  `next.config.ts` now emits immutable `Cache-Control` for `/_next/static/(.*)`.
- **Newly closed gaps:** public read-only Roof Passport share links (unguessable
  token, server-only read, admin publish/unpublish) and a daily warranty-expiry cron
  that creates owner tasks and transitions expired registrations.
- **Still external gates:** production migration application, physical Android/iOS
  verification, and any provider-side (claims/telephony/paid AI) enablement remain
  out of scope for source verification.

## Phase 1 launch-hardening checkpoint — 2026-10-25

Source-only fixes for the private single-shop pilot, verified in a clean clone of
`b04d33a`:

- **Public passport was unreachable.** `proxy.ts` redirected unauthenticated HTML to
  `/auth/login`, including `/passport/share/<token>`. The path is now exempt and the
  response carries `Referrer-Policy: no-referrer` and `X-Robots-Tag: noindex, nofollow`.
- **Vercel Cron uses GET.** `inspection-quality`, `receptionist-followups`, and
  `warranty-expiry` now export both `GET` and `POST`. `vercel.json` is reduced to the
  Hobby limit of two jobs: weekly `retailer-prices` and daily `/api/cron/daily`, which
  dispatches the three agents and returns `207` when a job fails.
- **No publish control existed.** The contractor passport page now publishes, copies,
  and revokes the homeowner link through the existing admin-guarded share route.
- **Public endpoint hardening.** Migration `056` adds a service-role-only fixed-window
  rate limiter; the public route returns `429` with `Retry-After` after 30 requests per
  minute per IP+token and `503` if the limiter is unavailable.
- **Warranty cron robustness.** Expired registrations are updated in bounded batches of
  500, alerts remain capped at 200, and `?dryRun=1` reports `wouldCreate` with no writes.
- **Contract coverage.** Added `test:cron-http` and `test:passport-public-link`, and
  extended `test:warranty-expiry` for the dispatcher and dry-run behavior.

**Applied to production 2026-10-25:** migrations `055` and `056`, verified through the
schema, the rate-limit RPC, and the live endpoint (`404` for an unknown token). The
public link now works end to end once a workspace publishes a passport.

Still external: apply `054` when mobile AI observations are enabled, verify staging
parity, confirm `CRON_SECRET` and `SUPABASE_SERVICE_ROLE_KEY` in Vercel and trigger
`GET /api/cron/daily` manually, run authenticated isolation with real test users,
capture physical Android evidence, rehearse restore, and upgrade the plan before
adding more cron jobs or retry frequency.
