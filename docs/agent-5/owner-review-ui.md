# Owner-only supplement review UI

Issue: #336, Day 18. UI: `app/supplement/review/page.tsx`. API: `app/api/supplements/review/route.ts` (list) and `app/api/supplements/review/[id]/route.ts` (detail and decision). Contract test: `scripts/supplement-review-ui-test.mjs`.

## What it does

A workspace member can see Agent 5 review drafts for their own workspace. A workspace owner or admin can record `approved` or `rejected` on a draft that is still `ready_for_review`. Approval records a human decision only.

The page shows:

- draft document id, revision, status, and creation time;
- carrier total, contractor total, delta, and export-blocked state;
- uncertainty counters and excluded alternate/PWI counters;
- every proposal with kind, description, quantity and amount deltas, human-review flag, and both evidence strings;
- carrier lines with item code, description, quantity, unit, price, and provenance.

## Roles

| Caller | List | Read draft | Approve or reject |
| --- | --- | --- | --- |
| Signed-out | `401` | `401` | `401` |
| Workspace member | Own workspace only | Own workspace only | `403` |
| Workspace owner/admin | Own workspace only | Own workspace only | Allowed from `ready_for_review` |
| Other workspace owner | Empty list from own workspace | `404` | `404` |

A foreign draft returns the same `404` as a missing draft. The API does not confirm that another tenant's id exists. The workspace filter is applied to every read and write, and PostgreSQL RLS enforces the same boundary independently.

## Decision rules

1. `PATCH` requires `is_workspace_admin` for the current workspace.
2. Body is `{ "status": "approved" | "rejected" }`. No other value is accepted.
3. The draft must currently be `ready_for_review`. A second decision returns `409`.
4. The update is scoped by `id`, `workspace_id`, and `status = 'ready_for_review'`.
5. `approved_by` and `approved_at` are set only for approval. Rejection clears both.
6. The packet is never rewritten by the review endpoint. Migration `060` keeps approved packets immutable.
7. There is no delete route. History stays append-only.

## No automatic sending or export

- The page fetches only `/api/supplements/review` URLs.
- The API makes no outbound call (`fetch`, `axios`, or HTTP URL) and has no insurer, email, SMS, CapOut, or ESX path.
- Every response states `external_submission: false` and `export_blocked: true`.
- The UI says approval does not contact an insurer, submit a claim, export ESX, or change a carrier file.
- The database check constraint still ties `status = 'approved'` to non-null `approved_by` and `approved_at`.

## Evidence

| Layer | Evidence | Result |
| --- | --- | --- |
| UI and API source contracts | `npm run test:supplement-review-ui` | PASS — workspace scoping, 404 for foreign drafts, admin-only decisions, terminal-state guard, no insurer/export path, CI wiring |
| Agent 5 engine | `npm run test:agent5-supplement` | PASS — evidence-backed deltas, review-only packet |
| PostgreSQL RLS, approval, immutability | `migration-safety` job runs `scripts/ci/supplement-specialist-assertions.sql` | Assertions exist for member approval denial, admin approval, approved immutability, and cross-workspace denial; the PR check reports the real result |
| Browser rendering | Not run in this environment | **Not tested** |
| Supabase Auth with two live users | Not run | **Not tested**; Gate 1 still needs credentials |
| Production | Not deployed | **Not touched** |

## Boundaries

- This is not an insurer portal and does not file a claim.
- It does not export ESX, price a supplement, or approve coverage.
- It does not replace the separate owner decision on a legitimate contract or deposit.
- It does not create a customer-facing document.
