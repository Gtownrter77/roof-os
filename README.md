# ROOF/OS

Software for a roofing company that actually lives in the field.

Office runs the pipeline. The phone takes the pictures. The roof keeps a record after you get paid.

Live site: https://roof-os-lemon.vercel.app

## What this is

A workspace for one shop.

- Leads and job files
- Calendar and tasks
- Inspections and photos tied to the property
- Owner price books and tax rates you control
- A Roof Passport and warranty checklist so the job does not disappear at final payment

It is built for a small roofing company first. Not a call center. Not a fake Xactimate.

## What works today

- Sign in with a magic link
- Add a lead, open the record, schedule an inspection
- Take photos that attach to that inspection
- Draft an inspection report that still needs your review
- Save labor rates and local tax in your price book
- Live Home Depot and Lowe's retailer reference pricing, refreshed weekly by default or on demand; you approve before anything hits an estimate

## What is not ready

- Insurance prices pulled from a photo
- Licensed carrier price lists
- Invite email that just works with no extra setup
- A finished phone app you can download from a store

If a screen looks like science class, ignore it. That is leftover experiment UI.

## Run it on your machine

```bash
cp .env.example .env.local
# paste your Supabase URL and anon key
npm ci
npm run dev
```

SQL files live in `supabase/migrations/`. Run them in order on your Supabase project or the new screens will have nowhere to save.

```bash
npm run build
```

## Phone app

The field shell is in `apps/field`. It is Expo. A store build still needs an Expo login.

```bash
cd apps/field
npm ci
npx eas login
npx eas build --platform android --profile preview
```

## House rules

- Do not commit secrets. Ever.
- Cron jobs need `Authorization: Bearer` plus your cron secret.
- Home Depot and Lowe's prices are live retailer references with source, market/ZIP, retrieval time, and effective-date provenance. They are formatted for Xactimate-friendly workflows, but are not licensed Xactimate or carrier rates and are not a bid until you approve them.

## Where to read more

- Product direction: `PRODUCT-VISION.md`
- How to operate it: `OWNER-MANUAL.md`
- What is real vs leftover: `STATE-OF-THE-UNION.md`
