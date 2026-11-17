# BAILEY BOSS — 20 Approved AI Functions → 15 Proposed Agent Owners

**Date:** 2026-11-16. **Design authority:** Original 16-page `ContractorOS_Unified_Master_Dossier.pdf`, Part VI §17 (pages 8–9). **Repository baseline:** `40fc0256ad2148365e221fe36d773d77ab866094`. **Existing agent names/keys:** `lib/bailey-agent-onboarding.ts`. **Readiness truth:** `lib/bailey-agent-readiness.ts` marks every BAILEY agent not implemented and dispatch forbidden. This mapping allocates proposed responsibilities **only**. It is **not implementation, authorization, proof of tests, or a change to scope**.

## Exact functional scope, mapped to accountable proposed owners

| Domain | Dossier AI function (exact scope meaning) | Primary proposed agent | Supporting proposed agents | Acceptance evidence required |
| --- | --- | --- | --- | --- |
| AI-01 | Business command center: approved objective → plans/tasks/decisions/costs/exceptions | `orchestrator` | `chief_of_staff`, `finance` | Persisted task/decision cost state and intervention/resume |
| AI-02 | Investigation engine: unknowns, permitted evidence, validation, blockers | `research` | `orchestrator`, `quality_security` | Sourced investigation with unresolved uncertainty and halt |
| AI-03 | Demand-to-appointment: capacity-aware campaign, qualification, follow-up, confirmation | `outbound_sales` | `business_receptionist`, `scheduling` | Consent, actual capacity, real appointment and cancellation proof |
| AI-04 | Inspection/evidence: guide capture, multimodal intake, gap detection, review | `quality_security` | `roofing_estimator`, `production_foreman` | Original/source proof, missing-evidence flags, signed review |
| AI-05 | Geometry/quantity: editable candidates, conflicts, deterministic math | `roofing_estimator` | `quality_security`, `research` | Address-first/manual equivalence, correct overlap/edges, pitch/scale/owner rules |
| AI-06 | Estimate/options: reviewed scope, prices, allowances, exclusions, alternatives | `roofing_estimator` | `finance`, `documents` | Source-linked price book, exact quantity, alternatives, approved revision |
| AI-07 | Customer decisions: option explanations, authority, selections, changes | `customer_care` | `documents`, `roofing_estimator` | Customer identity, signed exact selection and controlled change |
| AI-08 | Agreement/obligations: exact commitments and fulfillment conditions | `documents` | `customer_care`, `quality_security` | Signed version, obligations and exceptions linked to job |
| AI-09 | Insurance administration: organized evidence, supported differences, authorized correspondence, no invented coverage | `roofing_estimator` | `documents`, `research`, `quality_security` | Licensed/customer-authorized sources, comparison, human gate |
| AI-10 | Procurement/inventory: requirements → receipt/return/credit/reconciliation | `purchasing` | `production_foreman`, `finance` | Authorized PO, delivery, discrepancies, return/credit loop |
| AI-11 | Production: schedules, readiness, resource reservation, authorized replanning | `production_foreman` | `scheduling`, `purchasing` | Capacity/resource conflict and real exception recovery |
| AI-12 | Field coordination: current instructions and reviewed consequences of observations | `production_foreman` | `customer_care`, `quality_security` | Offline/online job version, observation review, revised direction |
| AI-13 | Quality/correction: criteria/evidence/review/rework/prevention | `quality_security` | `production_foreman`, `customer_care` | Defect→correction→verification→prevention record |
| AI-14 | Finance: transactions, matching, differences, preliminary/final results | `finance` | `purchasing`, `quality_security` | Invoices, receipts, deposits, reconciliation and explicit restrictions |
| AI-15 | Compensation preparation: reviewed agreements/rules, private protected records | `finance` | `chief_of_staff`, `quality_security` | Approved rates, payroll-ready reviewed computation, permission isolation |
| AI-16 | Closeout/service: lingering obligations and evidence-backed resolution | `customer_care` | `production_foreman`, `documents` | Completion packet, warranty/service revisit and verified closure |
| AI-17 | Recovery: reconcile partial execution, alternatives, restored state | `orchestrator` | `development`, `quality_security`, owning agent | Interrupted transaction, idempotent retry, traceable roll-forward/back |
| AI-18 | Forecast/simulation: feasible plan comparisons with explicit uncertainty | `chief_of_staff` | `finance`, `research`, `production_foreman` | Stated assumptions, capacity constraints, backtests and ranges |
| AI-19 | Capability engineering: evaluated candidates through controlled release | `development` | `quality_security`, `orchestrator` | Isolated build, failing/passing tests, review, stage/rollback, owner gate |
| AI-20 | Assurance: scorecards, tests, audit evidence, authority recommendations | `quality_security` | `development`, `chief_of_staff` | Reproducible audit trail, observed outcomes, owner decision |

