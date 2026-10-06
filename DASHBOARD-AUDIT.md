# ROOF/OS Dashboard and Login Audit

**Audit date:** 2026-10-05
**Working branch:** `feat/location-aware-dashboard-20261005`
**Base:** `7d442df5b8455149c9b281299336c5811a9e174f` (`origin/main`)
**Status:** implemented and pushed to a feature branch; not merged or production-verified. Dashboard visual validation remains partial.

## Governing project rules

- Follow the ROOF/OS Master Playbook: roadmap ambition and current execution status are distinct; advance only with evidence; preserve recoverability; do not present `NOT VERIFIED` as `PASS`.
- Follow `GOLDEN-REPORT.md`: every factual claim needs a source; unknown facts stay **Unknown**. AI does not authorize measurements, geometry, prices, insurance decisions, engineering, or code compliance.
- Follow `UPDATE-CHECKPOINT-LAW.md`: commit/push after every three completed, verified work batches, and earlier at requested/major milestones; independently verify the remote SHA and update `HANDOFF.md`.

## What the supplied dashboard reference depicts vs. the audited app

The reference is a design target, not live product evidence. Its sample figures (3 storms, 47 opportunities, 312 jobs, $284K revenue at risk, and its other counters) must not be copied into the product as if they were real.

On merged `main` at the audit base:

- `app/page.tsx` displayed database-backed counts for leads, open tasks, and warranties plus recent leads; it did not implement the reference's whole pipeline or revenue metrics.
- `app/weather/page.tsx` used hardcoded Atlanta coordinates as a fallback when browser geolocation failed.
- `app/storms/page.tsx` displayed a hardcoded severe-thunderstorm warning and storm score rather than live source data.
- `app/auth/login/page.tsx` had working password, email-link, and 6-digit OTP flows, resend/verification cooldowns, callback failure messaging, and safe-next handling. These were preserved while the screen was restyled.
- `components/Navigation.tsx` exposed a small subset of the actual routes. The dashboard now links to real ROOF/OS routes, not invented Customers/Production/Revenue features.

## Selected free/open map and radar approach

The implementation uses open-source MapLibre GL JS with OpenFreeMap's dark style, plus the official public NOAA/NWS GeoServer MRMS WMS composite radar service. This is not MyRadar code or a commercial MyRadar feed.

- [MapLibre GL JS](https://github.com/maplibre/maplibre-gl-js) is BSD-3-Clause licensed. The upstream license was read directly at `https://raw.githubusercontent.com/maplibre/maplibre-gl-js/main/LICENSE.txt`.
- [OpenFreeMap](https://openfreemap.org/) describes its service as open-source map hosting. Its dark style endpoint, `https://tiles.openfreemap.org/styles/dark`, returned HTTP 200 JSON during this audit. Map data attribution includes OpenFreeMap and OpenStreetMap contributors.
- The [NWS GIS portal](https://www.weather.gov/gis/) explicitly lists individual radar WMS links at `https://opengeo.ncep.noaa.gov/geoserver/www/index.html`.
- The official WMS layer `https://opengeo.ncep.noaa.gov/geoserver/conus/conus_bref_qcd/ows` identifies `conus_bref_qcd` as a quality-controlled 1 km x 1 km CONUS radar base-reflectivity composite produced by MRMS. Its GetCapabilities lists PNG/GetMap support. A direct GetMap request returned HTTP 200, `image/png`, and `Access-Control-Allow-Origin: *` during this audit.
- The NWS GIS directory lists equivalent MRMS BREF QCD regional layers for CONUS, Alaska, Hawaii, Caribbean, and Guam. The UI reports when a location is outside a supported layer rather than implying coverage.
- [NCEI's official NEXRAD page](https://www.ncei.noaa.gov/products/radar/next-generation-weather-radar) says digital NEXRAD data is free and provides access methods. NEXRAD Level II is not the selected dashboard raster: this implementation labels the actual source as an MRMS composite.
- [RadrView](https://github.com/cwdaniel/RadrView) is a separate MIT-licensed, self-hosted open-source real-time radar project. Its README describes MRMS composites and higher-resolution NEXRAD Level II, but it requires running its own service. It was not selected for this Vercel-based dashboard change because that would add a persistent backend requirement.
- Local forecast and active-alert lookups use the public [National Weather Service API](https://api.weather.gov/). The dashboard's weather location comes only from the workspace's owner-configured five-digit `default_zipcode` and is geocoded through [OpenStreetMap Nominatim](https://nominatim.openstreetmap.org/). The ZIP is not a roof/property address and does not establish a storm loss.

## Dashboard and login requirements

1. Dashboard weather and radar center on the workspace's saved service ZIP. If no ZIP is set or a source fails, the UI shows setup/unknown state—never Atlanta, a sample alert, or a fabricated zero.
2. The dramatic backdrop is the location-specific radar/map itself, not a generic stock storm image. The login page cannot know a workspace location before authentication, so it requests device geolocation only after the user presses **Use my location**; the page does not persist those coordinates.
3. The live ticker uses sourced NWS weather/alert results and workspace database counts, shows the actual check time, distinguishes unavailable from zero, and offers a pause control/reduced-motion behavior.
4. Password, link, and OTP login behavior, safe-next handling, and cooldowns are preserved.
5. The dashboard shows actual ROOF/OS destinations and backed counts only. It does not invent the reference's opportunities, production, payment, pipeline, or revenue totals.
6. An NWS alert is not proof of roof damage, a loss date, a code violation, or an insurance outcome.

## Current checkpoint evidence

- `npm run test:radar-source` and `npm run test:dashboard-weather`: **PASS**.
- TypeScript, release check, security check, all listed web regression suites, `npm run audit`, and `git diff --check`: **PASS**. Root production dependency audit found 0 vulnerabilities.
- Optimized production build of the intended app code: **PASS**, including `/api/weather/summary` and the redesigned routes.
- Field app clean install, dependency mitigation test, field dependency audit (0 vulnerabilities), TypeScript, and Expo config validation: **PASS**.
- Login route returned HTTP 200 locally and through the sandbox preview URL. Unauthenticated Home and weather API redirected to login (HTTP 307). No authenticated workspace or production database was used.
- The login screenshot rendered before location opt-in. A temporary synthetic dashboard fixture was removed and was not committed; its final browser screenshot and MapLibre console review were not completed after the user's stop instruction.
- Implementation commit `a0d9bade4b96678e34d1c3fa5b09f64e952d3b4f` was pushed to `feat/location-aware-dashboard-20261005`; the remote SHA was verified to match. Handoff receipt commit `758840093031a461f4dc010883ef442255b87448` was also pushed and verified. No PR was opened, no merge was performed, and CI was not monitored after the stop request.
- Production, Vercel deployment, authenticated weather rendering, and signed-in workspace behavior are **NOT VERIFIED**. Do not merge until owner review and required checks are green.
