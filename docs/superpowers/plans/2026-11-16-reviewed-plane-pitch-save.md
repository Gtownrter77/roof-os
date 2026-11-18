# R2 Reviewed Per-Plane Pitch & Durable Draft Save — BAILEY BOSS

**Date:** 2026-11-16  **PR:** #461  **Authority:** Original ContractorOS Unified Master Dossier, roof geometry and estimate section; `ROOFOS-BUILD-CHECKLIST.md`. This is one mandatory slice, not replacement of the nine releases or twenty AI domains.

## Exact steps and source

1. Regression gate first: add `scripts/roof-measurement-precision-test.mjs` checks for a numeric `reviewed_pitch_rise_per_12` distinct from `suggested_pitch`, browser review controls, cached flags, server-side recalculation and new source migration. RED observed `43973583322` prior to production change.
2. Persistence: new additive `supabase/migrations/104_reviewed_plane_pitch.sql` adds numeric human-review pitch and exact attestation fields, preserving historical model suggestions, RLS and source identity. No production application during this work.
3. Review route: `app/api/measurements/aerial/route.ts` saves reviewed pitch from authorized user, rejects out-of-range/invalid inputs, disallows confirmed edits, revalidates all accepted planes and calibration before confirm, records explicit top-down and pitch review decisions, restores cached reviews.
4. UI: `app/measure/page.tsx` allows per-plane numeric pitch entry and save, keeps mixed-pitch calculations separate from uniform, restores flags/scale from persisted state, marks computed area as **unverified draft**.
5. Durable quantity path: `app/api/measurements/manual/route.ts` uses persisted confirmed roof planes, authoritative scale and confirmed pitch, recomputes area on server, fails closed on discrepancies, does not treat AI edge guesses as reviewed lengths.
6. Regression contracts: update old permissive assertions to fail-closed expectations in `scripts/ai-vision-endpoint-test.mjs` and `scripts/measurement-estimate-authority-test.mjs`; run full PR CI.
7. External gate: read-only Supabase check confirms live project lacks new columns. Thus **source GREEN ≠ operational**. Protected migration, documented backup, staging query/acceptance, owner approval and then production deploy remain before merging/deploying this dependent code.

## Evidence

- RED: source `943c7f338f21fc6cbf14e6ecbb3a0605f2ce305e`, CI `43973583322`, web failed at missing migration as intended.
- GREEN code: `07bb0b76ff45b407ef9fd29747c676bdab03986d`, CI `43974736857` all five jobs passed, no live application exercised.
- Follow-up: numeric source migration renumbered to `102` because repo source `101_ai_formulated_measurements.sql` exists and `102` was absent. The Supabase skill's CLI-generated filename step was not executable from this GitHub-only code workspace; the reviewed repository's numeric-prefix convention was used instead. No CLI or migration command claimed.
- Live schema read-only: `public.roof_planes` lacks `reviewed_pitch_rise_per_12`; `public.aerial_measurements` lacks `orthographic_top_down_confirmed`, `uniform_pitch_confirmed`, `confirmed_uniform_pitch_rise_per_12`. No SQL applied.

## All fifteen upstream Superpowers skill checkpoints (this work only)

| Skill | Outcome and exact limitation |
| --- | --- |
| using-superpowers | PERFORMED: read all 15 upstream skill documents this work package. |
| brainstorming | REVIEWED: dossier already approves roof-plane measurement; selected separate reviewed pitch vs AI text with hard save gate, no reopened scope. |
| writing-plans | PERFORMED: file-specific task and acceptance ledger here. |
| using-git-worktrees | BLOCKED: SD3 and the owner's Chromebook cannot be accessed here; isolated GitHub branch only; no clone claim. |
| test-driven-development | PERFORMED: test-only red commit and failing CI, followed by code and green CI. |
| systematic-debugging | PERFORMED: traced stale AI quantity save and cached auto-confirm flag to specific source; red/green evidence recorded. |
| executing-plans | PERFORMED inline on isolated remote feature branch, commits and CI. |
| subagent-driven-development | BLOCKED: no actual isolated implementer/reviewer agents dispatched. |
| dispatching-parallel-agents | REVIEWED, NOT TRIGGERED: changes share tightly coupled data/route/UI contract; parallel tool lookups are not subagents. |
| requesting-code-review | PR #461 ready for external evidence-based review; no independent reviewer execution claimed. |
| receiving-code-review | NOT TRIGGERED unless GitHub reviewers respond; recheck before integration. |
| verification-before-completion | PERFORMED for source CI/read-only live DB snapshot; NO production functionality claim. |
| finishing-a-development-branch | BLOCKED for merge by un-applied live database schema; green CI alone insufficient. |
| writing-skills | REVIEWED, NOT TRIGGERED: no upstream reusable SKILL.md edited. |
| diagnosing-superpowers | REVIEWED: prior 15th skill omission remains addressed, no full disk transcript forensic analysis claimed. |

## Supabase-specific controls

Read Supabase plugin skill and 2026-11 changelog; current CLI v3 changes local/hosted target behavior. Use documented protected migration workflow with exact target, staging verification, backup, and no unapproved costs. Existing RLS preserved; no service-role key exposed. Zero hosted changes applied during this task.
