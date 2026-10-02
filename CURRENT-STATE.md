## 2026-10-02 Current Evidence Update — supersedes stale current-status claims

**Current main observed:** 41162bb9359ffb26dac40dc993e59795af3a70e5

This section is the current evidence boundary for this repository. Historical entries below are retained as history and are not proof of present production behavior.

### Current repository / CI evidence

- main currently resolves to 41162bb9359ffb26dac40dc993e59795af3a70e5.
- CSP work is isolated on PR #71, branch fix/csp-nonce-20261002, head e25ebe21e7fe98fe0127d5a8069ac6ecbdec9bad.
- GitHub Actions run #531 for that exact CSP head completed successfully. PR #71 is not merged.
- Backend hardening PR #72 is open at head 4c5063420dbc63aec857051ecc946ace17d34428. Its original backend-only scope was later expanded by commits 1c19f7d0a4c482b62ef9dad830b8f44221236aad and af309170939ece47fc5b12228a7ad8ab7a9e4e97, which add frontend route, prototype-disclosure, and Supabase-client/test changes. Therefore PR #72 must not currently be treated as backend-only.
- PR #70 still proposes 043_inspection_activity_atomicity.sql and remains open. Production already contains a different 043 migration, so the migration prefix must be reconciled before PR #70 can be applied.

### Current Vercel evidence boundary

- The connected Vercel account currently exposes zero accessible teams/projects to this task.
- GitHub reports the CSP head's Vercel status as failure: deployment rate limited — retry in 24 hours.
- Therefore production deployment, production environment-variable inspection, scheduled cron execution, and browser console verification remain UNVERIFIED.

### Current production Supabase observations

Observed directly on project xksumagfbegdlapwysps:

- Production migration ledger now includes 20261002182249 — receptionist_workspace_integrity.
- public.leads.workspace_id is NOT NULL.
- public.book_receptionist_appointment exists as a SECURITY DEFINER function; repository migration source restricts EXECUTE to service_role.
- leads: 2
- estimates: 0
- photo_estimate_workflows: 0
- receptionist_events: 0
- receptionist_sessions: 0
- auth.mfa_factors: 0
- auth.mfa_challenges: 0
- auth.mfa_amr_claims: 7

The requested authenticated MFA → lead → estimate production workflow has still not been exercised in the currently observed data: there are 0 MFA factors and 0 estimates.

**Production schema/source drift warning:** PR #72 states that migration 043 was applied directly to Supabase and no application deployment was performed. Current `main` still contains `resolveLead()` in `lib/receptionist-actions.ts` with a receptionist lead insert that omits `workspace_id`, while production now requires `leads.workspace_id` to be non-null. A live application failure has not been claimed because Vercel production deployment access remains unavailable, but the source/schema combination is unsafe until the corresponding application code is deployed and runtime-tested.

Supabase security advisors currently report six authenticated SECURITY DEFINER functions and leaked-password protection disabled. These require backend review; they are not, by themselves, evidence of a tenant-isolation bypass.

### Current product-truth findings

- `app/ai/page.tsx` is a simulated report generator: it uses hard-coded inspection data, a local timeout instead of an AI/backend call, and non-functional approval buttons. It is not listed in `PrototypeNotice.tsx` or the prototype guardrail test on current `main`.
- The current `main` sources for `/chat`, `/export`, `/search`, `/portal`, `/invoices`, and `/notifications` contain hard-coded customer/activity data and no Supabase/API data loading. Those routes are also not currently listed in the prototype disclosure set checked by the source audit.
- These findings are source-level product-truth defects. They do not establish how production currently behaves because browser/runtime deployment access remains unavailable.

### Current verification rule

Do not label production behavior VERIFIED unless the behavior was directly exercised and the evidence is recorded. Schema/migration presence is evidence of deployment, not proof of end-to-end application behavior.

# ROOF/OS Current State

## 2026-10-02 Post-MFA Remediation Addendum

**Actual main after evidence-sync merge:** `7918fa5e7c277b9e2c8d2b6c3686a0dee85ff425`

PR #65 was merged after the full repository CI workflow passed: web, preview-build, mobile, and migration-safety all succeeded.

