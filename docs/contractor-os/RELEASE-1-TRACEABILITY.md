# ContractorOS Release 1 Traceability

**Baseline:** ROOF/OS `main` at `f12c058`
**Release:** 1 — Specification and controlled foundation
**Status:** Foundation, Stage 2, and Stage 3 authority enforcement are merged into `main`; live Supabase approval/denial integration remains explicitly pending.

## Stage 3 — action-time authority and role management

- [x] Added migration 104 with effective role/profile resolution and safe owner/admin/member defaults.
- [x] Added an atomic approval-event trigger that rejects approvals exceeding the approver's configured authority.
- [x] Recorded authority evaluation state and resolved profile role on approved batches/actions.
- [x] Added authenticated owner/admin authority-profile API read/write routes.
- [x] Added the ContractorOS authority-profile panel to workspace settings.
- [x] Added Stage 3 contract coverage; TypeScript, production build, release, and security-definer checks pass locally.
- [x] Run real PostgreSQL migration-safety tests and merge the Stage 3 branch; PR #473 passed all eight fresh checks and merged into `main` at `f12c058`.
- [ ] Apply migration 104 to the target Supabase project and run authenticated approval/denial integration tests.

## Stage 2 — narrow writers

- [x] Added migration 103 with security-definer mandate, evidence, and revision writers.
- [x] Mandate creation and transitions are administrator-only, workspace-scoped, validated, and terminal-state protected.
- [x] Evidence capture is member-scoped; evidence review is administrator-only and immutable after decision.
- [x] Revision creation is member-scoped with server-assigned monotonic numbers and correction-parent checks.
- [x] Revision review/release is administrator-only and release-gated; released revisions are immutable.
- [x] Added authenticated API routes using bounded JSON input and narrow RPCs only.
- [x] Added Stage 2 contract coverage and passed TypeScript, build, release, security-definer, and regression checks locally.
- [ ] Apply migration 103 to the target Supabase project and run authenticated writer integration tests with synthetic non-production users.

## Crew handoff checklist

- [x] Confirmed the authoritative source is the current GitHub `main`, not the stale local handoff.
- [x] Preserved the existing web, mobile, lead-entry, magic-link, inspection, estimate, production, invoice, and warranty surfaces.
- [x] Read the ContractorOS dossier three times and recorded the clean-merger direction.
- [x] Recorded owner decisions: web plus mobile, enterprise-wide scope, configurable role authority, all integration categories behind adapters, local Ollama default, and provider selection.
- [x] Chose the efficient contract-first vertical-slice implementation path.
- [x] Added migration 102 for authority profiles, mandates, revisions, evidence lineage, events, durable execution state, and action-gateway extensions.
- [x] Added migration contract coverage for Release 1 security and state invariants.
- [x] Added dossier-to-repository traceability and explicit unresolved-rule handling.
- [x] Ran the source-only two-workspace isolation contract test: PASS.
- [x] Reran the live two-workspace test with its non-production safety guard; it stopped safely because this sandbox has no `SUPABASE_URL` or synthetic test credentials. No live RLS result is claimed.
- [x] Add narrow server/RPC writers for mandates, reviewed evidence, and revisions.
- [x] Add action-time authority evaluation and role-management UI.
- [ ] Add event intake/reconciliation worker and durable workflow adapter.
- [ ] Add Ollama/provider-neutral model routing with provenance records.
- [ ] Complete and verify the web/mobile first vertical slice.
- [ ] Run production Supabase migration 102 and complete cross-workspace Level 3 verification.
- [x] Commit `4386c0d`, push, merge PR #463 into `main` as `68fc020`, and verify all seven fresh GitHub checks: web, mobile, field security, migration safety, preview build, Vercel deployment, and preview comments.

## Dossier-to-repository coverage

