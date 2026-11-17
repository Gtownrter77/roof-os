# ContractorOS Efficient Completion Research

**Date:** 2026-11-16
**Repository baseline:** `Gtownrter77/roof-os` `main`, commit `da83961`
**Decision status:** implementation recommendation for owner approval through the existing authority model

## Finding

The most efficient completion path is a **contract-first, vertical-slice merger** rather than a broad rewrite or an attempt to finish every department independently. ROOF/OS already contains the highest-value domain surfaces: inspections, measurements, estimates, approvals, production jobs, invoices, warranty, agent actions, migrations, and a mobile field application. ContractorOS should add the missing shared control plane around those surfaces and then prove the end-to-end path with real correction and recovery cases.

The fastest safe sequence is:

1. Preserve the current GitHub `main` baseline and create traceability from the dossier to existing records, actions, routes, migrations, and tests.
2. Introduce shared contracts for evidence, revisions, authority, mandates, actions, events, reconciliation, AI tasks, and integration adapters. Reuse existing tables and APIs where their semantics already match; add migrations only for actual gaps.
3. Finish the first web-and-mobile vertical slice: customer/property through reviewed evidence, editable sketch, deterministic quantity run, estimate, proposal revision, authorized release, and preserved sources.
4. Add the accepted-proposal-to-closeout slice, including procurement preparation, readiness, field evidence, billing preparation, reconciliation, and service obligations.
5. Put long-running, retry-heavy, and externally waiting processes behind durable workflow workers. Keep deterministic calculations and authority checks in ordinary TypeScript/domain code so they remain fast, testable, and independent of a model runtime.
6. Use Ollama as the default local model adapter. Keep provider selection behind a model-routing contract so the owner can choose another provider without changing business workflows.
7. Add integrations through contract-tested adapters, starting with read-only/reference mode and then exact approved writes. Do not block the core slices on every provider integration.
8. Release in small, reversible increments with static, runtime, and data/security evidence after each slice.

## Why this architecture is efficient

Temporal’s official documentation describes a workflow execution as a durable, replayable history of commands and events. It is designed to resume after crashes and to isolate external effects such as API calls, database queries, file I/O, and LLM calls in activities whose results are recorded for replay [1]. That makes Temporal appropriate for W05–W12-style work that waits on people, vendors, deliveries, payments, or recovery, but it would be inefficient to force every synchronous CRUD request or deterministic estimator calculation through a workflow worker.

LangGraph’s official persistence documentation describes checkpointers as thread-scoped graph-state persistence and stores as longer-lived application data. It supports interruption, human review, and resumption, but its own documentation distinguishes in-memory development persistence from production Postgres persistence [2]. The efficient boundary is therefore: use LangGraph, if needed, inside a bounded AI investigation/planning worker; use ContractorOS records and the durable workflow layer as the authority for business obligations, approvals, effects, and recovery.

Ollama provides both a local server API at `http://localhost:11434` and compatible cloud endpoints. Local requests do not need an API key, while cloud requests do [3]. This supports the owner’s requirement that local inference be the default while retaining an explicit, replaceable provider choice. The adapter must record model identity, configuration, prompt/policy version, privacy route, cost, and verification result for every model-assisted output.

## Recommended implementation boundary

The web app and mobile app remain two interfaces to the same governed records and action gateway. Supabase remains the immediate system of record for identities, workspace/company scope, business records, evidence metadata, revisions, audit, and RLS. A separate TypeScript worker package should own durable orchestration and adapter calls. This avoids a premature ERPNext migration and preserves portability.

Accounting should begin as a governed operational ledger bridge. ContractorOS can prepare estimates, deposits, invoices, receipts, costs, compensation inputs, and reconciliation candidates without pretending that an accounting provider is already authoritative. ERPNext or another accounting system can later be selected through the same adapter contract. This is faster and safer than making an unconfigured ERP the foundation of Release 1.

## Acceptance gates

The dossier says acceptance thresholds must be defined from owner needs and baseline measurements before final evaluation. Therefore the first implementation step will instrument the following baseline measures, and the owner will approve the final numeric thresholds before Release 1 is declared accepted.

### Non-negotiable invariants

- No unauthorized action reaches an external service or a consequential production mutation.
- No duplicate idempotent request creates a duplicate commitment, charge, order, message, reservation, or state transition.
- No stale approval can authorize a changed revision.
- Every released estimate/proposal/quantity result can be reproduced from exact inputs, rule versions, source references, and configuration.
- Unknown, conflicting, or unreviewed evidence cannot silently become a final quantity, price, coverage conclusion, or financial effect.
- Every external outcome is represented as completed, failed, or outcome-unknown and is reconciled before consequential retry.
- Customer, branch, role, and temporary-access boundaries are enforced in web, mobile, worker, export, and adapter paths.
- Human stop-work, revocation, takeover, and manual continuity work without a model or external integration.
- Backup/restore recovers useful records, workflow state, configuration, audit, and pending obligations, with external effects explicitly reconciled.

### Measured release evidence

For each representative workflow, record completion, correctness, evidence completeness, intervention, avoidable escalation, unauthorized attempts, duplicate-action rate, recovery result, latency, compute cost, maintenance burden, support burden, and total human effort. The owner then sets thresholds by workflow consequence rather than using one global score.

The first release should be considered ready only after the test suite demonstrates the normal path plus correction, conflicting evidence, stale approval, duplicate request, timeout with unknown outcome, offline capture, lost-device recovery, reopened work, and owner intervention. A green build alone is not acceptance evidence.

## Integration strategy

“All integrations” means all required integration categories have an explicit adapter boundary, not that every provider is activated simultaneously. Each adapter must expose:

- capability and supported operations;
- exact target and revision requirements;
- authorization and approval requirements;
- idempotency key behavior;
- request/response provenance;
- timeout and unknown-outcome handling;
- reconciliation and compensation behavior;
- secret ownership and rotation;
- contract fixtures and failure tests;
- manual fallback.

Implement reference/read-only adapters first, then exact approved writes one provider at a time. This keeps the core business slices shippable while still preserving the dossier’s full integration scope.

## Final recommendation

Proceed with a clean merger on the current GitHub `main` branch, not the stale local handoff. Build the shared ContractorOS contracts and the first vertical slice first. Add Temporal for durable external-wait/recovery work, keep LangGraph bounded to AI graph state where it adds value, default to local Ollama behind a provider-neutral adapter, and defer ERP authority until the owner selects it. This gives the shortest path to a real, testable, recoverable system without creating a second codebase or granting AI unrestricted production access.

## References

[1]: https://docs.temporal.io/workflows "Temporal Workflow documentation"
[2]: https://docs.langchain.com/oss/python/langgraph/persistence "LangGraph persistence documentation"
[3]: https://docs.ollama.com/api/introduction "Ollama API introduction"
