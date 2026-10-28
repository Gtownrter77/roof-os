# Inspection evidence packet (Day 9)

Code: `lib/inspection/packet.ts`, `app/api/inspections/[id]/packet/route.ts`, `app/inspections/[id]/page.tsx`.

## What it is

A deterministic, reviewable packet for one inspection session:

- photo metadata: album, caption, upload status, capture time, dimensions;
- album counts;
- measurement rows with their `source_type`, `confidence`, source reference and **only the values the row states**;
- the Agent 3 evidence review output, when one exists;
- a checklist split into **blocking** items and **review** items.

No value is derived. A missing measurement is shown as missing, never estimated. A missing Agent 3 run is stated as "not reviewed", never imputed.

## Checklist rules

| Item | Blocking | Rule |
| --- | --- | --- |
| `inspection_completed` | yes | Session status is `completed` |
| `photos_present` | yes | At least one photo row |
| `unique_objects` | yes | No duplicate stored object path |
| `uploads_complete` | no | Every photo finished uploading |
| `captions_present` | no | Every photo has a caption |
| `measurements_present` | no | At least one measurement row |
| `measurement_provenance` | no | No measurement left `unverified` |
| `agent3_review` | no | Agent 3 reported no evidence issues |

`readyForReview` is true only when no blocking item is missing.

## Privacy

- The API returns metadata only. It does not create or return storage URLs, and it makes no outbound call.
- The bucket `inspection-photos` is private (`public = false` in migration 002).
- The review page creates **300-second signed URLs** with the signed-in member's session.
- Every query filters `workspace_id`; a foreign inspection returns 404, not a leak.

## Evidence boundaries

- Source + behaviour: `npm run test:inspection-packet` (checklist, blockers, stated-values-only, Agent 3 absence, route contracts).
- Real PostgreSQL / RLS: inspection and photo RLS already ships in migration 003; the route additionally filters by workspace. **Not re-exercised in this change.**
- Real Supabase Storage signing: **not tested** — needs credentials.
- Physical Android capture/offline: **Day 8, not tested**.
- Production: untouched.
