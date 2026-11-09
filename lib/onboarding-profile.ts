export const ONBOARDING_PROFILE_VERSION = 2 as const

export type OnboardingProfile = {
  companyType?: 'residential' | 'commercial' | 'both' | 'unsure'
  yearsInBusinessBand?: '0-1' | '2-5' | '6-10' | '11-20' | '20+' | 'unsure'
  serviceZipCodes?: string[]
  roofingSystems?: string[]
  relatedServices?: string[]
  crewCountBand?: 'solo' | '2-5' | '6-10' | '11-25' | '26+' | 'unsure'
  teamRoles?: Array<'owner' | 'manager' | 'sales' | 'estimator' | 'project_manager' | 'inspector' | 'foreman' | 'installer' | 'office' | 'other'>
  leadSources?: string[]
  inspectionStyle?: 'manual' | 'photo_first' | 'drone_assisted' | 'mixed' | 'unsure'
  photoEvidenceWorkflow?: 'phone_photos' | 'drone_photos' | 'mixed' | 'unsure'
  estimateWorkflow?: 'owner_priced' | 'estimator_priced' | 'external' | 'unsure'
  approvalWorkflow?: 'owner_approval' | 'manager_approval' | 'external' | 'unsure'
  productionWorkflow?: 'in_house' | 'subcontracted' | 'mixed' | 'unsure'
  schedulingWorkflow?: 'calendar' | 'spreadsheet' | 'software' | 'manual' | 'unsure'
  materialWorkflow?: 'owner_ordered' | 'crew_pickup' | 'supplier_delivery' | 'mixed' | 'unsure'
  permitWorkflow?: 'in_house' | 'subcontracted' | 'not_applicable' | 'unsure'
  qualityControlWorkflow?: 'checklist' | 'manager_walkthrough' | 'photo_review' | 'mixed' | 'unsure'
  closeoutWorkflow?: 'owner_review' | 'office_review' | 'mixed' | 'unsure'
  warrantyWorkflow?: 'manufacturer' | 'company' | 'both' | 'unsure'
  customerContactPreferences?: Array<'phone' | 'email' | 'text' | 'unsure'>
  businessHours?: string
  primaryGoal?: string
}

export type OnboardingProfileStatus = 'draft' | 'completed'

const enumValues = {
  companyType: ['residential', 'commercial', 'both', 'unsure'],
  yearsInBusinessBand: ['0-1', '2-5', '6-10', '11-20', '20+', 'unsure'],
  crewCountBand: ['solo', '2-5', '6-10', '11-25', '26+', 'unsure'],
  inspectionStyle: ['manual', 'photo_first', 'drone_assisted', 'mixed', 'unsure'],
  photoEvidenceWorkflow: ['phone_photos', 'drone_photos', 'mixed', 'unsure'],
  estimateWorkflow: ['owner_priced', 'estimator_priced', 'external', 'unsure'],
  approvalWorkflow: ['owner_approval', 'manager_approval', 'external', 'unsure'],
  productionWorkflow: ['in_house', 'subcontracted', 'mixed', 'unsure'],
  schedulingWorkflow: ['calendar', 'spreadsheet', 'software', 'manual', 'unsure'],
  materialWorkflow: ['owner_ordered', 'crew_pickup', 'supplier_delivery', 'mixed', 'unsure'],
  permitWorkflow: ['in_house', 'subcontracted', 'not_applicable', 'unsure'],
  qualityControlWorkflow: ['checklist', 'manager_walkthrough', 'photo_review', 'mixed', 'unsure'],
  closeoutWorkflow: ['owner_review', 'office_review', 'mixed', 'unsure'],
  warrantyWorkflow: ['manufacturer', 'company', 'both', 'unsure'],
} as const

const listLimits = {
  serviceZipCodes: 20,
  roofingSystems: 12,
  relatedServices: 12,
  leadSources: 12,
  teamRoles: 10,
} as const

const stringLimits = {
  roofingSystems: 80,
  relatedServices: 80,
  leadSources: 60,
  businessHours: 80,
} as const

