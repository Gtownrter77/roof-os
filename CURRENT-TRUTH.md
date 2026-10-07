# ROOF/OS — Current Truth

**Authority date:** 2026-10-06  
**Repository:** `Gtownrter77/roof-os`  
**Production URL:** https://roof-os-lemon.vercel.app  
**Supabase project:** `xksumagfbegdlapwysps`  
**Current main SHA:** `af48bf9d36e2521f73702f560e44c3589d8d3ca7`

This file is the single authoritative status record. Older checkpoint headers in README, STATE-OF-THE-UNION, CURRENT-STATE, and HANDOFF are historical and do not override this document.

---

## What the product is

Software for a small roofing company that lives in the field.

- Office runs the pipeline (leads, calendar, tasks, estimates, invoicing).
- Phone takes the pictures (field app shell + offline queue).
- The roof keeps a record after you get paid (Roof Passport + warranty checklist).

Not a call center. Not a fake Xactimate.

---

## What works today (verified in source + CI)

| Capability | Status |
|---|---|
| Magic-link auth + session refresh | Real |
| Workspace model + RLS-scoped leads, inspections, photos | Real |
| Inspection sessions + private Storage photo paths | Real |
| Draft inspection reports with human review gates | Real |
| Owner price books + local tax rates | Real |
| Home Depot / Lowe’s retailer reference pricing (provenance required) | Real |
| Receptionist lead/tenant isolation, Stripe payment-link admin gate, Twilio voice/SMS admin gate, worker-only booking RPC | **VERIFIED** (migration 043 applied) |
| AI observations non-authoritative; Golden Report requires tech verification, signatures, manager approval | Enforced |
| Building-code guidance requires locality lookup first | Fixed |
| Workspace switch surfaces auth/membership/request failures | Fixed |
| Lead CSV export neutralizes spreadsheet formula injection | Fixed |
| AI screen routes to persisted photo-estimate workflow (no fabricated browser reports) | Fixed + regression |
| Invoice live-data regression registered in CI | Fixed |
| Auth CSP nonce hydration / AI chat hidden on login | Fixed (current tip of main) |
| Storm command center dashboard | Merged (#223) |
| Inspection camera audio | Merged (#222) |

---

## What is not ready / still evidence-gated

| Item | Status | Why |
|---|---|---|
| Vercel production deploy of current main | **BLOCKED** | Hobby account build-rate limit (`api-deployments-free-per-day`). Platform constraint, not a code failure. |
| Invitation email delivery + acceptance lifecycle | **PARTIAL** | Server-side invite + acceptance page exist; live email delivery unproven. |
| Full two-user / two-workspace browser RLS + Storage isolation | **PARTIAL** | Simulated checks passed; real second-user browser proof still needed. |
| Live Stripe / Twilio provider success/failure | **PARTIAL** | Authorization gates verified; live provider outcomes not exercised. |
| Scheduled cron execution evidence | **PARTIAL** | Routes return non-2xx on internal failure; actual schedule outcomes unproven. |
| Mobile signed APK + authenticated device smoke | **BLOCKED / PARTIAL** | Workflow exists; needs `EXPO_TOKEN`. Field batch-1 (agenda, photo albums) is on a branch, not merged. |
| Licensed carrier / Xactimate / Verisk price lists | **NOT IMPLEMENTED** | Intentional boundary. Retailer prices are reference only. |
| Jurisdiction-authoritative building codes beyond IRC + locality | **PARTIAL** | Locality gate exists; full jurisdiction authority not claimed. |
| Public homeowner Roof Passport portal + transfer packet | **PARTIAL** | Internal passport exists; public signed-URL portal incomplete. |
| Supabase leaked-password protection | **OPEN** | Advisor finding; not changed in recent hardening. |
| Six authenticated SECURITY DEFINER warnings | **OPEN** | Intentional shared RPCs; review item, not observed tenant bypass. |

---

## Authority boundaries (do not blur)

1. **AI observations are never customer-ready.** Technician verification, source attribution, required signatures, and manager approval are mandatory before a Golden Report ships.
2. **Retailer prices are reference data.** They require source, market/ZIP, retrieval time, effective date, and owner approval before use in an estimate. They are not licensed Xactimate or carrier rates.
3. **Prototype / experimental screens** (chat, notifications, status, and any “science class” UI) are disclosed as non-production. Do not sell them.
4. **GitHub CI green ≠ production verified.** Vercel deploy status and live provider outcomes are separate evidence gates.

---

## Open process items

- PR #219 (docs: clarify final checkpoint baseline) — still open; docs-only.
- Mobile branch `mobile/field-batch-1-job-agenda-photo-albums` — not merged; next gate is authenticated device smoke + APK.
- Do not merge any PR while required checks are pending or failing (see `UPDATE-CHECKPOINT-LAW.md`).

---

## Resume order (owner actions)

1. Resolve Vercel rate limit (upgrade or wait) and confirm a successful production deploy of current main.
2. Add `EXPO_TOKEN` secret and run the mobile APK workflow; complete authenticated field smoke before merging the mobile batch.
3. Exercise invitation delivery with a real second user.
4. Run real two-user / two-workspace browser RLS + Storage isolation.
5. Enable Supabase leaked-password protection.
6. Decide fate of remaining prototype routes (keep disclosed or remove).

---

## How to run locally

```bash
cp .env.example .env.local
# paste Supabase URL and anon key
npm ci
npm run dev
```

Migrations live in `supabase/migrations/`. Apply them in order.

Field app:

```bash
cd apps/field
npm ci
npx eas login   # or set EXPO_TOKEN
npx eas build --platform android --profile preview
```

---

**This file supersedes all prior checkpoint headers dated 2026-10-05 and earlier.**  
Update this file only when a new verified work batch lands and the remote SHA is confirmed.
