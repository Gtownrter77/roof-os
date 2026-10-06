# ROOF/OS Dashboard and Login Audit

**Audit date:** 2026-10-05
**Working branch:** `feat/location-aware-dashboard-20261005`
**Base:** `7d442df5b8455149c9b281299336c5811a9e174f` (`origin/main`)
**Status:** implementation in progress; not merged or production-verified.

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
- `app/auth/login/page.tsx` had working password, email-link, and 6-digit OTP flows, resend/verification cooldowns, callback failure messaging, and safe-next handling. These must be preserved while the screen is restyled.
- `components/Navigation.tsx` exposed a small subset of the actual routes. The dashboard should link to real ROOF/OS routes, not invent Customers/Production/Revenue features that are not verified.

## Selected free/open map and radar approach

The implementation uses open-source MapLibre GL JS with OpenFreeMap's dark style, plus the official public NOAA/NWS GeoServer MRMS WMS composite radar service. This is not MyRadar code or a commercial MyRadar feed.

- [MapLibre GL JS](https://github.com/maplibre/maplibre-gl-js) is BSD-3-Clause licensed. The upstream license was read directly at `https://raw.githubusercontent.com/maplibre/maplibre-gl-js/main/LICENSE.txt`.
- [OpenFreeMap](https://openfreemap.org/) describes its service as open-source map hosting. Its dark style endpoint, `https://tiles.openfreemap.org/styles/dark`, returned HTTP 200 JSON during this audit. Map data attribution must include OpenFreeMap and OpenStreetMap contributors.
- The [NWS GIS portal](https://www.weather.gov/gis/) explicitly lists individual radar WMS links at `https://opengeo.ncep.noaa.gov/geoserver/www/index.html`.
- The official WMS layer `https://opengeo.ncep.noaa.gov/geoserver/conus/conus_bref_qcd/ows` identifies `conus_bref_qcd` as a quality-controlled 1 km x 1 km CONUS radar base-reflectivity composite produced by MRMS. Its GetCapabilities lists PNG/GetMap support. A direct GetMap request returned HTTP 200, `image/png`, and `Access-Control-Allow-Origin: *` during this audit.
- The NWS GIS directory lists equivalent MRMS BREF QCD regional layers for CONUS, Alaska, Hawaii, Caribbean, and Guam. The UI must say when a location is outside a supported layer rather than implying coverage.
- [NCEI's official NEXRAD page](https://www.ncei.noaa.gov/products/radar/next-generation-weather-radar) says digital NEXRAD data is free and provides access methods. NEXRAD Level II is not the selected dashboard raster: this implementation labels the actual source as an MRMS composite.
- [RadrView](https://github.com/cwdaniel/RadrView) is a separate MIT-licensed, self-hosted open-source real-time radar project. Its README describes MRMS composites and higher-resolution NEXRAD Level II, but it requires running its own service. It was not selected for this Vercel-based dashboard change because that would add a persistent backend requirement.
- Local forecast and active-alert lookups use the public [National Weather Service API](https://api.weather.gov/). The dashboard's weather location comes only from the workspace's owner-configured five-digit `default_zipcode` and is geocoded through [OpenStreetMap Nominatim](https://nominatim.openstreetmap.org/). The ZIP is not a roof/property address and does not establish a storm loss.

## Dashboard and login requirements

1. Dashboard weather and radar must center on the workspace's saved service ZIP. If no ZIP is set or a source fails, show a setup/unknown state—never Atlanta, a sample alert, or a fabricated zero.
2. The dramatic backdrop must be the location-specific radar/map itself, not a generic stock storm image. The login page cannot know a workspace location before authentication, so it requests device geolocation only after the user presses **Use my location**; the page does not persist those coordinates.
3. The live ticker must use sourced NWS weather/alert results and workspace database counts, show the actual check time, distinguish unavailable from zero, and offer a pause control/reduced-motion behavior.
4. Preserve password, link, and OTP login behavior, safe-next handling, and cooldowns.
5. Show actual ROOF/OS destinations and backed counts only. Do not invent the reference's opportunities, production, payment, pipeline, or revenue totals.
6. An NWS alert is not proof of roof damage, a loss date, a code violation, or an insurance outcome.

## Current checkpoint evidence

- Radar region-selection unit test: passed.
- TypeScript and whitespace checks passed after the initial screen replacement; the ticker/hero update is newer and still requires revalidation.
- Base GitHub push of the backup ref via `git push` returned two transient GitHub internal errors. The authenticated GitHub refs API created `backup/location-aware-dashboard-20261005`, then `git ls-remote` verified it exactly matched base SHA `7d442df5b8455149c9b281299336c5811a9e174f`.
- No feature commit or PR has yet been pushed. Production, Vercel deployment, and production weather rendering are **NOT VERIFIED**.
