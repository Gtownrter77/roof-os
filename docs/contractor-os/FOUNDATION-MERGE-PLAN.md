# ContractorOS Foundation Merger Plan

**Baseline:** `Gtownrter77/roof-os` `main` (current GitHub baseline)
**Direction:** Clean merger into ROOF/OS; preserve existing production and field-app work.
**Status:** Approved direction; implementation proceeds incrementally with verification at every slice.

## Decisions recorded

- ContractorOS is merged into the existing ROOF/OS repository, not created as a parallel application.
- Web and mobile are both first-class surfaces. The web application remains the administrative/system-of-record control plane; the Expo field application is the field/offline surface.
- The business scope is enterprise-wide and not artificially limited to roofing. Roofing remains the first domain adapter and reference workflow.
- Company, branch, territory, customer, property, and project scope are configurable data boundaries, not a reduction of the product’s intended scope. Security isolation and least privilege remain mandatory even when the owner wants one unified enterprise view.
- All unresolved estimating and operating rules must be made explicit, configured, reviewed, versioned, and testable. The system must not invent missing rules or present provisional calculations as final.
- Roles and authority are configurable. The owner decides which roles may read, prepare, approve, execute within limits, coordinate/recover, or sustain mandates. No role receives authority implicitly from a successful model response.
- All relevant integrations are supported through explicit adapters and action gateways. External writes remain governed by exact target, approval, idempotency, confirmation, and reconciliation checks.
- Local Ollama is the default AI runtime. Model/provider selection is owner-configurable through a provider-neutral routing contract. Sensitive data defaults to local processing; hosted alternatives require explicit configuration and policy.

## Accounting foundation explained

The dossier’s accounting question is about the system that owns financial truth. The choices are:

1. **Existing accounting system as authority:** ContractorOS prepares and reconciles job, invoice, payment, cost, and compensation inputs, then submits approved transactions to the existing accounting package.
2. **ERPNext as authority:** ERPNext becomes the transaction and accounting system, with ContractorOS coordinating contractor-specific workflows around it.
3. **ContractorOS ledger bridge first:** ContractorOS stores auditable operational financial records and prepares exports/imports while the authoritative accounting package is selected later.

The implementation default is option 3 for the foundation, with adapter contracts for options 1 and 2. This avoids fabricating a production accounting commitment while still enabling estimates, deposits, invoices, receipts, job costing, reconciliation, and compensation preparation to be modeled and tested. The owner can later designate ERPNext or another accounting package as authoritative without rewriting ContractorOS workflows.

## Operating boundary explained

“Operating boundary” does not mean limiting ContractorOS to one kind of contractor. It means defining where a particular action is allowed to operate: which company, branch, customer, property, project, financial book, role, device, integration, and time window it may touch. The product remains enterprise-wide; each mandate and action must still state its scope so that a broad owner view cannot accidentally become unrestricted mutation access.

The initial configuration is therefore enterprise-wide visibility for authorized owners, with explicit scope and least-privilege enforcement for every other participant and every external action.

## Release sequence

### Release 1 — Controlled foundation

- Requirements and dossier traceability.
- Unified identity, organization, customer/property/project records.
- Evidence originals, derived candidates, reviewed findings, source lineage, and revisions.
- Configurable roles, authority levels, mandates, approvals, expiry, revocation, and intervention.
- Action gateway with idempotency, stale-revision checks, exact targets, and explicit outcomes.
- Event identity, deduplication, delayed/out-of-order handling, and reconciliation states.
- Durable task/plan state with waits, budgets, stop conditions, recovery, and manual takeover.
- Local-first AI runtime contract with Ollama default and owner-selected provider adapters.
- Audit, export, backup/restore, manual continuity, and privacy controls.

### First executable vertical slice — web and mobile

`customer/property → inspection → original evidence → reviewed measurements → editable sketch → owner-rule quantity run → estimate → proposal draft → authorized release → preserved versions and sources`

The web surface provides review, configuration, approvals, and system-of-record operations. The mobile surface provides guided capture, offline drafts, evidence upload/queue, field review, and constrained actions according to the same authority contract.

### Release 2 onward

The next vertical slice extends accepted proposals through job creation, material requirements, purchasing preparation, readiness, execution evidence, billing preparation, reconciliation, closeout, and service. Later releases add insurance/mixed funding/bids, portals/service, departmental autonomy, enterprise missions, controlled capability development, and hardening.

## Unresolved-rule policy

Every unresolved rule becomes one of:

- **Configured:** owner-approved rule with effective version and tests.
- **Review required:** candidate exists but cannot be released until an authorized reviewer accepts it.
- **Blocked:** required information is absent or contradictory.
- **Provisional:** explicitly labeled non-final output with no consequential side effect.
- **Not applicable:** recorded with rationale.

No model, integration, or UI may silently convert unknowns into production quantities, prices, commitments, coverage conclusions, safety conclusions, or financial effects.

## Verification gate

Every implementation slice must pass:

1. **Static:** typecheck, build, migration/schema checks, contract tests, and mobile checks.
2. **Runtime:** representative web and mobile flows, offline/reconnect behavior, authorization transitions, integration adapter behavior, and manual fallback.
3. **Data/security:** RLS and scope isolation, role/authority enforcement, audit completeness, idempotency, stale approval denial, event reconciliation, backup/restore, secret-leak scans, and adversarial cases.

A slice is not called complete when only the happy path works. The dossier’s exceptional, disputed, reversed, interrupted, offline, reopened, and owner-intervention paths are acceptance evidence.
