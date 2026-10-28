# Evidence-backed quantity and trade deltas

Issue: #336, Day 17. Source: `lib/agent5/comparator.ts`, `lib/agent5/parser.ts`, `lib/agent5/types.ts`. Tests: `scripts/agent5-supplement-specialist-test.mjs`.

## Purpose

A supplement review must not invent a gap. This layer emits a delta only when both sources state the value being compared. Everything else becomes an explicit `question`, and the packet stays review-only.

## Quantity delta

A `quantity_delta` proposal is emitted only when all of these are true:

1. Both lines are matched by explicit code or description overlap.
2. Both lines are enabled. Alternate rows never participate.
3. Both lines state a quantity.
4. Both lines state a unit, and the units are identical after parser normalization (`SQ`, `SF`, `LF`, ...).
5. `abs(contractor - carrier) > max(0.01, abs(carrier) * 0.02)`.

When the unit cost is stated, `amount_delta = round(quantity_delta * contractor_unit_cost, 2)`. Otherwise `amount_delta` is `null`. The engine never looks up a unit price.

Examples:

| Carrier | Contractor | Result |
| --- | --- | --- |
| 10 SQ | 12 SQ | `quantity_delta` +2, amount from contractor unit cost |
| 10 SQ | 10.1 SQ | No delta; inside 2% tolerance |
| 10 SQ | 100 SF | `question`: units are not comparable |
| 10 (no unit) | 12 (no unit) | `question`: units are not comparable |
| 10 SQ | quantity missing | `question`: source does not state both quantities |
| alternate row | any | Excluded before comparison |

A unit mismatch is a real finding for a human, so it is surfaced. It is not converted into a numeric difference.

## Trade delta

A `trade_mismatch` proposal is emitted only when all of these are true:

1. Both lines are matched and enabled.
2. Both lines have a category.
3. The category is `stated` by the source on both lines.
4. The two stated categories differ.

The proposal carries `trade_delta: { carrier, contractor }`, both evidence strings, and no quantity or amount delta. Categories come from the fixed set: `material`, `labor`, `allowance`, `fee`, `tax`.

Inferred categories are hints from description words. They are recorded as `category_provenance: "inferred"` and never raise a trade delta. A category supplied by a structured row is `category_provenance: "stated"`. A line with no category hint is `unknown`.

## Why this is conservative

- The comparator has no Xactimate catalog and no trade taxonomy beyond the fixed category set. It cannot know that "Drip edge" and "Fascia" belong to the same trade.
- Description matching is lexical. Low-confidence matches already surface as `code_mismatch` or `question`.
- Two inferred hints that point at different categories are more likely a parsing artifact than a real trade dispute.
- Quantities in different units are not convertible here. The engine has no measurement conversion authority.

## False-positive matrix

| Case | Expected | Test |
| --- | --- | --- |
| 10 SQ vs 100 SF | No quantity delta; `question` | `quantities in different units never produce a delta` |
| Missing units on both sides | No quantity delta; `question` | `missing units never produce a delta` |
| 10 SQ vs 10.1 SQ | No quantity delta | `within-tolerance noise never produces a delta` |
| Stated material vs stated labor | `trade_mismatch` with `trade_delta` | `a stated category difference produces a trade delta` |
| Same stated category | No trade delta | section 8e |
| Inferred material vs inferred labor | No trade delta | `inferred categories never produce a trade delta` |
| Alternate contractor row | Never missing scope | `a disabled contractor alternate never becomes missing scope` |
| Missing price | `null`, `unknown` provenance | `Omitted price stays unknown` |

## Evidence boundaries

| Layer | Status |
| --- | --- |
| Comparator and parser behavior | **Tested locally** with synthetic rows |
| Agent 5 packet and route contracts | **Tested locally** |
| PostgreSQL persistence | **Unchanged** by this layer |
| Real carrier/contractor documents | **Not tested** |
| Trade or price catalog | **Not implemented** |
| Production | **Not deployed, not migrated** |

The tests prove the rejection rules, not the correctness of a real supplement.
