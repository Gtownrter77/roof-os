export type AerialImagerySource = {
  provider: 'OpenAerialMap' | 'ArcGIS'
  available: boolean
  catalogUrl: string | null
  imageUrl: string | null
  note: string
}
export type AerialImageryLookup = {
  address: string
  sources: AerialImagerySource[]
  requiresInspectionPhoto: boolean
}
/**
 * The repository already exposes address lookup and OpenAerialMap catalog metadata
 * through /api/measurements/property. That endpoint intentionally does not turn
 * catalog records into a fabricated roof image. Phase D consumes an actual private
 * inspection image until a licensed imagery provider is configured to return pixels.
 */
export function describeAerialImageryAvailability(address: string): AerialImageryLookup {
  return {
    address,
    sources: [
      { provider: 'OpenAerialMap', available: false, catalogUrl: null, imageUrl: null, note: 'Catalog metadata is available through /api/measurements/property; an image must be selected from private inspection storage.' },
      { provider: 'ArcGIS', available: false, catalogUrl: null, imageUrl: null, note: 'Requires an authorized Esri imagery layer and provider attribution.' },
    ],
    requiresInspectionPhoto: true,
  }
}
