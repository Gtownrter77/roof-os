# Next 10 — build slice after the live file works

The machine drafts. A human sends.

| # | Item | Status tonight | Open source path |
| --- | --- | --- | --- |
| 11 | Field app start-inspection | Shell exists `apps/field` | Expo |
| 12 | Offline photo queue | Not built — spec only | Expo SQLite / TinyBase |
| 13 | Map + our leads + NWS pins | `/map` shipped (list, not tiles yet) | NWS api.weather.gov, OSM later via Leaflet |
| 14 | Hail / swath layer | Stub on `/canvass` | IEM / NWS warnings. Not a hit map. |
| 15 | Existing customers first | `/canvass` lists our leads before new doors | Our Postgres |
| 16 | Canvasser route | Not built | OSRM / Valhalla + OSM |
| 17 | Draft squares assist | Manual entry on `/estimate` | OSM footprint later |
| 18 | Draft estimate from owner book | `/estimate` shipped | Our price book |
| 19 | Approve before email | Required copy on `/estimate` | — |
| 20 | Name the lumber | `/credits` | Next.js, Expo, Supabase, NWS, OSM, Pipecat |

Do not tell a homeowner they were hit. Do not email a number from this slice.
