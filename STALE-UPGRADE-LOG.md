# Stale file upgrade log

One file at a time. Do not start the next file until the current file has a 3-level check.

## 1. app/admin/page.tsx

- Last prior commit: `e08b495` on 2026-08-16.
- Upgrade commit: `4094de82700a9188e09971c7c9e36a2cd5a9d4b4` on branch `upgrade/admin-page-20261002`.
- Removed hardcoded users, leads, inspections, reports, revenue, and storage numbers.
- Counts now come from the signed-in workspace: members, leads, inspection sessions, inspection photos.
- Revenue and storage stay Unknown.
- Missing workspace or query error stays Unknown.

### 3-level check

- Level 1, static: `npx tsc --noEmit` passed on 2026-10-02 after `npm ci` on this branch.
- Level 2, compile: `npm run build` passed on 2026-10-02. The build output includes `/admin`. No signed-in browser session was opened against https://roof-os-lemon.vercel.app. This machine has no `.env.local`.
- Level 3, data: reads are workspace-scoped selects under existing RLS. No service-role key is used. Live count values were not queried.

File 1 is complete for this branch. It is not on `main`. Next file is not started.

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
