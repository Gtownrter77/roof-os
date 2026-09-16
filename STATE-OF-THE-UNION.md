# ROOF/OS State of the Union — 2026-09-15

Repo: https://github.com/Gtownrter77/roof-os  
Production: https://roof-os-lemon.vercel.app  
Audit commit basis: `5fcff9d` plus `fix/sotu-hardening`

## Verdict

The core office loop is a real app, not a mock. Auth, RLS-backed persistence, and owner pricing exist. The product is not shippable as a sales-facing estimating platform until licensed claims pricing, invitation delivery, migration 019 on prod, and Vercel env/cron are confirmed.

## Strengths

- Next.js 15 + Supabase SSR auth with `getUser()` on nearly all APIs
- 19 ordered SQL migrations with RLS and a system-owner lock
- CI covers web build, field typecheck, and migration presence
- Honest provenance language on measurements and retailer prices
- Owner manual and operating cadence exist

## Weaknesses found

### Closed in `fix/sotu-hardening`

1. **Cron blocked by middleware.** `/api/cron/*` required a user session, so Vercel Cron would 307 to login. Cron paths now skip session auth; the route still requires `CRON_SECRET`.
2. **Open redirect on auth callback.** `next` accepted any URL. Now only same-origin relative paths.
3. **`/api/building-codes` had no `getUser()` check.** Auth required.
4. **`/onboarding` was public.** Auth required like the rest of the app.
5. **No root README.** Added.
6. **Dockerfile copied missing `public/` and used Node 18 vs CI Node 22.** Fixed.
7. **`.env.example` pointed at the live Supabase project ref.** Replaced with a placeholder.

### Still open — ops

- Confirm Vercel Production has `NEXT_PUBLIC_SUPABASE_*`, `SUPABASE_SERVICE_ROLE_KEY`, `RAPIDAPI_KEY`, `CRON_SECRET`.
- Apply migration `019_material_catalog_workspace_settings.sql` on project `xksumagfbegdlapwysps` if not already applied.
- Vercel preview deploys have failed independently of local `next build`.
- Expo APK needs `EXPO_TOKEN` / `eas login`.

### Still open — product honesty

- 50+ routes. Many (`/quantum`, `/genetic`, `/vr`, `/ar`, `/photo-estimate`) are shells. They inflate surface area and confuse what customers can actually do.
- Building codes resolve ZIP → city/state, then a hardcoded state family. Not a legal jurisdiction file.
- Measurements are OSM footprint candidates, not certified roof squares.
- No automated tests beyond `tsc` and string greps in CI.
- Invitation create API exists; email send/accept does not.
- `lib/supabase.ts` still creates a module-scope client; prefer `lib/supabase/client.ts` and `server.ts` only.
- Dead vars in `package.json` era: `NEXTAUTH_*` was leftover and is removed from `.env.example`.

### Still open — security posture

- Service-role usage in cron/worker is correct only if the key never ships to the client. Keep scanning CI for committed secrets.
- No license at repo root (field app has one).
- Hobby Vercel + public GitHub means treat this as internal ops software until RLS isolation is Level-3 tested across two workspaces.

## Fix order (do these next)

1. Merge `fix/sotu-hardening` after CI is green.
2. In Vercel: set cron secret, service role, RapidAPI key; redeploy production.
3. Run migration 019 in Supabase SQL editor; confirm `material_catalog` and workspace settings.
4. Two-account RLS test: user A cannot read user B leads/photos/price books.
5. Hide or label prototype routes in nav so the product tells the truth.
6. Implement invite accept + email, or remove the invite button from the UI.
7. Add one Playwright smoke: login redirect, authenticated dashboard, 401 on APIs without cookies.

## Do not claim

- Photo analysis produces a customer-ready insurance estimate.
- Home Depot / RapidAPI numbers are Xactimate or carrier-approved.
- Building-code results are permit-ready.