The privileged-user MFA gap identified against the canonical build specification was remediated. Owner/admin workspace users are now required to reach Supabase Auth AAL2 before accessing the application, and `/auth/mfa` provides TOTP enrollment/challenge verification.

The profile screen's hard-coded demo identity was also removed and replaced with authenticated Supabase user/workspace data.

The merged commit's current Vercel status is **failure due to Vercel build-rate limiting** (`upgradeToPro=build-rate-limit`). This is a platform/account deployment constraint, not a passing production deployment. Production deployment therefore remains unverified until a successful deployment is observed.

## 2026-10-02 Evidence Correction Addendum

**Actual main at time of correction:** `7e0b0d1807a3bc0ff9782c19271cfa276a7dc3b3`

The earlier addendum's `5508485bff1d895a4c7790986d48b209cb3d2dc5` value was stale. It described an earlier verified point, not the actual current `main`. This document now records the distinction explicitly.

The current repository evidence also does **not** support a fully verified commercial-release claim. In particular, privileged-user MFA enforcement is not present in the checked-out source evidence, and the runtime gates listed below remain unproven until exercised.

## 2026-10-02 Final Continuation Addendum

**Verified main:** `5508485bff1d895a4c7790986d48b209cb3d2dc5`

**Verified pre-change backups:** `backup/pre-receptionist-retry-20261002` and `backup/pre-inspection-task-idempotency-20261002`.

**Verified post-change backup:** `backup/post-inspection-task-idempotency-20261002`.

### Verified continuation work

- PR #58 fixed the Vercel Hobby cron-frequency defect; Vercel status succeeded.
- PR #59 changed inspection-quality and receptionist cron routes so internal worker/provider failures produce non-2xx responses instead of false 2xx success. CI run #326 passed; PR #59 merged as `8d4e2eb670060b668743472e9410c4d47bf96578`; Vercel status succeeded.
- PR #60 refreshed this state document to the verified post-PR-59 baseline; CI run #332 passed; PR #60 merged as `a13cb6f09b95fbd9f3c42c3a348558e8cbcc456c`; Vercel status succeeded.
- PR #61 added bounded receptionist retry scheduling using the existing `attempt_number` and `next_attempt_at` fields: failed attempts remain failed, then a new queued attempt is created after 1 hour and then 4 hours, capped at three attempts. CI run #339 passed; PR #61 merged as `2da96b58316a0b038da78409fe5aa3e9cb1fd720`; Vercel status succeeded.
- PR #62 made inspection-quality review-task creation explicitly idempotent by supplying the existing workspace-scoped `tasks.automation_key` uniqueness key. CI run #346 passed; PR #62 merged as `5508485bff1d895a4c7790986d48b209cb3d2dc5`; Vercel status succeeded.
- Production Supabase migration history remains through migration 042, `golden_report_review_controls`.
- Supabase security advisors still report six authenticated SECURITY DEFINER warnings and leaked-password protection disabled. The six RPC warnings match the repository's documented least-privilege design: RLS helper/direct user-facing RPCs intentionally remain available to authenticated users, while trigger-only and worker-only functions are restricted. These remain hardening/review items, not observed tenant-bypass evidence.

### Current Vercel cron configuration

- `/api/cron/retailer-prices` — weekly, Monday 04:00 UTC.
- `/api/cron/inspection-quality` — daily, 05:00 UTC.
- `/api/cron/receptionist-followups` — daily, 06:00 UTC.

### Evidence boundary

ROOF/OS is **not being marked fully commercially verified** by this document. Remaining runtime gates include real two-user/two-workspace RLS and Storage isolation, authenticated browser CRUD/magic-link verification, invitation delivery/acceptance, actual scheduled cron/provider execution evidence, live provider tests, multi-workspace UI switching, mobile device/APK verification, and direct Vercel environment/project inspection. The active Vercel connector remains unauthorized for direct project inspection even though GitHub's Vercel status checks are succeeding.

---

## 2026-10-02 Verified Continuation Addendum

**Verified main:** `8d4e2eb670060b668743472e9410c4d47bf96578`

**Verified pre-change backup:** `backup/pre-cron-observability-20261002` points to the main commit immediately before cron observability changes.

