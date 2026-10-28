# Export, revisions, retries, and idempotence

Issue: #336, Day 19. Source: `lib/agent5/export.ts`, `lib/agent5/idempotency.ts`, `lib/agent5/retry.ts`, `lib/agent5/capout-adapter.ts`, `app/api/supplements/review/route.ts`, `supabase/migrations/066_supplement_review_idempotency.sql`. Test: `scripts/agent5-export-idempotency-test.mjs`.

## Review export, not insurer export

A reviewer can download a packet as JSON or CSV. That file is an internal review copy.

| Property | Value |
| --- | --- |
| `generated_for` | `human_review` |
| `external_submission` | `false` |
| `insurer_submission` | `false` |
| `esx_compatible` | `false` |
| `export_blocked` | `true` |

`export_blocked` still means "no ESX, no insurer submission, no CapOut send". The review download does not change that. No ESX structure is generated and no ESX parity is claimed.

### JSON

Deterministic. The envelope is `roof-os.agent5.review-export.v1` with document id, packet status, totals, uncertainty, excluded alternates/PWI, proposals, lines, and the boundaries block above. Same packet in, same bytes out.

### CSV

Deterministic. One header row, then one `line` row per carrier line, then one `proposal` row per proposal. Fixed columns from `REVIEW_CSV_COLUMNS`. Commas, quotes, CR, and LF are escaped per RFC 4180.

A missing price is an empty cell. It is never written as `$0.00`. A filename is derived from the document id with traversal characters removed.

## Revisions

- The database assigns `revision` per `(workspace_id, document_id)` under an advisory lock (migration `060`).
- A caller may pass `previous_draft_id`. The response then includes a `revision` diff: `added`, `removed`, `changed`.
- The diff compares source text and explicit quantity/price only. It does not assign a cause or a new price.
- Cross-workspace `previous_draft_id` returns no diff, because the lookup is scoped to the current workspace.

## Idempotence

A caller may send `Idempotency-Key` on draft creation.

1. Key format: 16–128 characters from `A-Z a-z 0-9 . _ : -`.
2. The key is scoped to one workspace, not to one document.
3. The request payload is fingerprinted with SHA-256 over canonical JSON: sorted object keys, stable arrays, and only the fields that change the packet.
4. Replay with the same key and the same fingerprint returns the stored draft with `idempotent_replay: true`. No new row is inserted.
5. Replay with the same key and a different fingerprint returns `409` with `code: "idempotency_conflict"`.
6. A new key creates a new revision, as before.
7. Migration `066` enforces the rule in PostgreSQL with a partial unique index on `(workspace_id, idempotency_key)`. The API contract is not the only guard.

Concurrency: two simultaneous requests with the same key race on the unique index. One wins; the other resolves the stored row and replays or conflicts. An unresolved race returns `409 revision_conflict` with `Retry-After: 1`.

## Retries

Only transient database errors are retryable, and the server never loops.

| Error code | Meaning | Response |
| --- | --- | --- |
| `40001` | serialization failure | `503`, `retryable: true`, `Retry-After` |
| `40P01` | deadlock detected | `503`, `retryable: true` |
| `53300` | too many connections | `503`, `retryable: true` |
| `57P03` | cannot connect now | `503`, `retryable: true` |
| `08000`, `08006` | connection exception/failure | `503`, `retryable: true` |
| `23505` | unique violation | replay or `409` conflict |
| other | unknown | `502`, not retryable |

Backoff is deterministic and capped: 1, 2, 4, 8, 8 seconds. The client decides whether to retry. The server does not retry internally.

## Optional CapOut adapter

Disabled by default.

- `AGENT5_CAPOUT_ADAPTER` must be `enabled`, and both `CAPOUT_API_BASE_URL` and `CAPOUT_API_KEY` must be present, before `enabled` becomes true.
- Even when enabled, `submission_allowed`, `esx_compatible`, and `external_submission` stay `false`.
- The module imports no network client and reads no credential value. It can build a candidate mapping for study only.
- Unsupported by design: `esx_generation`, `insurer_submission`, `pricing_lookup`, `claim_approval`, `carrier_writeback`.

The earlier public CapOut study remains the source for provider behavior. It is not an authenticated integration test.

## Evidence boundaries

| Layer | Evidence | Result |
| --- | --- | --- |
| JSON/CSV formatters | `npm run test:agent5-export-idempotency` | PASS — deterministic, quoted CSV, null price stays null, traversal-safe filename, boundaries block |
| Idempotency key and fingerprint | same test | PASS — format limits, order-independent fingerprint, payload sensitivity |
| Retry classification | same test | PASS — retryable set, unique violation excluded, capped backoff |
| CapOut adapter | same test | PASS — disabled by default, still no submission when configured, no ESX claim |
| Route wiring | source contract in the same test | PASS — header read, `23505` branch, `409` conflict, `503` with `Retry-After` |
| PostgreSQL index and key scoping | `migration-safety` runs `scripts/ci/supplement-specialist-assertions.sql` | Assertions added for duplicate-key rejection, short-key rejection, and per-workspace key reuse; the PR check reports the real result |
| Browser download | Not run in this environment | **Not tested** |
| Signed Supabase Storage | Not run | **Not tested** |
| Production | Not deployed, not migrated | **Not touched** |

The local tests prove formatting and rejection rules. They do not prove a real carrier export, a live CapOut workflow, or an insurer acceptance.
