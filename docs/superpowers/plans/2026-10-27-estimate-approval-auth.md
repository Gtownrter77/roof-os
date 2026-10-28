# Estimate Approval Authorization Fix Plan

> Using writing-plans skill; subagent-driven recommended (DB + API + test coupling).

**Goal:** Require workspace-admin for production estimate approval; cover POST/PUT/RPC/direct writes; prevent unauthorized approval metadata changes.

**Architecture:** New migration 059 (create-or-replace function + RLS policy). API guard in `estimates/[id]/route.ts`. Source-contract regression script.

**Tech:** Postgres / Supabase RLS + TypeScript / Node source tests.

**Global:** No deploy/merge; keep YOLO separate (none present); branch `feat/estimate-approval-authority`; only targeted tests.

**Tasks:**
1. New migration: `supabase/migrations/059_estimate_approval_admin_guard.sql`
2. Modify `app/api/estimates/[id]/route.ts` (admin gate for approved status)
3. Modify `app/api/estimates/route.ts` (POST defense — preserve draft)
4. Modify `app/api/estimates/draft/route.ts` (preserve, just verify)
5. Regression test `scripts/estimate-approval-authority-test.mjs`
6. Targeted test run + report.

**Review focus:** Non-admin approval blocked at all 4 entry points; admin approval allowed; cross-workspace blocked; draft editing preserved.
