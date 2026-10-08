## 2026-10-07 final 3-level audit & mobile field AI checkpoint

**Current main commit:** `fb4b1c1608c65c4dad7cb560c3ddb7495123be8b`

### 3-Level Audit Results
1. **Level 1 — Security & Code Integrity (VERIFIED):**
   - Clean `tsc --noEmit` typecheck.
   - `release-check` passed (11 protected routes, security headers, secret scan).
   - `verify:security` passed.
   - All 25 test suite scripts passed cleanly (including `test:api-security`, `test:auth-flow`, `test:ai-vision-contract`, `test:ai-vision-endpoint`, `test:aerial`, `test:mobile-auth`, `test:mobile-offline-sync`, `test:ai-chat-bar`, `test:camera-audio`).
2. **Level 2 — Roofing Workflows & Business Logic (VERIFIED):**
   - Roof Passport digital twin, 2021 IRC code upgrades, NOAA storm corroboration, interactive HTML5 signature pad, 3-stage progress invoicing, and owner price book margin floor (35%).
   - Strict measurement & siding estimate authority gates prevent client-side quantity manipulation or unapproved pricing.
3. **Level 3 — Production Build & Mobile Field App Shippability (VERIFIED):**
   - Next.js production build (`npm run build`) compiled successfully with zero route errors across all static and dynamic paths.
   - Clean git working tree and verified commit baseline.

### Top-Level AI Automated Features in Mobile Field App
- **AI-Vision Contract Enforcement:** Standardized vision schema contract validating photo observations, facet detection, and damage tagging while strictly enforcing non-authoritative rules (no raw pitch text, no unverified insurance claims).
- **Offline AI Sync & Resilient Gateway:** Field app captures photos and metadata in local SQLite/SecureStore; queues uploads and dispatches Gemini AI vision contracts automatically upon network reconnection.
- **Inspection Quality Agent (Agent 3):** Automated real-time analysis of field photo coverage, missing required pitch/damage categories, and uncaptioned captures, automatically enqueuing review tasks for field technicians.
- **AI Copilot & Chat Bar Integration:** In-app assistant and voice-to-text site notes processing (via Web Speech API / MediaRecorder) attached directly to inspection evidence.
- **Receptionist AI Follow-up Link:** Inbound voice/SMS AI leads convert directly into mobile field inspection tasks with full workspace tenant isolation.

**Authority boundary:** AI observations remain strictly non-authoritative recommendations. Technician verification, source attribution, required signatures, and manager approval remain mandatory before a Golden Report or estimate is customer-ready.

# ROOF/OS

## **MANDATORY CHECKPOINT LAW — EVERY 3 VERIFIED WORK BATCHES**

> **After every third completed, verified work batch, commit and push the accumulated work, verify that the remote SHA matches the local commit, and update `HANDOFF.md`. Do not let a fourth batch accumulate. Checkpoint sooner before a handoff, long pause, task/device switch, major milestone, merge, or risky/destructive action. Never merge while required checks are pending or failing.**

The full rule is in [`UPDATE-CHECKPOINT-LAW.md`](UPDATE-CHECKPOINT-LAW.md).

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

- Sign in with a password, email link, or 6-digit email code
- Recover a forgotten password directly from the login screen with **Forgot password?**
- Add a lead, open the record, schedule an inspection
- Take photos that attach to that inspection
- Draft an inspection report that still needs your review
- Save labor rates and local tax in your price book
- Live Home Depot and Lowe's retailer reference pricing, refreshed weekly by default or on demand; you approve before anything hits an estimate

### Sign-in and password recovery

1. Open the production URL and enter your email address.
2. Use **Enter command center** if you know your password.
3. If you do not remember it, select **Forgot password?**, check your email, and open the reset link on the same device.
4. Choose a password with at least 8 characters, then return to sign in.
5. If email delivery is slow, use **Email link** or **6-digit code** instead.

Password-reset email requests are rate-limited. After a request, the login button displays a countdown and blocks duplicate requests until it reaches zero.

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
- Report standard: `GOLDEN-REPORT.md`
- How to operate it: `OWNER-MANUAL.md`
- What is real vs leftover: `STATE-OF-THE-UNION.md`
