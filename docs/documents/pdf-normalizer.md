# Local-first PDF normalizer

Issue: #336, Day 16. Source: `lib/documents/normalizer.ts`. Contract test: `scripts/pdf-normalizer-test.mjs`.

## What it does

Turns structured Docling output into typed estimate rows with page provenance. It is deterministic, offline, and review-only. There is no model call, no provider key, and no export.

```
Docling worker `pages[]`
  -> normalizeDoclingDocument
  -> NormalizedRow[] (ExtractedLine + row_kind + cells)
  -> Agent 5 comparator / review packet
```

The normalizer only reshapes text Docling already extracted. It never invents text, quantity, price, a unit, or a page number.

## Input shape

```json
{
  "document_id": "carrier-pdf-1",
  "pages": [
    {
      "page": 3,
      "blocks": [
        { "kind": "text", "text": "RFG-001  32.5 SQ  $145.00  Remove and replace architectural shingles" },
        { "kind": "table", "header": ["item_code", "description", "quantity", "unit", "unit_price"],
          "cells": [["DRY-010", "1/2 drywall", "448", "SF", "$2.46"]] }
      ]
    }
  ]
}
```

- `pages[]` is the only accepted source of rows.
- `page` is Docling's own `page_no`. If it is missing, the normalizer assigns sequence order and labels that row `synthesized`.
- Text blocks are split per non-empty line. Table blocks are split per row.
- A table header is optional. Header aliases: `item_code`/`code`/`cat`/`sel`, `description`/`desc`/`item`, `quantity`/`qty`, `unit`/`uom`, `unit_cost`/`unit_price`/`price`.
- With a header, cells are mapped by declared role. Without a header, cells keep source order and typed fields stay `null`. Cell position is never treated as a column meaning.

## Output shape

| Field | Meaning |
| --- | --- |
| `rows[]` | Typed rows: `item_code`, `description`, `category`, `quantity`, `unit`, `unit_cost`, `line_total`, `enabled`, `paid_when_incurred`, `provenance`, `confidence`, `issues`, `source` |
| `rows[].row_kind` | `text_line` or `table_row` |
| `rows[].cells` | Raw cells for table rows; `null` for text lines |
| `pages[]` | `page`, `page_provenance` (`source` or `synthesized`), `row_count` |
| `warnings[]` | Every skip, cap, truncation, duplicate page, and synthesized page |
| `truncated` | True when any cap stopped reading |
| `text_chars` | Characters read before caps |
| `row_count`, `table_row_count` | Counts after caps |
| `export_blocked`, `review_required` | Always `true` |

## Guarantees

1. **Page provenance is explicit.** A real Docling page number is `source`. A sequence number the normalizer had to invent is `synthesized`, and a warning is added. The two are never mixed.
2. **Missing values stay missing.** A row without a stated price keeps `unit_cost: null`, `line_total: null`, `provenance: "unknown"`, and an issue. It is never rewritten to `$0.00`.
3. **No invented table semantics.** Without a declared header, a cell that happens to look like a price is not parsed as one.
4. **Caps are reported, not silent.** Page, block, row, and character limits all set `truncated` and add a warning.
5. **Deterministic.** The same input produces deep-equal output. No clock, no randomness, no network.
6. **Review-only.** `export_blocked` and `review_required` are literal `true` in the return type.

## Caps

| Option | Default |
| --- | --- |
| `maxPages` | 200 |
| `maxBlocksPerPage` | 500 |
| `maxRows` | 5000 |
| `maxTextChars` | 2,000,000 |

The worker enforces the same page and block bounds before it sends output (`MAX_STRUCTURED_PAGES`, `MAX_BLOCKS_PER_PAGE`, `MAX_STRUCTURED_CHARS`) and reports `structuredTruncated`.

## Worker change

`workers/claims/server.py` now returns structured pages in addition to markdown:

- `pages[]` grouped by Docling `prov.page_no`, never a client-supplied page number.
- `pageCount`, `blockCount`, `structured`, `structuredTruncated`.
- The markdown field and its `MAX_OUTPUT_CHARS` cap are unchanged.
- Text is read from item `text`; tables fall back to `export_to_markdown`.

The existing CI smoke test now asserts that a real Docling parse of a synthetic PDF produces non-empty pages, that every page number is `>= 1`, and that the expected text appears in the structured output. It does not assert extraction accuracy on a customer document.

## Route change

`app/api/supplements/review/route.ts` uses the normalizer when the caller supplies Docling pages and no structured carrier rows. The response adds `normalization` with page count, pages, warnings, and the truncation flag. Existing guarantees are unchanged: membership check, body cap, row/page caps, `export_blocked: true`, `review_required: true`, no outbound call.

## Evidence boundaries

| Layer | Status |
| --- | --- |
| Normalizer source behavior | **Tested locally** — `scripts/pdf-normalizer-test.mjs` (synthetic input only) |
| Worker structured output | **Source-verified locally**; real Docling execution only in the GitHub-hosted `ROOF OS Claims Docling Runtime` job |
| Agent 5 contract | **Tested locally** — `test:agent5-supplement`, `test:agent5-capout-study` |
| Real carrier PDF accuracy | **Not tested** — no customer or carrier documents were used |
| Signed Supabase Storage ingestion | **Not tested** — needs credentials |
| PostgreSQL persistence of normalization | **Not changed** — the packet store is unchanged |
| Production | **Not deployed, not migrated** |

The local test never runs Docling. It proves the contract around the worker output, not the extraction quality of the model.
