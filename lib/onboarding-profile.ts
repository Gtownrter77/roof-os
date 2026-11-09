export const ONBOARDING_PROFILE_VERSION = 1 as const

export type OnboardingProfile = {
  companyType?: 'residential' | 'commercial' | 'both' | 'unsure'
  serviceZipCodes?: string[]
  roofingSystems?: string[]
  relatedServices?: string[]
  crewCountBand?: 'solo' | '2-5' | '6-10' | '11-25' | '26+' | 'unsure'
  leadSources?: string[]
  inspectionStyle?: 'manual' | 'photo_first' | 'drone_assisted' | 'mixed' | 'unsure'
  estimateWorkflow?: 'owner_priced' | 'estimator_priced' | 'external' | 'unsure'
  productionWorkflow?: 'in_house' | 'subcontracted' | 'mixed' | 'unsure'
  customerContactPreferences?: Array<'phone' | 'email' | 'text' | 'unsure'>
  primaryGoal?: string
}

export type OnboardingProfileStatus = 'draft' | 'completed'

const enumValues = {
  companyType: ['residential', 'commercial', 'both', 'unsure'],
  crewCountBand: ['solo', '2-5', '6-10', '11-25', '26+', 'unsure'],
  inspectionStyle: ['manual', 'photo_first', 'drone_assisted', 'mixed', 'unsure'],
  estimateWorkflow: ['owner_priced', 'estimator_priced', 'external', 'unsure'],
  productionWorkflow: ['in_house', 'subcontracted', 'mixed', 'unsure'],
  customerContactPreferences: ['phone', 'email', 'text', 'unsure'],
} as const

const listLimits = {
  serviceZipCodes: 20,
  roofingSystems: 12,
  relatedServices: 12,
  leadSources: 12,
} as const

const stringLimits = {
  roofingSystems: 80,
  relatedServices: 80,
  leadSources: 60,
} as const

export function validateOnboardingProfile(input: unknown): { profile?: OnboardingProfile; error?: string } {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { error: 'Profile must be an object.' }
  const source = input as Record<string, unknown>
  const allowed = new Set([
    'companyType', 'serviceZipCodes', 'roofingSystems', 'relatedServices',
    'crewCountBand', 'leadSources', 'inspectionStyle', 'estimateWorkflow',
    'productionWorkflow', 'customerContactPreferences', 'primaryGoal',
  ])
  if (Object.keys(source).some((key) => !allowed.has(key))) return { error: 'Profile contains an unsupported field.' }

  const profile: OnboardingProfile = {}
  for (const [key, values] of Object.entries(enumValues)) {
    if (!(key in source)) continue
    const value = source[key]
    if (key === 'customerContactPreferences') {
      if (!Array.isArray(value) || value.length > 4 || value.some((item) => typeof item !== 'string' || !values.includes(item as never))) {
        return { error: 'Customer contact preferences are invalid.' }
      }
      profile.customerContactPreferences = [...new Set(value as Array<'phone' | 'email' | 'text' | 'unsure'>)]
    } else if (typeof value !== 'string' || !values.includes(value as never)) {
      return { error: `${key} is invalid.` }
    } else {
      Object.assign(profile, { [key]: value })
    }
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
    } else {
      const maxLength = stringLimits[key as keyof typeof stringLimits]
      if (normalized.some((item) => item.length > maxLength)) return { error: `${key} entries must be ${maxLength} characters or fewer.` }
      Object.assign(profile, { [key]: normalized })
    }
  }

  if ('primaryGoal' in source) {
    if (typeof source.primaryGoal !== 'string' || source.primaryGoal.trim().length > 240) {
      return { error: 'Primary goal must be 240 characters or fewer.' }
    }
    profile.primaryGoal = source.primaryGoal.trim()
  }

  return { profile }
}
