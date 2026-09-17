# ROOF/OS Data Quality and Training-Data Governance

## Scope

ROOF/OS currently has no customer-training corpus and does not train a model inside the repository. Its model-adjacent data consists of technician-entered measurements, inspection photos, OpenStreetMap footprint assists, NOAA candidate events, owner-managed price books, building-code reference responses, and provider response records. These sources must remain distinguishable from certified or carrier-approved facts.

## Required record properties

Every model-adjacent record should preserve its source, capture time, workspace, author or provider, confidence, and review state. Human-entered measurements must use `source_type: manual` and `confidence: unverified` until a technician verifies them. OpenStreetMap footprints are property-context assists only. NOAA responses are candidate corroboration, not date-of-loss attestations. Retailer prices are reference observations, not estimating-system rates. Automated photo workflows remain in review until a technician approves them.

## Dataset rules

Production customer data is not copied into prompts, fixtures, tests, or training corpora. Synthetic examples must be explicitly labeled and must not contain real names, addresses, phone numbers, email addresses, signed URLs, access tokens, or service credentials. Any future evaluation set must be workspace-isolated, versioned, deduplicated by source record, and accompanied by a label definition and known limitations. A record may not be used as a positive training example solely because an automated workflow produced it; technician review and provenance are required.

## Evaluation design

Evaluation samples should cover ordinary roofs, incomplete photo sets, ambiguous property matches, missing measurements, conflicting sources, storm candidates with uncertain dates, and unavailable price books. Metrics should separately report extraction accuracy, provenance preservation, confidence calibration, and unsafe-claim rate. A result that is numerically plausible but loses source or review state is a failure.

## Release gate

Before enabling any new model or prompt that consumes these records, run `node scripts/data-quality-check.mjs` and verify that the output schema still carries source, confidence, review, and workspace fields. Run two-workspace isolation tests with synthetic users. Do not promote automated outputs to customer-facing estimates, claims attestations, or payment decisions without explicit human approval.
