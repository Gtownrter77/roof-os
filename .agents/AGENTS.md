# Agent Reliability Framework — Roof OS

Extends `AUTOMATION-AGENTS.md` (not replacing). Adds persistent reliability practices for all four agent roles (Intake, Scheduler, Inspection Quality, Copilot).

## What changed
- Reliability skill: `.agents/skills/reliability/SKILL.md` (challenge fixes, source vs DB distinction, unresolved risks, evidence-gating with file:line).
- God Mode spec: `.agents/skills/god-mode/SKILL.md` (owner-only, SANDBOX env, audit record, never disables RLS/REA/production data). Disabled by design.
- Verification: `.agents/skills/verification/SKILL.md` + `scripts/reliability-check.mjs` (deterministic source check, <2 sec, no heavy install, no DB connection needed).
- Integration plan: `docs/superpowers/plans/2026-10-27-estimate-approval-integration-plan.md` (isolated PostgreSQL/Supabase, disposable DB, no production connection).

## Compatibility
- OpenCode: native skills directory `.agents/skills/`; AGENTS.md reference; REA server preserved (`tools.rea.*` unchanged); `.opencode/` settings preserved.
- Codex: framework referenced in `.cursorrules`; uses the same file paths; no proprietary API required.
- Chromebook / 2.7 GB Linux RAM: all reliability scripts are source-only (no npm install, no DB connection, no network); writes to the SD3 workspace only.
- REA: read-only; framework does not modify analysis targets, skill installation, or session scripts.

## Database verification path
- GitHub-hosted disposable PostgreSQL (`.github/workflows/ci.yml`, `migration-safety` job) is the supported SQL/RLS verification path. Migrations are applied to a synthetic PostgreSQL 16 service, never to production.
- Supabase Auth/Storage integration tests are a separate layer and are **not** covered by the disposable PostgreSQL baseline.
- Report `source-tested` vs `database-tested` evidence separately; Supabase Auth/Storage, physical-device and production checks are separate layers too.

## Mandatory practices (all agents)
1. Before finishing any task: run `node scripts/reliability-check.mjs`; confirm source vs DB distinction.
2. Every fix requires root-cause evidence (Phase 1 of systematic-debugging); no symptom-only fixes.
3. Unresolved risks must be listed; never hide a gap behind passing source tests.
4. RLS / authorization changes use new migrations only (`059_...` pattern). Direct table writes verified via RLS + trigger + RPC.
5. Experimental / sandbox work uses a `feat/` branch + God Mode guard; never on `main`; never bypass required CI checks. Push/merge requires the owner's explicit directive.

See also: `AUTOMATION-AGENTS.md` (agent roles 1-4, bounded rules, no auto-approval of estimates/payloads); `docs/superpowers/plans/2026-10-27-estimate-approval-auth.md`; `scripts/estimate-approval-authority-test.mjs`.
