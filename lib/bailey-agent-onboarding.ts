// Business onboarding preferences, NOT an executable agent registry or an authorization policy.
// All agents remain inactive unless a separate, reviewed runtime implementation enables them.
export const BAILEY_AGENT_SETUP_VERSION = 1 as const

export const BAILEY_AGENT_CATALOG = [
  { key: 'orchestrator', label: 'MAKO / JARVIS Orchestrator', description: 'Coordinates requests and delegates work.' },
  { key: 'chief_of_staff', label: 'Chief of Staff', description: 'Prepares briefings and organizes priorities.' },
  { key: 'personal_calling', label: 'Personal Calling Agent', description: 'Plans owner-authorized personal calls.' },
  { key: 'business_receptionist', label: 'Business Receptionist', description: 'Handles proposed inbound caller workflows.' },
  { key: 'outbound_sales', label: 'Outbound Sales & Follow-up', description: 'Prepares consent-checked outreach and follow-ups.' },
  { key: 'scheduling', label: 'Scheduling Coordinator', description: 'Coordinates appointment proposals.' },
  { key: 'customer_care', label: 'Customer Care & Warranty', description: 'Drafts service and warranty follow-ups.' },
  { key: 'roofing_estimator', label: 'Roofing Estimator & Supplements', description: 'Assists with reviewed roofing estimates and supplements.' },
  { key: 'production_foreman', label: 'Production Foreman', description: 'Prepares job plans and production reviews.' },
  { key: 'purchasing', label: 'Purchasing & Supplier Agent', description: 'Drafts material requests and purchase comparisons.' },
  { key: 'finance', label: 'Finance & Collections', description: 'Prepares reviewed invoice and collections work.' },
  { key: 'research', label: 'Research & Intelligence', description: 'Researches sources with provenance.' },
  { key: 'documents', label: 'Documents & Communications', description: 'Drafts documents and outbound messages.' },
  { key: 'development', label: 'Development & Deployment', description: 'Proposes code, tests and deployment changes.' },
  { key: 'quality_security', label: 'Quality, Security & Reliability', description: 'Reviews evidence, permissions and reliability.' },
] as const

export type BaileyAgentKey = (typeof BAILEY_AGENT_CATALOG)[number]['key']
export type BaileyAgentPreference = 'off' | 'review_only' | 'approval_required'
export type BaileyAgentSetup = Record<BaileyAgentKey, BaileyAgentPreference>
export type BaileyAgentSetupStatus = 'draft' | 'reviewed'

const KEYS = new Set<string>(BAILEY_AGENT_CATALOG.map((item) => item.key))
const PREFERENCES = new Set<string>(['off', 'review_only', 'approval_required'])

export function defaultBaileyAgentSetup(): BaileyAgentSetup {
  return Object.fromEntries(BAILEY_AGENT_CATALOG.map(({ key }) => [key, 'off'])) as BaileyAgentSetup
}

export function validateBaileyAgentSetup(input: unknown): { setup?: BaileyAgentSetup; error?: string } {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { error: 'Agent setup must be an object.' }
  }
  const source = input as Record<string, unknown>
  if (Object.keys(source).length !== BAILEY_AGENT_CATALOG.length ||
      Object.keys(source).some((key) => !KEYS.has(key))) {
    return { error: 'Agent setup must contain exactly the 15 supported agent keys.' }
  }
  for (const { key } of BAILEY_AGENT_CATALOG) {
    if (!PREFERENCES.has(source[key] as string)) {
      return { error: `Invalid onboarding preference for ${key}.` }
    }
  }
  return { setup: Object.fromEntries(BAILEY_AGENT_CATALOG.map(({ key }) => [key, source[key]])) as BaileyAgentSetup }
}
