# ContractorOS Release 1 Traceability

**Baseline:** ROOF/OS `main` at `68fc020`
**Release:** 1 — Specification and controlled foundation
**Status:** Foundation tranche merged into `main` at `68fc020`; remaining Release 1 capabilities are explicitly tracked below.

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
- [ ] Add narrow server/RPC writers for mandates, reviewed evidence, revisions, events, and execution state.
- [ ] Add action-time authority evaluation and role-management UI.
- [ ] Add event intake/reconciliation worker and durable workflow adapter.
- [ ] Add Ollama/provider-neutral model routing with provenance records.
- [ ] Complete and verify the web/mobile first vertical slice.
- [ ] Run production Supabase migration 102 and complete cross-workspace Level 3 verification.
- [x] Commit `4386c0d`, push, merge PR #463 into `main` as `68fc020`, and verify all seven fresh GitHub checks: web, mobile, field security, migration safety, preview build, Vercel deployment, and preview comments.

## Dossier-to-repository coverage

| Dossier requirement | Current or added implementation | Evidence / remaining work |
|---|---|---|
| Shared authoritative records and revisions | Existing domain tables plus `contractor_record_revisions` in migration 102 | Add record-specific revision writers in the first vertical slice |
| Original evidence versus derived/reviewed conclusions | Existing inspection/photo records plus `contractor_evidence_items` | Add review UI/API bindings and source references to estimate packets |
| Owner-controlled authority progression | Existing workspace/system-owner controls plus `contractor_authority_profiles` | Add role-management UI and action-time capability evaluation |
| Mandates with scope, limits, expiry, cancellation, escalation | `contractor_mandates` | Add create/pause/revoke API and owner workspace UI |
| Controlled action gateway | Existing `agent_action_batches`, `agent_actions`, approval RPC; migration 102 adds mandate, target scope, expected revision, verification, and recovery fields | Add generalized action types and executor adapters per integration |
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
