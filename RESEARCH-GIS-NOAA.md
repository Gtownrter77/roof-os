# GIS and Storm Evidence Source Notes

## Official sources reviewed

- Cobb County GIS data page: https://geo-cobbcountyga.hub.arcgis.com/pages/get-data
- Cobb County Parcel Viewer: https://geo-cobbcountyga.hub.arcgis.com/app/e22d8c597b4e4762bcd2caa6127696e4
- Cobb County GIS: https://www.cobbcounty.gov/information-technology-services/cobb-county-gis
- NWS API documentation: https://www.weather.gov/documentation/services-web-API
- NCEI Access Data Service API documentation: https://www.ncei.noaa.gov/support/access-data-service-api-user-documentation
- Microsoft Global ML Building Footprints: https://github.com/microsoft/globalmlbuildingfootprints
- Google Earth Engine API reference: https://developers.google.com/earth-engine/apidocs

## Findings

Cobb County provides a public parcel viewer and free GIS-data discovery page. The county’s published data page states that current building footprints, high-resolution imagery, and parcel datasets are available through its data-sales program, with usage restrictions on purchased data. ROOF/OS must not scrape Google Earth or redistribute protected Cobb imagery. The county parcel viewer is retained as a human verification link.

ROOF/OS now uses Nominatim and Overpass/OpenStreetMap for a free building-footprint fallback. The result is labeled low confidence and explicitly does not claim to be roof-surface area. It cannot infer pitch, overhangs, valleys, hips, waste, or gutter length. OpenStreetMap attribution is returned with the result.

The NWS API is open data with reasonable rate limits and requires a descriptive User-Agent. Its alerts endpoint is recent/operational evidence, not a full historical date-of-loss database. NCEI exposes historical data services, but the dataset and query must be selected carefully; an alert or weather record does not prove that a particular property was damaged on that date.

Google Earth Engine and Google Maps/Aerial imagery require compliance with Google terms and credentials. The system does not scrape Google Earth. An authorized aerial measurement provider or licensed county imagery can be added later as a higher-confidence measurement source.

## Nationwide implementation consequence

`GET /api/measurements/property` returns geocoded address, nearby OSM building-footprint candidates, approximate footprint area/perimeter, attribution, OpenAerialMap imagery metadata when available, and a nationwide ArcGIS parcel-search link. Cobb County links remain only as a local example. Measurement confidence remains low until an authorized aerial or human-certified measurement is attached.

The system is designed for jobs across the United States. Local tax-assessor GIS links should be added by state/county when a jurisdiction is known; there is no single nationwide assessor website. ArcGIS Earth can be used for manual review or an authorized ArcGIS imagery layer can be integrated, but the product must preserve Esri/provider attribution and any required token or license.
