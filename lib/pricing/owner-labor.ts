/** Lucide icon component name. Rendered as a stroke icon, never an emoji. */
export type OwnerLaborIcon =
  | 'House'
  | 'Fence'
  | 'AppWindow'
  | 'DoorOpen'
  | 'CloudRain'
  | 'Layers'
  | 'SquareStack'
  | 'Paintbrush'
  | 'Zap'
  | 'Droplets'
  | 'Fan'
  | 'Hammer'
  | 'Sparkles'
  | 'ScanSearch'
  | 'Lightbulb'
  | 'Trash2'
  | 'Mountain'
  | 'Building2'
  | 'Wrench'
  | 'PanelsTopLeft'
  | 'LayoutGrid'
  | 'BrickWall'
  | 'Grid3x3'
  | 'Shield'
  | 'Ruler'
  | 'Warehouse'
  | 'Spline'
  | 'Waves'
  | 'CircleDot'
  | 'Sun'
  | 'AlignStartHorizontal'
  | 'Snowflake'
  | 'Play'
  | 'Triangle'
  | 'Wind'
  | 'Leaf'
  | 'ArrowDown'
  | 'PanelTop'
  | 'Satellite'
  | 'SunMedium'
  | 'Construction'
  | 'Sofa'
  | 'Magnet'
  | 'Truck'
  | 'FileCheck'

export type OwnerLaborService = {
  key: string
  label: string
  icon: OwnerLaborIcon
  unit: 'sq' | 'ft' | 'each' | 'hr'
  rate: number
  description: string
}

