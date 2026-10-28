# CapOut public-behavior study (clean-room)

Issue: #336. Day 15 deliverable. Scope: CapOut's **publicly documented product behavior**, compared with Roof OS Agent 5. Companion files: [REA execution ledger](./rea-execution-ledger.md) and [`rea-ledger.json`](./rea-ledger.json).

## Boundaries first

This study used only material a logged-out visitor can read:

- the public documentation site and its public `/llms.txt` index,
- the public marketing site,
- publicly served documentation JavaScript, analysed statically with the installed REA skill.

No CapOut account, API key, trial, dashboard, carrier PDF, pricing catalog, private endpoint, or authenticated request was used. No CapOut source code, UI copy, branding, or internal data format was copied. Every Roof OS behavior below is an independent implementation written against publicly documented semantics.

The static bundle is the **documentation site's** bundle. It describes how the docs are rendered, not how the CapOut product extracts or exports estimates. Treat any statement about CapOut internals as unknown.

## Public behavior, as documented

Sources were read on 2026-10-28. "Documented" means the vendor says it; only the marketing accuracy number is labelled a claim.

Full source URLs:

- https://docs.capout.ai/llms.txt
- https://docs.capout.ai/quickstart.md
- https://docs.capout.ai/guides/upload-a-document.md
- https://docs.capout.ai/guides/structured-estimate-imports.md
- https://docs.capout.ai/guides/download-esx.md
- https://docs.capout.ai/guides/realtime-updates.md
- https://docs.capout.ai/guides/claims-and-usage.md
- https://docs.capout.ai/mcp/overview.md
- https://docs.capout.ai/api-reference/overview.md
- https://docs.capout.ai/api-reference/status/get-document-status.md
- https://www.capout.ai/ (marketing claims only)

| Area | Documented behavior | Source |
| --- | --- | --- |
| Entry points | `POST /upload` (PDF by fetchable `url` or inline `file_base64` up to 50 MiB), `POST /upload/json` (`StructuredEstimateV1`), `POST /upload/csv` (multipart) | `quickstart.md`, `guides/upload-a-document.md`, `guides/structured-estimate-imports.md` |
| Auth | `capout-api-key` header per request; realtime uses a short-lived token from `POST /ws/token`; the key never goes in a URL | `quickstart.md`, `guides/download-esx.md`, `guides/realtime-updates.md` |
| Tracking | One `document_id` per accepted upload; `GET /status/{document_id}`; `GET /documents`; WebSocket or SSE status streams | `api-reference/overview.md`, `guides/realtime-updates.md` |
| Completion | `status: "exported"`, `terminal: true`, `workflow_complete: true`; `export.completed` is the download-ready signal | `quickstart.md`, `guides/realtime-updates.md` |
| Downloads | Stable `/{document_id}.esx` link, default Contractor (`8D`), `?profile=carrier` for Carrier (`5L`); returns `409` before export completion; each authorized call gets a fresh signed redirect | `guides/download-esx.md`, `quickstart.md` |
| Structured fields | Typed rows with `cat`/`sel` or `description`, quantity, unit, activity, price, tax, O&P, RCV/ACV, depreciation, PWI, enabled, room, section, F9 note; common column aliases | `guides/structured-estimate-imports.md` |
| Pricing policy | Supplied prices are preserved as custom prices. An omitted price is exported as an explicit custom `$0.00` item. CapOut "never fetches external market prices or modifies customer prices." | `guides/structured-estimate-imports.md` |
| Catalog | Exact Category/Selector pairs are accepted; description-only rows resolve against the vendor's Xactimate taxonomy | `guides/structured-estimate-imports.md` |
| Alternates | `enabled: false` (or `active: 0`) rows stay in review and are excluded from export calculations and totals | `guides/structured-estimate-imports.md` |
| PWI | Enabled PWI rows export as active priced items; disabled PWI rows can stay in the file with a paid-if-incurred flag and contribute nothing payable | `guides/structured-estimate-imports.md` |
| O&P | Row eligibility plus estimate-level overhead/profit rates; both rates or neither; cent-level agreement between supplied and computed amounts; `422` on mismatch | `guides/structured-estimate-imports.md` |
| Idempotency | `Idempotency-Key` on structured imports; same key and payload returns the existing `document_id`; same key with a different payload returns `409` | `guides/structured-estimate-imports.md` |
| Metering | One claim per successful live workflow; both ESX profiles included; re-downloads do not consume claims; expiring buckets exposed by `GET /claims` | `guides/claims-and-usage.md`, `guides/download-esx.md` |
| MCP | Hosted Streamable HTTP endpoint with tools for processing, staged upload links, status, waiting, claims, and saved XactNet addresses | `mcp/overview.md` |
| Accuracy | Marketing page claims "99.99% accuracy across all 3,000+ real-world scopes validated, including line items, pricing, folders, F9 notes, and PWI items" | homepage, marketing claim |

### Claim versus observation

