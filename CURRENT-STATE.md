# ROOF/OS Current State

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
