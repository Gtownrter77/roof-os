> **Authoritative fresh audit — 2026-11-22:** Current GitHub `main` is `764976f209f9c4167b4df3a862712bd335a844a4` (verified with `git ls-remote`; exact-head CI run `44984769341` passed all five required jobs). The local `weak-links` branch is not part of this baseline until pushed. Field code SHA is `99792955cf69fb56c6473e3050b7d96dd9a31040` (PR #485). GitHub Release [field-apk-main-9979295](https://github.com/Gtownrter77/roof-os/releases/tag/field-apk-main-9979295) from run `44406863550`, version code `43`, SHA-256 `6d31895824bf36b1c04245b314dedd7cfd2a1ae14122a79f5d672ff1fc782b61`. Prior Metro APK `7008e22` is run `44404219619`, version code `42`. Current evidence does not prove production schema parity, deployed SHA, live provider execution, physical-device behavior, live two-workspace isolation, or backup/restore. Paragraphs below are historical unless explicitly marked otherwise.

> **Historical checkpoint — 2026-10-26 (superseded by the 2026-11-22 baseline above):** Source baseline `03d8cdd` with Phase 1 launch hardening. Production migrations `053`–`056` are now applied and recorded in the Supabase migration ledger. The Agent Action Ledger tables/RPC and mobile AI observation schema are live with RLS; the homeowner passport link remains publicly reachable and rate-limited; daily agent crons remain consolidated behind `GET /api/cron/daily` for Vercel Hobby. Authenticated two-workspace isolation, physical-device evidence, provider execution, passport positive-path testing, and backup/restore remain unverified external gates. See [GAPS-REVIEW.md](GAPS-REVIEW.md) for the dated ledger.

> **Historical checkpoint warning (updated 2026-10-09):** The checkpoint below was written against baseline `bfdc565` on 2026-10-08 and is not the current repository baseline. The then-current main was `a308459182e9a6867fb736240c6dc2af9f3aa6e9`. See [AUDIT-STATUS-2026-10-09.md](AUDIT-STATUS-2026-10-09.md) for current GitHub evidence and items that remain unverified. Do not treat older deployment or test claims in this file as verification of the current main commit or live production services.

## 2026-10-08 Main Branch Three-Level Audit Checkpoint

**Current main baseline before this audit:** `bfdc565` (Golden Report approval migration guard)

The repository has no open pull requests. Historical and backup branches remain on GitHub for traceability; their changes are represented in `main` or their pull requests are closed/merged.

### Master Settings & Toggle Layer Controls (`app/settings/page.tsx`)
1. **AI & Automation Toggles:** AI Virtual Receptionist, Inspection Quality Agent (Agent 3), Voice Command Copilot (OpenWhisper STT), Auto Follow-up Tasks.
2. **Pricing & Margin Floor Controls:** 35% Owner Gross Margin Floor Protection Guard, Retailer Material Price Surge Alerts, Dual Retailer Watchlist (Home Depot + Lowe's).
3. **Field Canvassing & Mobile Settings:** Canvassing Pin One-Click Lead Conversion, Digital Business Card (vCard) Module, Offline Local SQLite Sync Queue.
4. **Security & Compliance Gates:** Privileged MFA for Owner/Admin Users, Strict E.164 Phone Normalization (+1NXXNXXXXXX), TCPA Outbound Quiet Hours (8:00 AM – 8:00 PM), 24-Hour Stripe Payment Link Expiration.
5. **Golden Report & Evidence Rules:** 100% Photo Category Completeness Gate, Mandatory Technician Signature Sign-off, 2021 IRC Statutory Building Code Suggestions.

### 3-Level Audit Results
- **Level 1 (Security & Code Integrity):** `typecheck`, `release-check`, `verify:security`, `test:receptionist`, and production dependency audit passed.
- **Level 2 (Workflows & Business Logic):** the repository test suite passed after fixing the Node 22 TypeScript loading command for `test:ai-chat-bar`.
- **Level 3 (Production Build):** `npm run build` compiled 111 static/dynamic routes successfully with zero compilation errors.
> **Historical audit baseline — 2026-11-08:** `main` at that checkpoint was `7d9e5712f750a135e22bb4c127a60c74180fb344`. Older checkpoint paragraphs below are historical and must not be used as current deployment, migration, APK, or production evidence. The current source hardening adds bounded transcription input, fail-closed field configuration, workspace-bound estimate references, a manager-approval packet gate, fail-closed receptionist cron setup, and Expo SDK 57 patch alignment. Live deployment SHA, schema parity, EAS/device behavior, worker/provider execution, two-workspace runtime isolation, and backup/restore remain unknown. Field `npm audit` is clean and `npx expo-doctor` reports 21/21 checks passed after the Zod 4.6.6 override; keep that override under review as Expo updates its dependency declaration.
