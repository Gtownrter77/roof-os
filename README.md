# ROOF/OS

Workspace-scoped roofing operations system: office control plane (Next.js) plus camera-first field app (`apps/field`).

**Live app:** https://roof-os-lemon.vercel.app  
**Source:** https://github.com/Gtownrter77/roof-os

## What is real today

- Supabase email magic-link auth and session middleware
- Workspace-scoped leads, tasks, inspections, estimates, supplements, price books
- Owner labor rates and local tax persistence
- Retailer reference pricing (Home Depot snapshots). Not Xactimate / Verisk.
- Field app shell in `apps/field` (Expo). APK still needs an Expo token.

## What is not ready

- Insurance estimates from photos alone
- Licensed claims price lists
- ZIP-to-jurisdiction legal code lookup (state-family reference only)
- Team invitation email delivery / acceptance
- Most `/quantum`, `/genetic`, `/vr`, `/ar` style routes — UI shells, not products

Read [STATE-OF-THE-UNION.md](STATE-OF-THE-UNION.md) for the audit.

## Local setup

```bash
cp .env.example .env.local
# fill real Supabase URL + anon key
npm ci
npm run dev
```

Apply SQL in `supabase/migrations/` in order against the target project.

```bash
npm run build
npx tsc --noEmit
```

## Field app

```bash
cd apps/field
npm ci
npx eas login
npx eas build --platform android --profile preview
```

## Security rules

- Never commit `.env.local` or `SUPABASE_SERVICE_ROLE_KEY`
- Cron jobs must send `Authorization: Bearer $CRON_SECRET`
- Retailer prices are reference-only and require owner review before estimate use
