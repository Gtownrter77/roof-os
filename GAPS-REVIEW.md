# Roof OS gap review vs AccuLynx, JobNimbus, Jobber, Roofr

Reviewed against the current repo. Do not treat prototype routes (`/quantum`, `/vr`, `/genetic`) as product.

## Table stakes we should not sell as unique

Contacts, leads, jobs, estimates, calendar, invoicing, chatbots, lead scoring, AI receptionist, AI-built websites. Competitors already ship those.

## Biggest five — status in this codebase

| Differentiator | Status |
| --- | --- |
| Roof Passport (property-first record) | Schema + `/passport/[leadId]` shipped. Homeowner public portal and transfer packet not built. |
| Warranty + maintenance OS | `warranties` table + `/warranty` shipped. Expiration alerts, transfers, subscriptions not built. |
| Insurance/supplement copilot | Supplement *records* exist. No carrier-PDF extraction or contractor-vs-carrier line compare. |
| Job ready / margin risk | Owner brief exceptions exist. No margin math until an active owner price book exists. |
| Proof-of-work / evidence verifier | Photos now attach to inspection sessions. Completeness score is a first formula, not vision AI. |

## What others do not have as a core product

1. Permanent roof record after final payment.
2. Warranty eligibility as a living checklist, not a file cabinet.
3. Owner exception brief instead of ten dashboards.
4. Owner-locked price books that refuse to pretend they are Xactimate.
5. Storm evidence kept as corroboration, not auto-claim.

## Do not build next

Generic chatbot, Scout-clone CRM editor, lead-rank copy, AI website builder.

## Build next after Passport/warranty/brief work

1. Persist report packets onto the passport.
2. Human-reviewed supplement gap list from uploaded carrier PDFs.
3. Production-ready score (contract, deposit, color, permit, materials, crew, weather).
4. Homeowner-visible passport link with signed URLs only.
