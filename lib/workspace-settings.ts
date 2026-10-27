import type { SupabaseClient } from '@supabase/supabase-js'

export const WORKSPACE_FEATURE_FLAGS = {
  enable_ai_receptionist: true,
  enable_inspection_quality_agent: true,
  enable_voice_copilot_whisper: true,
  enable_auto_followup_tasks: true,
  enable_margin_guard_35: true,
  enable_retailer_surge_alerts: true,
  enable_dual_retailer_watchlist: true,
  enable_canvassing_lead_auto_convert: true,
  enable_vcard_digital_business_card: true,
  enable_offline_sqlite_queue: true,
  require_mfa_privileged_users: true,
  require_strict_e164_phone_format: true,
  enforce_tcpa_quiet_hours_outbound: true,
  enforce_stripe_24hr_link_expiration: true,
  require_photo_completeness_report_gate: true,
  require_technician_signature_signoff: true,
  enable_2021_irc_statutory_code_suggestions: true,
} as const

export type WorkspaceFeatureFlag = keyof typeof WORKSPACE_FEATURE_FLAGS

export const WORKSPACE_FEATURE_FLAG_KEYS = Object.keys(WORKSPACE_FEATURE_FLAGS) as WorkspaceFeatureFlag[]

export type PriceRefreshFrequency = 'weekly' | 'manual' | 'disabled'
export type MaterialSearchMode = 'catalog_only' | 'catalog_and_retailer'

export type WorkspaceSettings = {
  price_refresh_frequency: PriceRefreshFrequency
  default_language: string
  default_zipcode: string | null
  preferred_brands: Record<string, string>
  material_search_mode: MaterialSearchMode
} & Record<WorkspaceFeatureFlag, boolean>

export type FeatureFlagEnforcement = {
  enforced: boolean
  surfaces: string[]
  note: string
}

export const FEATURE_FLAG_ENFORCEMENT: Record<WorkspaceFeatureFlag, FeatureFlagEnforcement> = {
  enable_ai_receptionist: {
    enforced: true,
    surfaces: [
      'app/api/receptionist/twilio/voice/route.ts',
      'app/api/receptionist/twilio/outbound/route.ts',
      'app/api/receptionist/twilio/sms/route.ts',
      'app/api/cron/receptionist-followups/route.ts',
    ],
    note: 'Turns the inbound and outbound AI receptionist off for this workspace.',
  },
  enable_inspection_quality_agent: {
    enforced: true,
    surfaces: ['app/api/cron/inspection-quality/route.ts'],
    note: 'Skips the web inspection quality agent for this workspace. The mobile on-device inference runtime is not implemented yet, so this switch does not affect it.',
  },
  enable_voice_copilot_whisper: {
    enforced: true,
    surfaces: ['app/api/ai/transcribe/route.ts'],
    note: 'Blocks local Whisper transcription for this workspace.',
  },
  enable_auto_followup_tasks: {
    enforced: true,
    surfaces: ['supabase/migrations/057_workspace_feature_flags.sql'],
    note: 'Stops the automatic lead follow-up task from being created.',
  },
  enable_margin_guard_35: {
    enforced: false,
    surfaces: [],
    note: 'Saved only. Estimate drafts are unpriced, so the server cannot compute gross margin yet.',
  },
  enable_retailer_surge_alerts: {
    enforced: false,
    surfaces: [],
    note: 'Saved only. The retailer price delta worker that would raise the alert does not exist yet.',
  },
  enable_dual_retailer_watchlist: {
    enforced: true,
    surfaces: ['app/api/cron/retailer-prices/route.ts', 'app/api/pricing/lowes/route.ts'],
    note: 'Skips Lowe\u2019s on the retailer watchlist and blocks the Lowe\u2019s lookup route.',
  },
  enable_canvassing_lead_auto_convert: {
    enforced: true,
    surfaces: ['app/canvass/page.tsx'],
    note: 'Blocks one-click canvass lead conversion in the field canvass screen.',
  },
  enable_vcard_digital_business_card: {
    enforced: true,
    surfaces: ['app/canvass/page.tsx'],
    note: 'Hides the vCard share button. The card itself stays a placeholder until company details are configured.',
  },
  enable_offline_sqlite_queue: {
    enforced: false,
    surfaces: [],
    note: 'Saved only. The field app writes its local SQLite queue unconditionally and does not read workspace settings yet.',
  },
  require_mfa_privileged_users: {
    enforced: false,
    surfaces: [],
    note: 'Saved only. Owner and admin MFA is deliberately not forced at sign-in: that gate locked the owner out of the app. Enroll a factor from the MFA screen instead.',
  },
  require_strict_e164_phone_format: {
    enforced: true,
    surfaces: [
      'app/api/receptionist/twilio/outbound/route.ts',
      'app/api/receptionist/twilio/sms/route.ts',
      'app/api/cron/receptionist-followups/route.ts',
    ],
    note: 'Normalizes outbound numbers to +1NXXNXXXXXX and rejects anything else.',
  },
  enforce_tcpa_quiet_hours_outbound: {
    enforced: true,
    surfaces: [
      'app/api/receptionist/twilio/outbound/route.ts',
      'app/api/receptionist/twilio/sms/route.ts',
      'app/api/cron/receptionist-followups/route.ts',
    ],
    note: 'Blocks automated calls and texts outside 8:00 AM to 8:00 PM.',
  },
  enforce_stripe_24hr_link_expiration: {
    enforced: true,
    surfaces: ['app/api/receptionist/stripe/payment-link/route.ts'],
    note: 'Sets the 24-hour expiry on generated invoice checkout links. Stripe caps Checkout sessions at 24 hours.',
  },
  require_photo_completeness_report_gate: {
    enforced: true,
    surfaces: ['app/api/photo-estimate/report/route.ts'],
    note: 'Blocks report generation until every source photo is reviewed usable with complete coverage.',
  },
  require_technician_signature_signoff: {
    enforced: true,
    surfaces: ['app/api/photo-estimate/report/route.ts'],
    note: 'Blocks report generation until the technician signature is captured.',
  },
  enable_2021_irc_statutory_code_suggestions: {
    enforced: true,
    surfaces: ['app/api/building-codes/route.ts'],
    note: 'Adds the drip edge and ice barrier statutory notes to the building code lookup.',
  },
}