**Verified post-change backup:** `backup/post-cron-observability-20261002` points to the merged cron observability commit.

### Verified changes since the prior state document

- PR #55 Golden Report controls are merged; production migration 042 is applied.
- PR #56 inspection-quality worker is merged.
- PR #57 receptionist follow-up scheduling is merged.
- PR #58 corrected the Vercel Hobby cron frequency defect introduced by PR #57. The affected every-15-minute schedules were changed to daily schedules.
- The corrected main commit received a successful Vercel status.
- PR #59 made cron worker/provider failures observable: inspection-quality failures now return HTTP 500, and receptionist provider failures now return HTTP 502 after recording per-item failure state.
- PR #59 CI run #326 completed successfully.
- PR #59 was merged into main as `8d4e2eb670060b668743472e9410c4d47bf96578`.
- The merged main commit received a successful Vercel status.
- Supabase production migration history includes `20261002140543 golden_report_review_controls`.
- Supabase security advisors currently report six authenticated SECURITY DEFINER warnings and leaked-password protection disabled. The six RPC warnings are consistent with the repository's documented design: RLS helper RPCs and intended signed-in RPC boundaries remain executable by authenticated users, while trigger-only and worker-only helpers are restricted. These warnings remain review/hardening items, not proof of a tenant-isolation bypass.

### Current cron configuration

- `/api/cron/retailer-prices` — weekly, Monday 04:00 UTC.
- `/api/cron/inspection-quality` — daily, 05:00 UTC.
- `/api/cron/receptionist-followups` — daily, 06:00 UTC.

The application code now distinguishes scheduled invocation success from worker/provider failure instead of returning a false 2xx success after an internal failure. Actual successful scheduled execution and provider outcomes remain runtime evidence gates.

### Evidence boundary

This addendum does **not** claim full commercial readiness. The remaining unverified gates documented below still apply, including real two-user/two-workspace RLS and Storage isolation, authenticated browser CRUD/magic-link verification, invitation delivery/acceptance, real cron execution/retry/provider evidence, live provider tests, multi-workspace UI switching, mobile device/APK verification, and direct Vercel environment/project inspection.

---

## 2026-10-02 Cyber/Production Continuation — superseding evidence

**Verified main:** `cd57ba6caf86171ea0b1c3bb3851e22806527e43`

**Verified backup before documentation work:** `backup/pre-cyber-doc-refresh-20261002` points to the same main commit.

### Changes actually merged and deployed

- PR #50 was merged into `main` after its corrected CI run passed.
- Production CI run #239 passed all four jobs: web, mobile, preview-build, and migration-safety.
- Vercel reported **success** for the merged main commit.
- Supabase migration `041_aerial_workspace_consistency` was applied successfully to project `xksumagfbegdlapwysps`.
- Supabase migration history now includes migrations through `aerial_workspace_consistency`.
- Migration 041 enforces workspace equality between aerial measurements and their inspection/photo parents, and between aerial measurements and roof geometry children.
- The invitation flow now has server-side Supabase Auth invitation delivery plus an acceptance page. **Runtime email delivery/acceptance is still unverified** because production Vercel environment/configuration access is not available through the current connector.

### Cybersecurity evidence

- The merged branch passed the repository security gate, TypeScript, production build, aerial test, CRM missing-spokes test, API-security test, auth-flow test, photo/measurement/AI contract tests, migration-safety checks, and dependency checks.
- The production database currently has two workspaces, and existing inspection/photo data was checked for workspace consistency before migration 041 was applied; no mismatches were found.
- Supabase security advisors still report six authenticated `SECURITY DEFINER` functions as warnings. These are existing, intentional authenticated RPC boundaries used by workspace/auth logic; the worker-only booking helper remains restricted. This is a review item, not evidence of an observed cross-tenant bypass.
- Supabase also reports **Leaked Password Protection disabled**. That setting could not be changed through the available project connector, so it remains an explicit security hardening item.
- No service-role secret was printed or committed. Repository CI contains secret-pattern scanning.

### Remaining evidence gates

