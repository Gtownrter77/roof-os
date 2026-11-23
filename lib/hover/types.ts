// Canonical Hover-parity entities. Measurements are versioned data records;
// the 3D model is a presentation view over them, never the source of truth.

export type Vec3 = { x: number; y: number; z: number }
export type SlotId =
  | 'front' | 'front_right' | 'right' | 'rear_right'
  | 'rear' | 'rear_left' | 'left' | 'front_left'
export type ImageRole = 'model' | 'evidence' | 'damage' | 'reference'
export type CaptureMode = 'exterior' | 'interior'
export type Deliverable = 'roof_only' | 'full_exterior' | 'photos_only'
export type MetricStatus = 'metric' | 'relative-only' | 'failed'
export type ProviderPath = 'oss' | 'commercial'
export type AnchorKind = 'door' | 'garage' | 'wall' | 'bar' | 'gps' | 'footprint'
export type EdgeType = 'eave' | 'rake' | 'ridge' | 'hip' | 'valley' | 'transition' | 'soffit' | 'gutter'

export const CAPTURE_SLOTS: ReadonlyArray<{ id: SlotId; label: string }> = [
  { id: 'front', label: 'Front' },
  { id: 'front_right', label: 'Front-right corner' },
  { id: 'right', label: 'Right side' },
  { id: 'rear_right', label: 'Rear-right corner' },
  { id: 'rear', label: 'Rear' },
  { id: 'rear_left', label: 'Rear-left corner' },
  { id: 'left', label: 'Left side' },
  { id: 'front_left', label: 'Front-left corner' },
]

export const SLA_TIERS: ReadonlyArray<{
  id: 'visual-twin' | 'estimated' | 'verified' | 'certified'
  measurementsAllowed: boolean
  locks: string[]
}> = [
  { id: 'visual-twin', measurementsAllowed: false, locks: [] },
  { id: 'estimated', measurementsAllowed: true, locks: ['tech_lock'] },
  { id: 'verified', measurementsAllowed: true, locks: ['tech_lock', 'owner_sequence'] },
  { id: 'certified', measurementsAllowed: true, locks: ['tech_lock', 'owner_sequence', 'survey_control'] },
]

export type ExifFacts = {
  latitude?: number | null
  longitude?: number | null
  capturedAt?: string | null
  focalLengthMm?: number | null
  imageWidth?: number | null
  imageHeight?: number | null
  make?: string | null
  model?: string | null
}

export type ScanJob = {
  id: string
  workspaceId: string
  propertyId: string | null
  status: 'capturing' | 'ingested' | 'reconstructing' | 'measuring' | 'review' | 'locked' | 'exported' | 'failed'
  captureMode: CaptureMode
  deliverable: Deliverable
  providerPath: ProviderPath
  slaTier: 'visual-twin' | 'estimated' | 'verified' | 'certified'
  ownerLockSequence: string[]
  createdBy: string | null
  createdAt: string
}

export type ScanImage = {
  id: string
  jobId: string
  workspaceId: string
  storagePath: string
  sha256: string
  byteSize: number
  slot: SlotId | null
  role: ImageRole
  gpsInFile: boolean
  exif: ExifFacts | null
  blurScore: number | null
  lightScore: number | null
  capturedAt: string | null
}

export type ScaleAnchor = {
  id: string
  jobId: string
  kind: AnchorKind
  observedValue: number
  unit: 'ft' | 'm'
  sourceImageId: string | null
  confidence: number
  weighted?: boolean
}

export type ReconstructionRecord = {
  id: string
  jobId: string
  workspaceId: string
  manifestHash: string
  engineVersions: Record<string, string>
  meshUrl: string | null
  splatUrl: string | null
  metricStatus: MetricStatus
  reprojectionErrorPx: number | null
  points: Vec3[]
}

export type MetricTransform = {
  scale: number | null
  unit: 'ft' | 'm'
  metricStatus: MetricStatus
  anchorsUsed: string[]
  residualsIn: number[]
  disagreementIn: number | null
  gpsDownweighted: boolean
  reprojectionErrorPx: number | null
  engineVersions: Record<string, string>
  manifestHash: string
}

export type Facet = {
  id: string
  vertices: Vec3[]
  normal: Vec3
  planeId: string
  role: 'roof' | 'soffit' | 'wall'
  material: string | null
  evidenceImageIds: string[]
}

export type LinearFeature = {
  id: string
  type: EdgeType
  start: Vec3
  end: Vec3
  length: number
  evidenceImageIds: string[]
}

export type Opening = {
  id: string
  type: 'door' | 'sliding_glass' | 'window' | 'unknown'
  width: number | null
  height: number | null
  evidenceImageIds: string[]
}