| Dossier requirement | Current or added implementation | Evidence / remaining work |
|---|---|---|
| Shared authoritative records and revisions | Existing domain tables plus `contractor_record_revisions` in migrations 102–103 | Add record-specific revision writers in the first vertical slice |
| Original evidence versus derived/reviewed conclusions | Existing inspection/photo records plus `contractor_evidence_items` and Stage 2 capture/review RPCs | Add review UI/API bindings and source references to estimate packets |
| Owner-controlled authority progression | Existing workspace/system-owner controls plus `contractor_authority_profiles`, Stage 3 profile API/UI, and approval trigger | Apply migration 104 and run authenticated approval/denial integration tests |
| Mandates with scope, limits, expiry, cancellation, escalation | `contractor_mandates` plus Stage 2 create/transition RPCs and API routes | Add owner workspace UI |
| Controlled action gateway | Existing `agent_action_batches`, `agent_actions`, approval RPC; migrations 102–104 add mandate, target scope, expected revision, verification, recovery, and approval-authority enforcement | Add generalized action types and executor adapters per integration |
| Event identity, duplicate handling, delayed/out-of-order processing | `contractor_events` with unique event key and processing/reconciliation state | Add event intake endpoint and reconciliation worker |
| Durable AI/workflow execution state | `contractor_work_executions` | Add worker adapter; Temporal is the durable runtime for long-running external waits |
| Local-first selectable AI runtime | Existing AI surfaces; provider-neutral routing is specified in the merger plan | Add Ollama adapter and model/policy provenance records |
| Security, privacy, least privilege, human intervention | Workspace RLS, system-owner lock, action approval, new Release 1 RLS policies | Add adversarial cross-scope and revocation integration tests |
| Backup, restore, manual continuity | Existing operational documentation and CI restore checks | Extend restore fixtures to new control-plane tables |

## First vertical slice

The Release 1 foundation enables the shared contract for:

```text
customer/property
→ inspection
→ original evidence
→ reviewed measurements
→ editable sketch
→ owner-rule quantity run
→ estimate
→ proposal draft
→ authorized release
→ preserved versions and sources
```

The first slice is not accepted merely because the normal route renders. It must prove a correction, stale approval denial, duplicate request behavior, unresolved evidence blocking, owner takeover, and restoration of useful workflow state.

## Explicit boundaries

- This migration does not grant any AI worker direct unrestricted database or external-service access.
- Member read policies are separate from manager write policies.
- Generic revisions, evidence, events, and execution state are read-only to ordinary clients until narrow server/RPC writers are added.
- Existing lead entry, magic-link authentication, and mobile local/offline storage remain untouched by this foundation migration.
- The schema is additive and does not replace existing inspection, estimate, production, invoice, or warranty tables.

## 2026-11-17 current-main reconciliation

- Current verified main: `1b8393a09bec55a87766eee3aa3d0903ed5e4b61`, following merged PR #462. The foundation from PR #463 is preserved.
- PR #462 adds a provisional, human-reviewed per-plane pitch convention to the existing `roof_planes.suggested_pitch` field and supports a mixed-pitch draft. It does not complete an independent source-of-truth measurement approval, live Supabase verification, comprehensive evidence lineage, or release authority.
- The explicit-confirmation and server-side quantity recomputation change is proposed in branch `docs/mako-checkin-r2-20261117` and is **not verified/merged** as of this checkpoint. This hardening uses the existing AI formulation JSON to store a separately named human attestation; a dedicated revision/evidence record remains to be designed and verified.
- Never deploy draft PR #461 unchanged: its separate reviewed-plane migration is also numbered 102 and its new columns are absent from the hosted target per the PR's read-only evidence. Reconcile and renumber after confirming current schema.
- Remain incomplete: narrow RPC writers, action-time authority enforcement, event/reconciliation worker, durable workflow adapter, Ollama/provider-neutral model routing with provenance, full web/mobile vertical slice and correction/recovery paths, production migration, and Level 3 workspace/RLS tests.
- Dossier commitments, including all 20 AI functions and all nine releases, remain mandatory regardless of single-slice CI results.
