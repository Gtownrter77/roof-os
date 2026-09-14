# Estimate Templates and Pricing Release Status

## Shipment decision

**Not approved for customer shipment.** The current template, pricing, and photo-estimate screens remain prototypes. They must not produce customer quotes, insurance supplements, contracts, or purchase decisions.

## Three-level gate

| Level | Required evidence | Current status |
| --- | --- | --- |
| Level 1 — Static | TypeScript, production build, SQL review, secret scan, and diff validation | **Passed** |
| Level 2 — Runtime | Production route smoke test, protected-route redirect, and no misleading production claims | **Passed for the prototype guardrails** |
| Level 3 — Data/security | Apply migrations 006 and 007; verify RLS across two workspaces; verify price/template version snapshots and approval transitions | **Blocked until migrations are applied to the target Supabase project** |

## What changed in this checkpoint

The UI now labels local random pricing as `PROTOTYPE`, local photo analysis as `SIMULATED`, and hardcoded estimate templates as `NOT SHIPPED`. Migration 007 adds the durable foundation for workspace-scoped templates, template versions, price books, price-book items, estimates, and estimate line items. Every estimate can retain its template version, price book, formula version, and source snapshots.

Migration 007 does not claim to provide live pricing. A supplier feed, approved import process, or owner-managed price-book ingestion job is still required before the pricing feature can be called current.

## Release blockers

The feature cannot ship until a real price source is selected and verified, the estimate editor writes durable records, the deterministic pricing engine is implemented, customer approval is recorded, and the three-level gate passes with evidence. The photo-estimate demo must remain disabled for customer quoting until measurements and materials come from a verified workflow.

## Insurance claims boundary

ROOF/OS does **not** currently contain Xactimate line items, Xactimate codes, or a licensed current claims price list. Xactimate and its pricing data are Verisk products with proprietary, localized data. ROOF/OS must not copy or imply equivalence to that catalog without an appropriate licensed integration or a customer-provided authorized export.

Migration 008 adds a claims-safe internal line-item model with trade, unit, coverage type, labor/material/equipment flags, tax and depreciation flags, market, effective dates, source type, and price-book references. It intentionally contains no fabricated “current” prices. A real claims release requires a licensed provider, verified supplier feed, or owner-managed price import with provenance and effective dates.

The four automation agents are currently **configured, not production-ready workers**. Agents 1 and 2 have deterministic database foundations; Agent 3 has documented rules but no live inspection event worker; Agent 4 remains disabled pending the inspection/report approval runtime. Migration 008 adds heartbeat records so all four can be proven healthy before shipment.
