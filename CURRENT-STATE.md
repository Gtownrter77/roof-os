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

# ROOF/OS Current State

Historical detail retained below. For decisions, use CURRENT-TRUTH.md.