export type Gutter = {
  id: string
  length: number | null
  downspoutCount: number | null
  evidenceImageIds: string[]
}

export type FacetGraph = {
  facets: Facet[]
  edges: LinearFeature[]
  openings: Opening[]
  gutters: Gutter[]
  soffits: Facet[]
  sourceReconstructionId: string
}

export type EvidenceLink = {
  imageId: string | null
  region: { x: number; y: number; width: number; height: number } | null
  planeId: string | null
  modelVersion: string | null
}

export type MeasurementType =
  | 'facet_area' | 'facet_pitch' | 'pitch_adjusted_squares' | 'ridge_lf' | 'hip_lf'
  | 'valley_lf' | 'eave_lf' | 'rake_lf' | 'gutter_lf' | 'downspout_count'
  | 'soffit_area' | 'siding_area' | 'opening' | 'unknown'

export type MeasurementRecord = {
  id: string
  setId: string
  type: MeasurementType
  value: number | null
  unit: string
  confidence: number
  sourceRefs: EvidenceLink[]
  correctionOf?: string
  status: 'proposed' | 'accepted' | 'rejected'
  facetId?: string
  reason?: string
}

export type MeasurementSet = {
  id: string
  jobId: string
  workspaceId: string
  reconstructionId: string | null
  rulesetVersion: string
  status: 'draft' | 'reviewed' | 'relative-only' | 'locked' | 'rejected'
  records: MeasurementRecord[]
  confidenceSummary: { min: number; mean: number; count: number }
  lockedBy: string | null
  lockedAt: string | null
  createdAt: string
}

export type QAState = {
  set: MeasurementSet
  events: QAEvent[]
  locks: string[]
  version: number
  ownerLockSequence: string[]
}

export type QAEvent = {
  id: string
  setId: string
  actorId: string
  actorRole: string
  action: 'accept' | 'correct' | 'reject' | 'lock' | 'unlock'
  before: unknown
  after: unknown
  reason: string | null
  createdAt: string
}

export type ExportArtifact = {
  id: string
  setId: string
  format: 'PDF' | 'XLS' | 'XML' | 'JSON' | 'ESX' | 'SKP' | 'DWG' | 'DXF'
  path: string
  rulesetVersion: string
  sha256: string
  gated: boolean
  createdAt: string
}

export type CaptureValidation = {
  complete: boolean
  missingSlots: SlotId[]
  rejectedImages: { imageId: string; reason: string }[]
  quality: 'ok' | 'recapture'
  anchorsAccepted: ScaleAnchor[]
  reason: string | null
}

export type InputManifest = {
  jobId: string
  workspaceId: string
  images: ScanImage[]
  anchors: ScaleAnchor[]
  manifestHash: string
  createdAt: string
}

export type StageResult = {
  stage: string
  status: 'ok' | 'failed' | 'skipped'
  adapter: string
  output: unknown
  error?: string
}

export type ReportPackage = {
  format: 'PDF' | 'XLS' | 'XML' | 'JSON'
  content: string
  contentHash: string
  rulesetVersion: string
  sections: string[]
}

export type ExportResult = {
  format: ExportArtifact['format']
  content: string
  contentHash: string
  rulesetVersion: string
  status: 'ok' | 'blocked' | 'unsupported'
  reason?: string
}

export type ViewerOverlay = {
  measurementId: string
  label: string
  value: number | null
  unit: string
  evidenceImageId: string | null
  evidenceImageIds: string[]
  evidenceLinks: { href: string; label: string }[]
}

export type ViewerModel = {
  facets: Facet[]
  splatUrl: string | null
  overlays: ViewerOverlay[]
  measurementSource: 'measurement-records'
  manifestHash: string
  sourceReconstructionId: string
}

export type MaterialSelection = { facetId: string; material: string; color: string | null; product: string | null }
export type DesignQuantity = {
  facetId: string
  material: string
  areaSqFt: number
  wasteFactor: number
  quantitySqFt: number
}

export type DesignSelection = {
  jobId: string
  setId: string
  mode: '2d-photo' | '3d-twin'
  roofStyle: string | null
  facetGraphRef: string
  selections: MaterialSelection[]
  facets: { id: string; material: string | null }[]
  quantities: DesignQuantity[]
  hash: string
}

export type EstimateLine = {
  code: string
  description: string
  quantity: number
  unit: string
  price: number | null
  priceSource: string | null
  measuredFrom: string
}

export type Estimate = {
  id: string
  jobId: string
  variant: string
  lines: EstimateLine[]
  audit: {
    rulesetVersion: string
    manifestHash: string
    designHash: string
    priceBookHash: string
    priceBookAt: string | null
  }
}
