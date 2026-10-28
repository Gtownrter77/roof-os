---
name: verification
description: Deterministic local verification framework for Roof OS agent reliability — source checks only; GitHub-hosted PostgreSQL is the database test path.
version: 1.1.0
author: roof-os-agent
compatible:
  opencode: ">=2.1.4"
  codex: true
tags: [verification, testing, reliability-check, local, lightweight]
---

# Verification Script Spec — Deterministic Local Check

Purpose: confirm the reliability framework is present and that security configuration is intact, without heavy dependencies.

Run: `node scripts/reliability-check.mjs` (`npm run test:reliability`).

Checks (must run in <2 sec, no npm install, no DB connection, no network):
- Reliability, verification, and God Mode skill files exist with required markers.
- God Mode is disabled by design and never disables RLS.
- `.agents/AGENTS.md` extends `AUTOMATION-AGENTS.md` and declares source-tested vs database-tested reporting.
- `.cursorrules` documents Codex compatibility.
- Migration `059` exists as the new-migration precedent.
- The estimate approval regression test exists.
- `ENV=PRODUCTION` is refused and no `.env` secret file is tracked.

## Evidence boundaries

- Source checks run locally and in GitHub Actions `web`.
- Real PostgreSQL/RLS verification runs on the GitHub-hosted disposable database in the `migration-safety` job (`scripts/ci/verify-estimate-authority-postgres.sh`).
- Supabase Auth/Storage integration is **separate and not covered** by either path.
- Report format: PASS/FAIL per check; unresolved risks listed; source-tested vs database-tested declared.