/** Owner-managed labor services. Rates are reference defaults until the owner saves a price book. */
export const OWNER_LABOR_SERVICES: OwnerLaborService[] = [
  // Original 15
  { key: 'roofing', label: 'Roofing', icon: 'House', unit: 'sq', rate: 65, description: 'Roofing installation per square' },
  { key: 'siding', label: 'Siding', icon: 'Fence', unit: 'sq', rate: 55, description: 'Siding installation per square' },
  { key: 'windows', label: 'Windows', icon: 'AppWindow', unit: 'each', rate: 75, description: 'Window installation per unit' },
  { key: 'doors', label: 'Doors', icon: 'DoorOpen', unit: 'each', rate: 85, description: 'Door installation per unit' },
  { key: 'gutters', label: 'Gutters', icon: 'CloudRain', unit: 'ft', rate: 45, description: 'Gutter installation per linear foot' },
  { key: 'decking', label: 'Decking', icon: 'Layers', unit: 'sq', rate: 60, description: 'Deck installation per square' },
  { key: 'drywall', label: 'Drywall', icon: 'SquareStack', unit: 'sq', rate: 40, description: 'Drywall installation per square' },
  { key: 'painting', label: 'Painting', icon: 'Paintbrush', unit: 'sq', rate: 35, description: 'Painting per square' },
  { key: 'electrical', label: 'Electrical', icon: 'Zap', unit: 'hr', rate: 95, description: 'Electrical work per hour' },
  { key: 'plumbing', label: 'Plumbing', icon: 'Droplets', unit: 'hr', rate: 90, description: 'Plumbing work per hour' },
  { key: 'hvac', label: 'HVAC', icon: 'Fan', unit: 'hr', rate: 100, description: 'HVAC work per hour' },
  { key: 'demo', label: 'Demolition', icon: 'Hammer', unit: 'hr', rate: 50, description: 'Demolition work per hour' },
  { key: 'cleanup', label: 'Cleanup', icon: 'Sparkles', unit: 'hr', rate: 35, description: 'Cleanup per hour' },
  { key: 'inspection', label: 'Inspection', icon: 'ScanSearch', unit: 'hr', rate: 75, description: 'Inspection per hour' },
  { key: 'consulting', label: 'Consulting', icon: 'Lightbulb', unit: 'hr', rate: 120, description: 'Consulting per hour' },
  { key: 'tearOff', label: 'Tear-off', icon: 'Trash2', unit: 'sq', rate: 55, description: 'Shingle and underlayment tear-off per square' },
  { key: 'steepCharge', label: 'Steep charge', icon: 'Mountain', unit: 'sq', rate: 25, description: 'Steep-slope labor adder per square' },
  { key: 'secondStory', label: 'Second story', icon: 'Building2', unit: 'sq', rate: 18, description: 'Two-story access adder per square' },
  { key: 'shingleRepair', label: 'Shingle repair', icon: 'Wrench', unit: 'sq', rate: 85, description: 'Localized shingle repair per square' },
  { key: 'metalRoof', label: 'Metal roof', icon: 'PanelsTopLeft', unit: 'sq', rate: 145, description: 'Standing-seam or panel install per square' },
  { key: 'flatRoof', label: 'Flat / low-slope', icon: 'LayoutGrid', unit: 'sq', rate: 95, description: 'Low-slope membrane labor per square' },
  { key: 'tileRoof', label: 'Tile roof', icon: 'BrickWall', unit: 'sq', rate: 160, description: 'Tile install or reset per square' },
  { key: 'slateRepair', label: 'Slate repair', icon: 'Grid3x3', unit: 'hr', rate: 125, description: 'Slate repair labor per hour' },
  { key: 'tarpEmergency', label: 'Emergency tarp', icon: 'Shield', unit: 'each', rate: 350, description: 'Emergency dry-in / tarp per deployment' },
  { key: 'deckingReplace', label: 'Decking replace', icon: 'Ruler', unit: 'sq', rate: 75, description: 'Roof decking replacement per square' },
  { key: 'chimneyFlashing', label: 'Chimney flashing', icon: 'Warehouse', unit: 'each', rate: 450, description: 'Chimney flashing rebuild per chimney' },
  { key: 'stepFlashing', label: 'Step flashing', icon: 'Spline', unit: 'ft', rate: 12, description: 'Step flashing labor per linear foot' },
  { key: 'valleyMetal', label: 'Valley metal', icon: 'Waves', unit: 'ft', rate: 14, description: 'Open valley metal labor per foot' },
  { key: 'pipeBoot', label: 'Pipe boot', icon: 'CircleDot', unit: 'each', rate: 45, description: 'Pipe boot replace per penetration' },
  { key: 'skylight', label: 'Skylight', icon: 'Sun', unit: 'each', rate: 275, description: 'Skylight set and flash per unit' },
  { key: 'dripEdge', label: 'Drip edge', icon: 'AlignStartHorizontal', unit: 'ft', rate: 3.5, description: 'Drip edge install per linear foot' },
  { key: 'iceWater', label: 'Ice & water', icon: 'Snowflake', unit: 'ft', rate: 4.5, description: 'Ice-and-water shield labor per foot' },
  { key: 'starterStrip', label: 'Starter strip', icon: 'Play', unit: 'ft', rate: 2.5, description: 'Starter course labor per foot' },
  { key: 'hipRidge', label: 'Hip & ridge', icon: 'Triangle', unit: 'ft', rate: 6, description: 'Hip and ridge cap labor per foot' },
  { key: 'ridgeVent', label: 'Ridge vent', icon: 'Wind', unit: 'ft', rate: 8, description: 'Ridge vent cut and install per foot' },
  { key: 'gutterGuard', label: 'Gutter guards', icon: 'Leaf', unit: 'ft', rate: 8, description: 'Gutter guard install per foot' },
  { key: 'downspout', label: 'Downspouts', icon: 'ArrowDown', unit: 'ft', rate: 6, description: 'Downspout install per foot' },
  { key: 'fasciaSoffit', label: 'Fascia & soffit', icon: 'PanelTop', unit: 'ft', rate: 9, description: 'Fascia or soffit labor per foot' },
  { key: 'satelliteDetach', label: 'Satellite detach', icon: 'Satellite', unit: 'each', rate: 75, description: 'Detach and reset dish per unit' },
  { key: 'solarDetach', label: 'Solar detach', icon: 'SunMedium', unit: 'each', rate: 250, description: 'Detach and reset solar array coordination per array' },
  { key: 'craneLift', label: 'Crane / lift', icon: 'Construction', unit: 'hr', rate: 185, description: 'Crane or lift time per hour' },
  { key: 'interiorProtect', label: 'Interior protect', icon: 'Sofa', unit: 'hr', rate: 45, description: 'Interior protection and plastic per hour' },
  { key: 'magnetSweep', label: 'Magnet sweep', icon: 'Magnet', unit: 'hr', rate: 40, description: 'Nail magnet sweep per hour' },
  { key: 'dumpHaul', label: 'Dump / haul', icon: 'Truck', unit: 'each', rate: 450, description: 'Debris haul or dumpster turn per load' },
  { key: 'permitPull', label: 'Permit pull', icon: 'FileCheck', unit: 'each', rate: 150, description: 'Permit application labor per permit' },
]

export const OWNER_LABOR_BY_KEY: Record<string, OwnerLaborService> = Object.fromEntries(
  OWNER_LABOR_SERVICES.map((service) => [service.key, service]),
)

export const DEFAULT_OWNER_LABOR_RATES: Record<string, number> = Object.fromEntries(
  OWNER_LABOR_SERVICES.map((service) => [service.key, service.rate]),
)

export function ownerLaborUnitCode(unit: OwnerLaborService['unit']) {
  if (unit === 'ft') return 'LF'
  if (unit === 'sq') return 'SQ'
  if (unit === 'each') return 'EA'
  return 'HR'
}
