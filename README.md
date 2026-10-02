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
- Report standard: `GOLDEN-REPORT.md`
- How to operate it: `OWNER-MANUAL.md`
- What is real vs leftover: `STATE-OF-THE-UNION.md`


## 2026-10-02 current verified checkpoint

**Repository:** `Gtownrter77/roof-os`  
**Production URL:** https://roof-os-lemon.vercel.app  
**Current `main`:** `f29981076c23b7a289b579c2852c916be368325e`  
**Hardening branch:** `backend/production-hardening-20261002`  
**Hardening scope:** receptionist workspace authorization, tenant isolation, payment boundary, outbound provider authorization, and booking RPC integrity.

### Verified in this checkpoint

- The hardening branch was reconciled with the latest `main`, including the 2026-10-02 prototype-disclosure QA commit.
- The hardening branch contains exactly the seven intended receptionist-hardening files on top of the current `main` tree.
- Supabase migration `receptionist_workspace_integrity` (repository migration file `043_receptionist_workspace_integrity.sql`) is applied to production project `xksumagfbegdlapwysps`.
- Production `leads.workspace_id` is non-null with **0 missing values across 2 live leads**.
- The receptionist booking RPC is SECURITY DEFINER with an empty search path and execution restricted to `service_role`; anonymous and authenticated execution are denied.
- Live two-workspace simulations verified workspace-local visibility and admin boundaries: the second workspace sees 0 leads and 0 receptionist sessions; cross-workspace admin checks fail closed.
- Negative RPC tests rejected cross-workspace creator/lead combinations and left no test rows behind.
- The final production integrity audit reported zero mismatches for leads, appointments, receptionist events, invoices, payment links, and payment/lead relationships.
- Latest hardening CI run #567 completed successfully across web, mobile, preview-build, and migration-safety. A fresh CI run will validate the post-2026-10-02 `main` sync as this branch advances.

### What this means

The **receptionist hardening scope is verified complete**. This does not mean every ROOF/OS feature is commercially verified.

### Still outside this scope

Pre-existing Supabase advisor findings remain: six authenticated SECURITY DEFINER warnings and disabled leaked-password protection. They are not treated as receptionist tenant-bypass evidence and were not changed in this hardening pass.

The open PR is #72. **Do not merge it automatically.**


## 2026-10-02 receptionist hardening — final handoff checkpoint

**Current main:** `f29981076c23b7a289b579c2852c916be368325e`  
**Current hardening branch:** `f81278881cf6e28809b6317811a7614e0293338f`  
**PR:** #72 — open; merge only on explicit owner direction.

The hardening branch is now synchronized with current `main` and is **0 commits behind**. The current `main...backend/production-hardening-20261002` comparison shows the intended seven receptionist-hardening files as the application/code delta: Stripe payment-link authorization, Twilio voice/SMS authorization and lead scoping, Twilio session workspace scoping, receptionist lead tenancy, regression contracts, and migration 043.

Production migration `receptionist_workspace_integrity` is applied and verified in Supabase project `xksumagfbegdlapwysps`. Production checks showed 0 missing lead workspace IDs, cross-workspace negative booking tests rejected, worker-only booking RPC execution enforced, and 0 relationship mismatches across the audited receptionist/payment records.

CI run **#567** passed web, mobile, preview-build, and migration-safety for the synchronized application tree. This documentation checkpoint changes documentation only; the next branch CI run is the final post-handoff verification gate.

The broader ROOF/OS product remains a separate status question. Existing Supabase advisor findings and other incomplete end-to-end/commercial verification items are documented rather than silently treated as resolved.

## Admin page upgrade, 2026-10-02

`app/admin/page.tsx` on branch `upgrade/admin-page-20261002` no longer shows hardcoded users, leads, revenue, or storage. Signed-in counts come from the current workspace. Revenue and storage stay Unknown. This change is not on `main` and is not the live site at https://roof-os-lemon.vercel.app.

Checks on that branch: `npx tsc --noEmit` passed, and `npm run build` passed with `/admin` in the route list. No signed-in browser session was opened. Live counts were not queried.

## Files 2-7, 2026-10-02

On branch `upgrade/admin-page-20261002`:

- `app/ai-train/page.tsx` is labeled a local checklist. Steps were kept.
- `app/ai/page.tsx` no longer starts with a fake address or inspector. The draft stays in the browser.
- `app/analytics/page.tsx` no longer shows hardcoded leads, rates, or revenue. Workspace counts load when signed in. Rates and revenue stay Unknown.
- `app/chat/page.tsx` no longer shows fake people. Messages stay in this browser.
- `app/deck/page.tsx` and `app/doors-windows/page.tsx` keep their calculators and now say the result is a local example, not a saved bid.

`npx tsc --noEmit` passed. `npm run build` passed and listed `/ai`, `/ai-train`, `/analytics`, `/chat`, `/deck`, and `/doors-windows`. No signed-in browser session was opened. Not on `main`.

## Rule fix, 2026-10-02

- Backup branch: `backup/pre-money-rule-fix-20261002`
- Backup SHA: `6df7c849150423ccdfead732a5b2868c57974533`
- Remote backup verified with `git ls-remote`.
- This branch: `fix/no-unapproved-money-20261002`
- Deck and door screens no longer display dollar figures. Price stays Unknown until a human approves it.
- `npx tsc --noEmit` passed on this branch.
- Signed-in production check is still open. This branch is not merged. Local build is not production verification.

## Files 7-15, 2026-10-02

- Backup: `backup/pre-files-7-15-20261002` at `dd4c568ba7b6570e7bb030622c31bb7b4b9c6742`.
- Branch: `upgrade/files-7-15-20261002`.
- Export no longer downloads fake people. Missing fields stay Unknown.
- Help claims that were not checked now say Unknown.
- Home Depot list no longer shows prices. Price stays Unknown.
- Integrations, manual, notifications, plans, and predict are labeled local. They are not a live record.
- `npx tsc --noEmit` passed. Not merged. Signed-in check is still open.