This document does **not** mark ROOF/OS as fully commercially verified. Remaining runtime evidence includes real two-user/two-workspace RLS and Storage isolation, authenticated browser CRUD/magic-link verification, real invitation delivery/acceptance, cron success/retry/provider failure evidence, live provider tests, multi-workspace UI switching, mobile device/APK verification, and Vercel environment-variable/project inspection.

**Evidence date:** 2026-09-18 UTC

**Repository:** `Gtownrter77/roof-os`

**Release-candidate baseline:** `86de783` plus this working-tree remediation

**Production URL:** <https://roof-os-lemon.vercel.app>

**Supabase project:** `xksumagfbegdlapwysps`

## Evidence standard

This is the authoritative current-state record for the present release candidate. Historical handoff documents remain useful history but are not proof. A status is assigned only from observed source, executed checks, live Supabase inspection, or HTTP behavior.

| Status | Meaning |
| --- | --- |
| **VERIFIED** | Actual behavior was exercised and the expected result observed. |
| **PARTIAL** | Some layers are proven, but the full UI/API/auth/RLS/production chain is incomplete. |
| **FAILED** | A defect was observed and is not corrected in the current candidate. |
| **BLOCKED** | A required external access or account is unavailable in this task. |
| **UNKNOWN** | No adequate test evidence was available. |
| **NOT IMPLEMENTED** | The capability is absent or only an experiment/configuration rather than a working feature. |

## What was found and recovered

The supplied archive was a handoff package rather than the authoritative repository. A fresh GitHub clone found `main` clean at `86de783`, with no local-only commits, stashes, detached HEAD, or incomplete merge/rebase. Multiple preserved remote branches and open pull requests exist; none was merged automatically.

Live Supabase migration history contained applied invitation and receptionist migrations absent from `main` source. The known source files for migration 028 (invitation acceptance) and migrations 029–030 (receptionist schema and atomic booking) were recovered verbatim from their preserved remote branches. Existing historical migration filenames were not renamed, including duplicate 021–023 prefixes.

## Changes in this release candidate

The live database now contains three forward migrations applied during this task:

1. **Security-definer least privilege.** Public and anonymous execution was revoked from all eleven audited `SECURITY DEFINER` helpers. Trigger/setup helpers are not browser callable, and the receptionist booking procedure is restricted to `service_role`.
2. **Explicit active-workspace selection.** `user_active_workspaces` stores a user's selected workspace under self-only RLS. `current_workspace_id()` honors the selection only when the user retains membership, with a deterministic compatibility fallback for single-workspace users. The web UI now exposes a selector only to authenticated users with two or more workspaces.
3. **Storage ownership enforcement.** The private inspection-photo bucket policy now requires members to write only to `<workspace_id>/<their_user_id>/...`. Workspace administrators retain permitted workspace management visibility.

The checked-out source now includes the recovered migration files and forward migration sources 031–033. `tsconfig.tsbuildinfo` is ignored to avoid committing generated local build metadata.

## Three-level verification

### Level 1 — static and build

`git diff --check`, web TypeScript, release security checks, production dependency audit, production Next.js build, field TypeScript, and Expo configuration validation all passed. The web production dependency audit reported zero high-severity vulnerabilities. The field package's general audit reports ten moderate development-toolchain findings under Expo; they are tracked as maintenance risk rather than treated as a release pass.

### Level 2 — runtime

A standalone local production server returned `200` for `/auth/login` with the expected security headers, redirected unauthenticated `/leads` to login with `307`, and rejected an unauthenticated cron request with `401`. The public Vercel service returned the same `200` login, protected-route redirect, and unauthenticated cron rejection behavior.

### Level 3 — live Supabase behavior

Live privilege checks verify that anonymous execution is denied for every audited definer helper. Authenticated execution of the receptionist booking function is denied, whereas service-role execution is permitted. A synthetic nonmember session saw zero leads, inspection sessions, inspection photos, and private Storage objects, and obtained no active workspace. A permitted owner-path Storage insert succeeded inside a transaction that was rolled back; an otherwise-identical foreign-user path insert failed with a row-level-security violation. Active-workspace persistence also succeeded inside a rolled-back authenticated transaction.

## Level 3 scoreboard

