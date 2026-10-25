# Deployment

**Current checkpoint — 2026-10-21:** `main` is `b6520da825cb31cf538894fbfc44c87a38a752c3`; post-merge CI passed. Production migration parity, authenticated two-workspace checks, physical-device behavior, and provider execution remain unverified. Run `.github/workflows/staging-migration-verify.yml` only against an owner-designated protected staging environment; never use it as a production deploy mechanism.

ROOF/OS is connected to the free Vercel Hobby project `roof-os`.

Production domain: https://roof-os-lemon.vercel.app

The GitHub `main` branch is connected for automatic production deployments.

## Required production secrets

Configure `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and the server-only `CAPOUT_API_KEY`, `RAPIDAPI_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, and optional `CLAIMS_DOCUMENT_WORKER_URL` in the deployment secret manager. Vision inference uses `OLLAMA_VISION_API_BASE_URL` (current local default `http://localhost:20128/v1`) and `OLLAMA_VISION_MODEL` (default `qwen3-vl:8b`); the endpoint must be reachable from the app runtime. In Vercel, `localhost` refers to the function runtime itself, so production inference requires a reachable private worker or an explicitly exposed, authenticated endpoint. No Gemini API key is used by the vision routes. Never place a Supabase service-role key, CapOut key, RapidAPI key, worker URL with credentials, or cron secret in `NEXT_PUBLIC_*` variables, the browser bundle, or the field app.

## Migration order

Apply the repository migrations through `036_photo_estimate_ai_analysis.sql` to the target Supabase project in the recorded production order. Do not rename or renumber the historical duplicate prefixes `021`, `022`, or `023`; follow `MIGRATION-ORDER.md` and the target Supabase migration ledger. Verify RLS using two workspaces before enabling customer-facing estimate or claims-import flows. Migration `008` supplies claims line-item and heartbeat tables; migration `009` supplies claims-import and idempotent agent-run tables; migration `010` supplies the Home Depot reference-price cache and hard 100-inquiry monthly budget; migration `011` supplies the weekly watchlist and worker-only budget reservation; migration `012` supplies inspection measurements, NOAA storm evidence, and estimate review packets; migration `013` supplies drone/aerial capture provenance; migration `014` supplies the fail-closed Ryan-only system-owner lock; migrations `021`–`024` supply the photo-estimate workflow, measurement, and refresh schema; migration `027` applies the photo-estimate administrator update guard; migration `033` hardens private Storage ownership paths; migration `036` adds the non-authoritative AI analysis fields.

## Worker release gate

Deploy the four agent workers only after the target database has migrations `008` and `009`. Each worker must emit a healthy heartbeat, process a test event into `agent_runs`, retry the same event without duplication, and fail closed across workspace boundaries. Until those checks pass, keep the workers pilot-only and leave outbound communications, estimate approval, contracts, and payments behind human approval.

## CapOut release gate

The web adapter is `POST /api/claims/capout`. It requires an authenticated user, a workspace UUID, and an HTTPS source URL. It is disabled with a clear `503` response when `CAPOUT_API_KEY` is absent. Do not test it with customer documents until data-processing terms and retention have been reviewed and an authorized sample claim is available.

The free adapter is `POST /api/claims/local`. It requires the same workspace-admin and signed-Storage checks, then sends the document to the self-hosted Docling worker at `CLAIMS_DOCUMENT_WORKER_URL`. It stores `provider=owner_import` with `status=ready_for_review`. It does not produce Verisk/Xactimate ESX, licensed claim pricing, or an approved estimate. The worker must be private, allow only the configured Supabase Storage origin, enforce download and response limits, and delete temporary source files after parsing.

The recommended free worker is `workers/claims` with Docling (MIT). PaddleOCR (Apache-2.0) or OCRmyPDF (MPL-2.0) may be selected by the operator for OCR-heavy documents. The current Vercel Hobby deployment does not run this worker; use a persistent local or private host.

The NOAA adapter is `GET /api/storms/nws`. It uses the official NWS API with a descriptive User-Agent and stores only candidate evidence. It must not be used as an automatic date-of-loss attestation.

The drone evidence adapter is `POST /api/measurements/drone`. It records metadata for an approved HTTPS asset; it does not operate a drone, certify an orthomosaic, or upgrade an image to a claim measurement without human review.

## Ryan-only update policy

The application configuration surfaces are protected by `public.is_system_owner()`. Before enabling updates, Ryan must run the one-time activation statement in migration `014` with the UUID of his authenticated Supabase user. Until that row exists, automation rules, price books, price-book items, and retailer watchlists are write-blocked for everyone. On GitHub, protect `main` and require the ROOF OS CI workflow; the only repository administrator currently verified is `Gtownrter77`.

## Weekly Home Depot refresh

Add approved material searches to `retailer_price_watchlist`. Vercel invokes `GET /api/cron/retailer-prices` every Monday at 04:00 UTC using `CRON_SECRET`. The job skips fresh seven-day snapshots, reserves each provider inquiry transactionally, stops at 100 inquiries per workspace per calendar month, and stores retailer reference responses for review. It does not automatically convert retail prices into insurance-approved estimate rates.

## Daily agents and Vercel Hobby limits

Vercel Hobby allows at most two cron jobs, each running once per day. `GET /api/cron/daily` at 14:00 UTC dispatches `inspection-quality`, `receptionist-followups`, and `warranty-expiry`; the retailer refresh remains the second job. Do not add the individual agent paths back to `vercel.json` while on Hobby. Manual execution:

```bash
curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://<host>/api/cron/warranty-expiry
curl -fsS -H "Authorization: Bearer $CRON_SECRET" "https://<host>/api/cron/warranty-expiry?dryRun=1"
curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://<host>/api/cron/daily
```

`warranty-expiry` expires registrations in bounded batches (500) and creates at most 200 alerts per run; `?dryRun=1` reports `wouldCreate` without writing tasks or heartbeats.

## Public passport share

Apply migrations `055_passport_public_share.sql` and `056_public_passport_rate_limit.sql` before enabling sharing. Publishing requires workspace administrator access and sets `public_shared = true`; unpublishing revokes access immediately. The public endpoint is unauthenticated by design, returns only `property_address`, `homeowner_name`, `material_system`, `manufacturer`, `color`, `install_date`, and `status`, and is rate-limited per IP+token. No additional environment variable is required beyond the existing service-role key and `NEXT_PUBLIC_SUPABASE_*` values.