**Coverage check:** 20 of 20 dossier functions represented. Primary and assisting owners are an **implementation allocation proposal**, not a change to the dossier or a claim that any BAILEY runtime exists. One proposed agent can own multiple functions; each domain remains a separate mandatory acceptance contract. No domain is optional. The 15 agent names are not interchangeable with the 15 Superpowers process skills.

## Architecture constraints

- Every domain gets: persisted owner/mandate, permitted inputs/evidence, callable tools, permissions/approval, deterministic calculations where required, release criteria, verification and failure/recovery, cost and support. Names/screens/onboarding toggles alone do not count.
- A domain cannot execute merely because a user enabled its preference. The BAILEY runtime must be explicitly implemented, authorized and independently verified end-to-end.
- Four legacy workers (`intake_router`, `scheduler`, `inspection_quality`, `office_copilot`) remain separate until safely adapted. A green legacy heartbeat does not prove BAILEY agent readiness.
- Governed agent action gateway: typed target, exact expected revision, idempotency, risk, approval, side-effect record, failure/recovery. No broad direct DB/service authority. Respect owner controls, secrets, RLS and cost restrictions.
- No open-source provider or imagery guarantees national coverage. Unavailable means unavailable. An OSM footprint is not roof area or roof geometry. Manual correction remains a first-class path.
- Material estimates must use approved gable field waste +10%, hip field waste +15%; ridge+hip cap combined feet /20 rounded up; starter feet /110 rounded up; no extra cap/starter waste; gutters from eaves, downspouts at max 30 ft spacing.
- Verify all nine mandatory dossier releases separately; no pilot/production GO from a green code build alone.

## Required next build order (not a new feature proposal)

1. **R1:** Complete requirement IDs (all 38 dossier sections, 24 work packages, nine releases, 20 AI domains), authoritative model/record relationships, permission/action gates, and genuine backup/restore evidence.
2. **R2:** TDD roof-plane overlap and shared edge handling; calibration/plane pitch correctness; address-first geocoding + truthful imagery fallback; persist one versioned manual+automatic geometry representation; verify estimate owner rules.
3. **R3–R5:** Complete business workflows (agreement, purchasing, inventory, crew/field, invoices, settlement, customer/subcontractor portals, service).
4. **R6:** Implement and prove each BAILEY departmental domain with bounded, delegated, reviewed actions. Keep legacy workers safely isolated during transition.
5. **R7–R9:** Enterprise missions, governed capability engineering, assurance, recovery, safety, operational acceptance and field gates.

## Full 15 Superpowers checkpoints — mapping documentation work

The following statuses describe **this mapping document only** (not prior work or future builds): `using-superpowers` reviewed; `brainstorming` dossier requirements reused, no new product concept; `writing-plans` audited build order here, specific test-first implementation plan remains separate; `using-git-worktrees` blocked (GitHub connector branch only; SD3 unavailable); `test-driven-development` not triggered (documentation only); `systematic-debugging` source gaps previously identified, runtime diagnosis not run; `executing-plans` partial doc plan, no local implementation executor; `subagent-driven-development` blocked (no dispatched subagents); `dispatching-parallel-agents` not performed; `requesting-code-review` GitHub PR gate pending; `receiving-code-review` no review feedback at time of drafting; `verification-before-completion` repo/PDF source checked, no app run; `finishing-a-development-branch` PR/green CI gate before merge; `writing-skills` no reusable skill modified; `diagnosing-superpowers` prior omission corrected, no local transcript evidence. Do not generalize these states into runtime proof.
