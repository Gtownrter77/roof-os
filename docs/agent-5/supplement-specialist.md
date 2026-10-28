# Agent 5 — Supplement Specialist (review-only)

Issue: #336. Status: implemented in source, tested locally, PostgreSQL assertions wired into CI. Not merged at the time of writing.

## What it does

1. **Ingest.** Accepts Docling-style page/block text (`docling.pages[].blocks[].text`) or structured carrier/contractor rows supplied by a trusted API caller.
2. **Extract.** Each line keeps document id, page, block, and the exact source text. Quantity, unit, and price are parsed only when the source states them.
3. **Compare.** Carrier lines are matched to contractor/verified rows by explicit item code or description token overlap. Output is limited to `missing_scope`, `quantity_delta`, `unsupported_line`, `code_mismatch`, and `question`.
4. **Draft.** Every packet is `status: ready_for_review` with `export_blocked: true` and `capout_required: false`.
5. **Persist.** Migration `060` stores drafts per workspace with server-assigned revisions, append-only history (no delete policy), admin-only approval, and approved-record immutability.
6. **Revise.** `previous_draft_id` produces a deterministic added/removed/changed diff.

## What it will not do

- It does not invent quantity, unit price, line total, trade category, building-code finding, damage evidence, insurance coverage, or Xactimate codes.
- A bare number is never treated as a price; a price requires an explicit `$`.
- Missing quantity or price is reported as an `issue` and lowers provenance to `unknown`.
- It never contacts an insurer, submits a claim, records a payment, or exports a packet.
- It requires no CapOut API key and makes no outbound network call.
- Review approval stays with a workspace admin; the engine is not an approver.

## Evidence ledger

| Layer | Evidence | Result |
| --- | --- | --- |
| Source / behavior | `node --experimental-strip-types --no-warnings scripts/agent5-supplement-specialist-test.mjs` | PASS — parser provenance, stated-values-only extraction, comparator deltas and tolerance, missing-scope and code-mismatch proposals, review-only packet, revision diff, API/RLS source contracts |
| API route | `app/api/supplements/review/route.ts` — membership check, 256 KB body cap, 500-row / 50-page caps | Source-verified by the same test |
| Real PostgreSQL (RLS/triggers) | `scripts/ci/verify-supplement-specialist-postgres.sh` in the `migration-safety` job | Wired; result is reported by the PR check, not assumed |
| Supabase Auth / Storage | Not exercised | **Not tested** |
| Docling runtime | Existing synthetic Docling worker test from PR #338 | **Not re-run here**; this engine consumes already-extracted text |
| CapOut public study | Not performed in this session | **Not performed** — no capability claim is made about CapOut internals |
| Production | Not deployed, not migrated | **Not touched** |

## Design limits

- Description matching is lexical (token overlap plus stop-word removal), not semantic. Low-confidence matches are surfaced as `code_mismatch` or `question` rather than silently merged.
- Measurement input is treated as reference text. The engine does not convert measurements into scope or price.
- Docling extraction quality is upstream of this engine; garbled lines become `unknown` provenance, not guessed values.
- Optional local Ollama assistance is intentionally absent from the deterministic path. Correctness never depends on a model.
- The route returns HTTP 502 until migration `060` is applied to the target database.

## Boundaries

- Separate from Agent 4 and God Mode. God Mode stays disabled by design.
- No automatic approval, insurer submission, customer contact, or payment.
- Approved packets are immutable at the database level; only `superseded` transition is allowed.
