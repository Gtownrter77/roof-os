> **Superseded for status decisions.**  
> Use [`CURRENT-TRUTH.md`](CURRENT-TRUTH.md) as the single authoritative status record (updated 2026-10-06).  
> This file retains historical evidence detail and is not deleted.

---

## 2026-10-05 final synchronized checkpoint

**Current main:** `5144836fbc0a949d94cce5e444cd8432dc7c990f`

The current main includes the verified integrity cleanup, the three UI loose-end fixes, and the AI-report authority hardening. The AI screen no longer fabricates a report from browser-entered text; it routes to the persisted photo-estimate workflow and is covered by a regression contract. The CI suite also now registers the existing invoice live-data regression command, which had been present as a test file but missing from package scripts.

**Three-level repository evidence:** the latest merged AI-authority change passed web, mobile, preview-build, migration-safety, build, typecheck, release, security, and the full regression suite, including the AI-report and invoice-live-data checks.

**Vercel boundary:** the current main commit has a Vercel status of **failure due to the account build-rate limit**. This is a platform deployment constraint, not a code-test pass. Production deployment is therefore not marked verified.

**Authority boundary:** AI observations remain non-authoritative. Technician verification, source attribution, required signatures, and manager approval remain mandatory before a Golden Report is customer-ready.

## 2026-10-05 synchronized repository checkpoint

**Current main:** `d72f734f616352e1ba38691bafcd1e82b07ae428`

This checkpoint supersedes older documentation snapshots. The current main now includes the latest integrity cleanup plus three additional verified loose-end fixes: building-code guidance requires a locality lookup before production guidance, workspace switching surfaces authentication/membership/request failures instead of silently failing, and lead CSV export neutralizes spreadsheet formula injection.

**Authority boundary:** AI observations remain non-authoritative. Technician verification, source attribution, required signatures, and manager approval remain mandatory before a Golden Report is customer-ready.

**Production boundary:** GitHub merge and CI evidence are not proof of a successful Vercel production deployment or live provider execution. Those remain separately evidence-gated.

# ROOF/OS State of the Union — 2026-10-02

**Repository:** `Gtownrter77/roof-os`  
**Production:** https://roof-os-lemon.vercel.app  
**Current `main`:** `f29981076c23b7a289b579c2852c916be368325e`  
**Active hardening branch:** `backend/production-hardening-20261002`  
**Supabase project:** `xksumagfbegdlapwysps`

## Executive state

ROOF/OS has a real office workflow with Supabase-backed persistence, workspace-aware authorization, inspection/reporting foundations, pricing configuration, automation infrastructure, and an AI receptionist surface.

The latest verified engineering work is a **receptionist workspace/tenant-isolation hardening pass**. That scope is complete at the code and production-database level. The application deployment itself was not changed by that pass.

This document separates verified behavior from broader product work that remains incomplete or unproven.

## Evidence standard

- **VERIFIED:** exercised and observed with supporting repository, CI, or live-database evidence.
- **PARTIAL:** implemented in meaningful layers, but an end-to-end proof is still missing.
- **BLOCKED:** required external access is unavailable.
- **NOT IMPLEMENTED:** absent or remains experimental.

## Current repository and release state

- Current `main` is `f29981076c23b7a289b579c2852c916be368325e`.
- That main commit adds explicit prototype disclosures for `/chat`, `/notifications`, and `/status`.
- The active hardening branch has been reconciled with that latest main baseline and contains the intended seven receptionist-hardening files on top of it.
- PR #72 remains open: https://github.com/Gtownrter77/roof-os/pull/72
- No automatic merge has been performed.

## Receptionist hardening — VERIFIED

The following boundaries are implemented and verified:

| Area | Status | Evidence |
|---|---|---|
| Receptionist lead lookup/creation | **VERIFIED** | Workspace + owner scoping; owner membership validated; new leads carry workspace ID. |
| Stripe payment-link authorization | **VERIFIED** | Authenticated user + workspace-admin check before provider action; ledger operations use authenticated client. |
| Twilio outbound voice | **VERIFIED** | Workspace-admin gate before provider action; optional lead ID is workspace-validated. |
| Twilio outbound SMS | **VERIFIED** | Workspace-admin gate before provider action; optional lead ID is workspace-validated. |
| Twilio session lookup | **VERIFIED** | Session query explicitly scoped by workspace. |
| Appointment booking RPC | **VERIFIED** | Workspace-local creator/lead checks; empty search path; worker-only execution. |
| `leads.workspace_id` | **VERIFIED** | Production column is NOT NULL; 0/2 leads missing workspace ID. |
| Cross-workspace negative cases | **VERIFIED** | Creator/lead mismatch attempts rejected; no test rows remained. |
| Production relationship integrity | **VERIFIED** | Zero observed mismatches across receptionist events, appointments, leads, invoices, payment links, and payment/lead relationships. |

### CI

The latest hardening validation before the newest main-sync/documentation checkpoint was CI run **#567**, which completed successfully for:

- web
- mobile
- preview-build
- migration-safety

A new CI result is the final validation of the fully synchronized branch after the current main update.

## Production database — VERIFIED

Migration `receptionist_workspace_integrity` was applied to production on **2026-10-02**.

Live checks found:

- 2 workspaces.
- 2 workspace-member records.
- 2 leads, all assigned to workspace 1.
- Workspace 2 sees 0 leads under authenticated simulation.
- Each owner is admin only in their own workspace.
- No receptionist sessions visible in the simulated workspaces.
- Booking RPC: anonymous/authenticated execution denied; service-role execution allowed.
- Cross-workspace booking attempts denied.
- No test data leaked into production.

## Broader product state

### Real / substantially implemented

- Supabase authentication and workspace model.
- Leads and workspace-scoped persistence.
- Inspections, photo workflows, and Golden Report authority gates.
- Estimate-draft authority protections and technician approval source linkage.
- Owner pricing configuration and retailer reference-price infrastructure.
- Bounded automation/cron architecture.
- AI receptionist routes and provider adapters.
- Mobile field-app shell and offline architecture.
- Security headers, release checks, type checks, dependency auditing, and targeted regression suites.
- Explicit prototype disclosures for known non-production surfaces.

### Partial / still requires runtime evidence

- Real two-user/two-workspace browser RLS and Storage isolation across the full UI.
- Full authenticated browser CRUD and magic-link end-to-end verification.
- Invitation email delivery and acceptance lifecycle.
- Real scheduled cron execution/provider success-retry-failure evidence.
- Live Stripe/Twilio provider success/failure testing.
- Multi-workspace UI switching with two actual users.
- Mobile device behavior, offline retry, camera upload, and signed APK verification.
- Direct inspection of Vercel project/environment configuration.
- Jurisdiction-authoritative building-code sourcing.
- Licensed insurance/claims pricing integration.

## Production and commercial boundaries

Retailer prices remain reference pricing, not licensed Xactimate/Verisk/carrier rates.

AI image analysis and aerial/OSM geometry remain non-authoritative until the documented human review, calibration, and approval gates are satisfied.

Prototype screens remain experimental and are disclosed as such; they are not represented as completed commercial capabilities.

## Known security review items outside this hardening scope

Supabase's existing security advisor still reports:

- six authenticated SECURITY DEFINER warnings on shared auth/workspace RPCs;
- leaked-password protection disabled.

Supabase performance advice also reports unindexed foreign keys. These are separate review items, not evidence of the receptionist tenant-isolation defect addressed here.

## Bottom line

**Receptionist hardening:** VERIFIED COMPLETE.  
**Production database hardening:** VERIFIED COMPLETE for this scope.  
**Current synchronized branch:** ready for final CI confirmation and owner-directed PR review.  
**Whole-product commercial verification:** NOT COMPLETE; several end-to-end and external-provider gates remain.

## Resume point

1. Confirm the synchronized-branch CI is green.
2. Review PR #72.
3. Merge only on explicit owner instruction.
4. Continue the remaining runtime/commercial verification items above without treating prototype or reference-price surfaces as production-authoritative.