const arrayAllowedValues = {
  teamRoles: ['owner', 'manager', 'sales', 'estimator', 'project_manager', 'inspector', 'foreman', 'installer', 'office', 'other'],
  customerContactPreferences: ['phone', 'email', 'text', 'unsure'],
} as const

export function validateOnboardingProfile(input: unknown): { profile?: OnboardingProfile; error?: string } {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { error: 'Profile must be an object.' }
  const source = input as Record<string, unknown>
  const allowed = new Set([
    'companyType', 'yearsInBusinessBand', 'serviceZipCodes', 'roofingSystems', 'relatedServices',
    'crewCountBand', 'teamRoles', 'leadSources', 'inspectionStyle', 'photoEvidenceWorkflow',
    'estimateWorkflow', 'approvalWorkflow', 'productionWorkflow', 'schedulingWorkflow',
    'materialWorkflow', 'permitWorkflow', 'qualityControlWorkflow', 'closeoutWorkflow',
    'warrantyWorkflow', 'customerContactPreferences', 'businessHours', 'primaryGoal',
  ])
  if (Object.keys(source).some((key) => !allowed.has(key))) return { error: 'Profile contains an unsupported field.' }

  const profile: OnboardingProfile = {}
  for (const [key, values] of Object.entries(enumValues)) {
    if (!(key in source)) continue
    const value = source[key]
    if (typeof value !== 'string' || !values.includes(value as never)) {
      return { error: `${key} is invalid.` }
    }
    Object.assign(profile, { [key]: value })
  }

  for (const [key, maxItems] of Object.entries(listLimits)) {
    if (!(key in source)) continue
    const value = source[key]
    if (!Array.isArray(value) || value.length > maxItems || value.some((item) => typeof item !== 'string')) {
      return { error: `${key} must be a list with at most ${maxItems} entries.` }
    }
    const normalized = [...new Set((value as string[]).map((item) => item.trim()).filter(Boolean))]
    if (key === 'serviceZipCodes') {
      // V1 serves US roofing businesses; international postal formats are intentionally out of scope.
      if (normalized.some((item) => !/^\d{5}$/.test(item))) return { error: 'Service ZIP codes must contain five digits.' }
      profile.serviceZipCodes = normalized
    } else if (key === 'teamRoles') {
      const allowedRoles = arrayAllowedValues.teamRoles as readonly string[]
      if (normalized.some((item) => !allowedRoles.includes(item))) return { error: 'Team roles contain an unsupported value.' }
      profile.teamRoles = normalized as NonNullable<OnboardingProfile['teamRoles']>
    } else {
      const maxLength = stringLimits[key as keyof typeof stringLimits]
      if (normalized.some((item) => item.length > maxLength)) return { error: `${key} entries must be ${maxLength} characters or fewer.` }
      Object.assign(profile, { [key]: normalized })
    }
  }

  if ('customerContactPreferences' in source) {
    const value = source.customerContactPreferences
    const allowedPreferences = arrayAllowedValues.customerContactPreferences as readonly string[]
    if (!Array.isArray(value) || value.length > 4 || value.some((item) => typeof item !== 'string' || !allowedPreferences.includes(item))) {
      return { error: 'Customer contact preferences are invalid.' }
    }
    profile.customerContactPreferences = [...new Set(value as Array<'phone' | 'email' | 'text' | 'unsure'>)]
  }

  if ('businessHours' in source) {
    if (typeof source.businessHours !== 'string' || source.businessHours.trim().length > 80) {
      return { error: 'Business hours must be 80 characters or fewer.' }
    }
    profile.businessHours = source.businessHours.trim()
  }

  if ('primaryGoal' in source) {
    if (typeof source.primaryGoal !== 'string' || source.primaryGoal.trim().length > 240) {
      return { error: 'Primary goal must be 240 characters or fewer.' }
    }
    profile.primaryGoal = source.primaryGoal.trim()
  }

  return { profile }
}