export function defaultWorkspaceSettings(): WorkspaceSettings {
  return {
    price_refresh_frequency: 'weekly',
    default_language: 'en-US',
    default_zipcode: null,
    preferred_brands: {},
    material_search_mode: 'catalog_and_retailer',
    ...WORKSPACE_FEATURE_FLAGS,
  }
}

function coerceFlag(value: unknown, fallback: boolean) {
  return typeof value === 'boolean' ? value : fallback
}

export function readWorkspaceSettings(row: unknown): WorkspaceSettings {
  const defaults = defaultWorkspaceSettings()
  if (!row || typeof row !== 'object') return defaults
  const record = row as Record<string, unknown>
  const preferredBrands = record.preferred_brands && typeof record.preferred_brands === 'object' && !Array.isArray(record.preferred_brands)
    ? Object.fromEntries(Object.entries(record.preferred_brands as Record<string, unknown>).filter((entry): entry is [string, string] => typeof entry[1] === 'string'))
    : defaults.preferred_brands
  const frequency = record.price_refresh_frequency
  const mode = record.material_search_mode
  const zipcode = record.default_zipcode
  return {
    price_refresh_frequency: frequency === 'manual' || frequency === 'disabled' || frequency === 'weekly' ? frequency : defaults.price_refresh_frequency,
    default_language: typeof record.default_language === 'string' && record.default_language ? record.default_language : defaults.default_language,
    default_zipcode: typeof zipcode === 'string' && zipcode ? zipcode : null,
    preferred_brands: preferredBrands,
    material_search_mode: mode === 'catalog_only' || mode === 'catalog_and_retailer' ? mode : defaults.material_search_mode,
    ...Object.fromEntries(WORKSPACE_FEATURE_FLAG_KEYS.map((key) => [key, coerceFlag(record[key], WORKSPACE_FEATURE_FLAGS[key])])) as Record<WorkspaceFeatureFlag, boolean>,
  }
}

export async function loadWorkspaceSettings(supabase: SupabaseClient, workspaceId: string): Promise<WorkspaceSettings> {
  const { data, error } = await supabase.from('workspace_settings').select('*').eq('workspace_id', workspaceId).maybeSingle()
  if (error) return defaultWorkspaceSettings()
  return readWorkspaceSettings(data)
}

export function isFeatureEnabled(settings: WorkspaceSettings, flag: WorkspaceFeatureFlag) {
  return settings[flag] === true
}