| Capability | Status | Evidence and remaining boundary |
| --- | --- | --- |
| Repository baseline and release source | **VERIFIED** | Fresh clone clean and synchronized with `origin/main`; recovered applied migration sources are additive. |
| Web build and type safety | **VERIFIED** | Production build and TypeScript succeeded. |
| Field compile/config | **VERIFIED** | Field TypeScript and Expo config validation succeeded. |
| Web production dependency risk | **VERIFIED** | `npm audit --omit=dev --audit-level=high` found zero vulnerabilities. |
| Field dependency risk | **PARTIAL** | Expo development toolchain reports ten moderate transitive findings. |
| Public login and unauthenticated protected routes | **VERIFIED** | Live Vercel login `200`; `/leads` `307` to login. |
| Security headers | **VERIFIED** | Local and live login responses contained CSP, HSTS, frame denial, MIME, referrer, and permissions policies. |
| Cron unauthenticated failure | **VERIFIED** | Local and live cron paths return `401` without the bearer secret. |
| Cron scheduled execution and provider outcomes | **PARTIAL** | Schedule is configured; successful invocation, retry, rate limit, timeout, and provider-unavailable execution are unproven. |
| SECURITY DEFINER exposure | **VERIFIED** | Anonymous execution denied; worker-only booking function restricted to `service_role`. |
| Active workspace selection | **PARTIAL** | Persistence and membership-gated selection tested; live project has no multi-workspace user for a switch test. |
| Leads and inspection RLS isolation | **PARTIAL** | A nonmember session was denied all visible rows; two real user/two workspace tests are absent. |
| Private Storage path authorization | **PARTIAL** | Permitted and forbidden paths were exercised in rolled-back transactions; two real-user read/download tests are absent. |
| Owner/system configuration controls | **PARTIAL** | Schema/policies and authorized owner data are present; direct user-interface approval tests remain absent. |
| Invitations | **PARTIAL** | Live acceptance function source is recovered and authenticated-only; no delivery, real acceptance, or membership lifecycle test was run. |
| Price books and retailer reference pricing | **PARTIAL** | Schema and guarded code exist; no live provider success/failure/rate-limit test or customer pricing claim is validated. |
| Measurement and building-code guidance | **PARTIAL** | The code intentionally describes review-gated footprint/reference behavior; authoritative jurisdiction or certified-measurement evidence is absent. |
| Photo estimate approvals | **PARTIAL** | Source and RLS policy inspection show an admin guard; real actor-based approval tests are absent. |
| Automation agents | **NOT IMPLEMENTED** | Configuration/runtime tables exist, but no four-worker heartbeat, retry, idempotency, restart-recovery chain was observed. |
| Receptionist, payments, and external messaging | **NOT IMPLEMENTED** | Live tables/functions exist but the checked-out main application does not contain the supporting production routes or verified provider flows. |
| Mobile field application | **PARTIAL** | Source compiles; device, authentication, sync, upload, and signed APK verification remain unproven. |
| Experimental/prototype screens | **NOT IMPLEMENTED** as production features | Routes such as `/quantum`, `/genetic`, `/vr`, and related experiments remain outside the verified product surface. |
| Direct Vercel project configuration/environment review | **BLOCKED** | The enabled Vercel connector returns no accessible team/project context in this task. |

## Remaining blockers before full commercial readiness

The current candidate is suitable for continued internal pilot use, but it is **not VERIFIED as a full commercial production release**. Required evidence still includes a real two-user/two-workspace RLS and Storage test, authenticated browser CRUD with a magic-link callback, invitation delivery and acceptance, cron success/failure/retry evidence, live provider tests, a multi-workspace selector test, mobile device and APK tests, and Vercel environment-variable/project inspection. No database migration or background worker change can replace those runtime proofs.

The authenticated browser and Vercel project configuration checks are currently blocked because My Browser is disabled and the active Vercel connector exposes no project team. No customer communications, payments, credential rotation, license purchase, or destructive data operation was performed.

## Historical notes

Earlier `HANDOFF.md`, `STATE-OF-THE-UNION.md`, and other project documents preserve prior work claims. Refer to this document and `LEVEL3-SCOREBOARD.json` for the present evidence-based status.
