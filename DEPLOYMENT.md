# Deployment

ROOF/OS is connected to the free Vercel Hobby project `roof-os`.

Production domain: https://roof-os-lemon.vercel.app

The GitHub `main` branch is connected for automatic production deployments.

## Required production secrets

Configure `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and the server-only `CAPOUT_API_KEY`, `RAPIDAPI_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and `CRON_SECRET` in the deployment secret manager. For EAS, configure `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, and `EXPO_PUBLIC_WEB_APP_URL` as Expo public variables; never put a service-role key, CapOut key, RapidAPI key, or cron secret in the field app. Run `node scripts/production-env-check.mjs` before deployment.

## Migration order

Apply migrations `001` through `024` to the target Supabase project in filename order. Verify RLS using two workspaces before enabling customer-facing estimate or claims-import flows. Migration `008` supplies claims line-item and heartbeat tables; migration `009` supplies claims-import and idempotent agent-run tables; migration `010` supplies the Home Depot reference-price cache and hard 100-inquiry monthly budget; migration `011` supplies the weekly watchlist and worker-only budget reservation; migration `012` supplies inspection measurements, NOAA storm evidence, and estimate review packets; migration `013` supplies drone/aerial capture provenance; migration `014` supplies the fail-closed Ryan-only system-owner lock; migration `024` restores the unique task conflict target required by the lead follow-up trigger.

## Worker release gate

Deploy the four agent workers only after the target database has migrations `008` and `009`. Each worker must emit a healthy heartbeat, process a test event into `agent_runs`, retry the same event without duplication, and fail closed across workspace boundaries. Until those checks pass, keep the workers pilot-only and leave outbound communications, estimate approval, contracts, and payments behind human approval.

## CapOut release gate

The web adapter is `POST /api/claims/capout`. It requires an authenticated user, a workspace UUID, and an HTTPS source URL. It is disabled with a clear `503` response when `CAPOUT_API_KEY` is absent. Do not test it with customer documents until data-processing terms and retention have been reviewed and an authorized sample claim is available.

The NOAA adapter is `GET /api/storms/nws`. It uses the official NWS API with a descriptive User-Agent and stores only candidate evidence. It must not be used as an automatic date-of-loss attestation.

The drone evidence adapter is `POST /api/measurements/drone`. It records metadata for an approved HTTPS asset; it does not operate a drone, certify an orthomosaic, or upgrade an image to a claim measurement without human review.

## Ryan-only update policy

The application configuration surfaces are protected by `public.is_system_owner()`. Before enabling updates, Ryan must run the one-time activation statement in migration `014` with the UUID of his authenticated Supabase user. Until that row exists, automation rules, price books, price-book items, and retailer watchlists are write-blocked for everyone. On GitHub, protect `main` and require the ROOF OS CI workflow; the only repository administrator currently verified is `Gtownrter77`.

## Weekly Home Depot refresh

Add approved material searches to `retailer_price_watchlist`. Vercel invokes `GET /api/cron/retailer-prices` every Monday at 04:00 UTC using `CRON_SECRET`. The job skips fresh seven-day snapshots, reserves each provider inquiry transactionally, stops at 100 inquiries per workspace per calendar month, and stores retailer reference responses for review. It does not automatically convert retail prices into insurance-approved estimate rates.
