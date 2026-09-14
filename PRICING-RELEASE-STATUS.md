# Estimate Templates and Pricing Release Status

## Shipment decision

**Not approved for customer shipment.** The current template, pricing, and photo-estimate screens remain prototypes. They must not produce customer quotes, insurance supplements, contracts, or purchase decisions.

## Three-level gate

| Level | Required evidence | Current status |
| --- | --- | --- |
| Level 1 — Static | TypeScript, production build, SQL review, secret scan, and diff validation | In progress |
| Level 2 — Runtime | Authenticated route smoke test, template interaction test, pricing interaction test, and no misleading production claims | In progress |
| Level 3 — Data/security | Apply migrations 006 and 007; verify RLS across two workspaces; verify price/template version snapshots and approval transitions | Blocked until migrations are applied to the target Supabase project |

## What changed in this checkpoint

The UI now labels local random pricing as `PROTOTYPE`, local photo analysis as `SIMULATED`, and hardcoded estimate templates as `NOT SHIPPED`. Migration 007 adds the durable foundation for workspace-scoped templates, template versions, price books, price-book items, estimates, and estimate line items. Every estimate can retain its template version, price book, formula version, and source snapshots.

Migration 007 does not claim to provide live pricing. A supplier feed, approved import process, or owner-managed price-book ingestion job is still required before the pricing feature can be called current.

## Release blockers

The feature cannot ship until a real price source is selected and verified, the estimate editor writes durable records, the deterministic pricing engine is implemented, customer approval is recorded, and the three-level gate passes with evidence. The photo-estimate demo must remain disabled for customer quoting until measurements and materials come from a verified workflow.