- **Vendor claim, unverified here:** the 99.99% / 3,000+ scope accuracy statement, and any implication of carrier-wide coverage.
- **Documented contract, not exercised:** request shapes, status fields, error codes, claim metering, profile codes, idempotency semantics. These were read, not called.
- **Not observed at all:** extraction quality, catalog resolution accuracy, ESX byte layout, carrier-specific behaviour, pricing internals, authentication internals, MCP staging internals.
- **Statically observed:** the docs site is a Mintlify build; three JavaScript assets load from `/_mintlify/assets/`; the runtime/bootstrap file is 1,358 bytes. See the REA ledger for hashes and the analyzer's own limitations.

## Capability parity matrix

Parity means "the documented workflow step has a local Roof OS counterpart", not "the output is interchangeable". Roof OS does not produce ESX files.

| Capability | CapOut (documented) | Roof OS Agent 5 | Status |
| --- | --- | --- | --- |
| PDF ingest | Yes, OCR/parse into structured rows | Consumes already-extracted Docling page/block text | Partial; normalizer is Day 16 |
| Structured import | JSON `StructuredEstimateV1` and CSV | JSON-style carrier/contractor rows via the review API | Partial subset, no CSV file endpoint |
| Typed line fields | Broad: cat/sel, activity, tax, O&P, RCV/ACV, depreciation, PWI, enabled, room, F9 | Narrow: code, description, category, quantity, unit, unit cost, line total, enabled, PWI | Partial by design |
| Catalog resolution | Xactimate taxonomy | Lexical token match only; no catalog | Not attempted |
| Missing price | Explicit custom `$0.00` | Stays `null` with `unknown` provenance and an issue | Deliberate difference |
| Alternate rows | Excluded from export totals | Retained in packet, excluded from totals and deltas, counted in `excluded.alternate_rows` | Implemented |
| PWI | Flag carried into export | Flag retained; never priced or totalled | Implemented, no export |
| O&P | Calculated when rates supplied | Not calculated | Out of scope |
| Review workflow | Vendor dashboard | Workspace-scoped draft, revision history, admin approval | Implemented |
| Realtime status | WebSocket/SSE | Not applicable; synchronous local request | Difference by design |
| Idempotency | `Idempotency-Key`, 409 on payload change | Not implemented; Day 19 | Gap, tracked |
| Export | Contractor `8D` and Carrier `5L` ESX | Export blocked on every packet | Deliberate difference |
| Billing/metering | Claims per live workflow | No per-document billing | Not applicable |
| Local operation | Hosted API/MCP | Runs with no external key or network call | Deliberate difference |

## Differentiators A–F

Each item is implemented in source and covered by `scripts/agent5-supplement-specialist-test.mjs`.

| ID | Improvement | Status | Evidence |
| --- | --- | --- | --- |
| A | Every extracted line keeps document, page, block, and exact source text | Implemented | `ExtractedLine.source`, parser test |
| B | Missing price stays unknown; it is never rewritten to `$0.00` or guessed | Implemented | Parser issues plus `unknown` provenance; test asserts no invented price |
| C | Append-only revisions, server-assigned numbers, admin-only approval, immutable approved packets | Implemented | Migration `060` RLS and triggers; PostgreSQL suite in `migration-safety` |
| D | Human review is mandatory and export is blocked on every packet | Implemented | `status: ready_for_review`, `export_blocked: true`; API contract test |
| E | Local-first: no CapOut key, no network call, no model dependency in the deterministic path | Implemented | Route source assertion; no `fetch`/`axios` in `lib/agent5` or the route |
| F | Uncertainty is explicit: counters for unknown provenance, missing quantity, missing price, open questions, excluded alternates, and a question when no measurements exist | Implemented | `ReviewPacket.uncertainty` and `ReviewPacket.excluded`; test assertions |

## What Roof OS does not claim

- No ESX generation and no ESX parity.
- No Xactimate catalog resolution or carrier coverage.
- No independent verification of CapOut's accuracy claim.
- No automatic insurer submission, claim approval, payment, or customer contact.
- No CapOut API-key requirement, and no outbound call to CapOut from Agent 5.

## Unknowns to close later

1. Real CapOut status/error taxonomy beyond the documented `409`, `422`, and `exported`.
2. Whether the marketed accuracy figure has a published methodology.
3. Actual ESX file structure; Day 19 needs fixtures, not vendor files.
4. Carrier-specific PDF layouts and how often extracted rows are ambiguous.
5. O&P rounding parity with a real Xactimate price list.
6. MCP staged-upload internals.
7. Whether a real CapOut payload accepts the subset Roof OS emits; this study never authenticated.

## Next actions tied to later days

- Day 16: local-first PDF normalizer (Docling synthetic runtime, typed rows, page provenance).
- Day 17: evidence-backed quantity and trade deltas with false-positive tests.
- Day 19: JSON/CSV fixtures, revisions, retries, idempotency. Optional CapOut adapter stays off by default and adds no ESX parity claim.
