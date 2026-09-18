# ROOF/OS footprint

The machine drafts. A human sends.

## What we sell

Office file + field capture + a record that survives final payment.
Canvasser tools that point a body at a street. Never a number to a homeowner without the shop.

## Capability map → open source path

| # | Capability | Now | Open source / public path | Credit |
| --- | --- | --- | --- | --- |
| 1 | Sign in | Live | Supabase Auth magic link | supabase |
| 2 | Lead file | Live | Postgres + RLS | PostgreSQL, supabase |
| 3 | Status + activity | Live | `leads`, `lead_activity` | — |
| 4 | Schedule inspection | Live | `appointments` | — |
| 5 | Photos on the inspection | Live | Supabase Storage + `inspection_photos` | supabase |
| 6 | Inspection list | Live | `inspection_sessions` | — |
| 7 | Draft report | Live | NWS + OSM Overpass | weather.gov, OpenStreetMap |
| 8 | Owner price book | Live | `price_books`, settings API | — |
| 9 | Tasks on a lead | Live | `tasks` | — |
| 10 | Brief / Passport / warranty | Live UI; save needs migration 020 | tables in `020_*.sql` | — |
| 11 | Field app | Shell | Expo / React Native | expo |
| 12 | Offline photo queue | Not built | Expo SQLite or TinyBase queue | expo, TinyBase |
| 13 | Map + NWS pins | Partial (weather/report) | Leaflet + OSM tiles + api.weather.gov | Leaflet, OSM, NWS |
| 14 | Hail / swath layer | Not built | IEM + NWS warnings; MRMS where licensed | Iowa Env Mesonet, NWS |
| 15 | Canvasser route | Not built | OSRM or Valhalla on OSM | Project OSRM, OSM |
| 16 | 1–2 photo draft measure | Not built | User squares first; OSM footprint assist; no certified photogrammetry claim | OSM |
| 17 | Draft estimate email | Partial | Owner price book + human send | — |
| 18 | Voice receptionist | Not built | Pipecat or LiveKit Agents + Twilio minutes | Pipecat, LiveKit |

## License posture

We use their work. We name them. We do not sell their code as ours.
NWS and OSM are public data with attribution. Carrier price lists are not public and will not be scraped.

## Build order

0 This week: first 10 on the live site + migration 020.
1 Field queue + office sees photos.
2 Map + NWS pins on our leads.
3 Draft estimate from owner book, locked send.
4 Alert polygon + existing-customer first.
5 Route list.
6 Photo-assist squares as draft only.
