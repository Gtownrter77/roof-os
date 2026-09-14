# Claims Pricing Integration Boundary

## Current decision

ROOF/OS will support an **Xactimate-style claims workflow** without reproducing Verisk's proprietary catalog. The internal model supports localized trades, units, coverage type, labor/material/equipment components, tax and depreciation flags, effective dates, source provenance, price-book snapshots, and estimate versioning.

The supplied CapOut links show a viable authorized workflow for uploading insurance PDFs and generating Contractor or Carrier ESX files through CapOut's API. CapOut's public API documentation states that requests use a `capout-api-key`, accept PDF uploads, provide status tracking, and return ESX download links. ROOF/OS does not currently have a CapOut API key or connector configured, so no live import is enabled.

## Required production path

1. Obtain an organization-approved CapOut API key and confirm the account's data-processing and retention terms.
2. Store the key only as a server-side secret named `CAPOUT_API_KEY`; never expose it to browser or mobile bundles.
3. Add a server-side upload adapter for `POST https://api.capout.ai/upload`.
4. Store only the returned organization-scoped document ID and stable Contractor/Carrier links in a workspace-scoped claims-import record.
5. Poll or subscribe to status updates server-side, then parse the authorized ESX/PDF output into `insurance_line_items` and `price_book_items`.
6. Preserve the original source reference, market, effective timestamp, source document hash, and import version on every imported line item.
7. Require human review before an imported estimate can become `pending_approval` or be sent externally.

## ROOF/OS adapter

The web app now exposes `POST /api/claims/capout`. It requires an authenticated ROOF/OS user, a workspace UUID, and an HTTPS source URL. The server sends the request to CapOut using the server-only `CAPOUT_API_KEY`, then records the returned document ID and provider response in `claims_imports`. The key is never accepted from the browser request and is never returned to the client.

## Prohibited shortcuts

ROOF/OS must not scrape the CapOut blog, copy Verisk/Xactimate codes or price lists, claim to have current market pricing without a dated source, or use an unlicensed sample catalog as an insurance estimate database.

## Shipment gate

This integration remains **not ship-ready** until the API key is configured, the adapter is implemented and tested, an authorized sample claim is imported, two-workspace isolation is verified, and the three-level shipment gate passes.
