// Browser-only workflow convenience preferences. Never grants execution authority.
// No property addresses, customer details, images, measurements or supplement drafts are stored here.
export type RoofingWorkflowPreferences = {
  autoAddressLookup: boolean
  selectSingleFootprint: boolean
  showReviewChecklist: boolean
}
export const ROOFING_WORKFLOW_PREFS_KEY = 'roofos.roofing-workflow-preferences.v1'
export const DEFAULT_ROOFING_WORKFLOW_PREFS: RoofingWorkflowPreferences = Object.freeze({
  autoAddressLookup: false,
  selectSingleFootprint: false,
  showReviewChecklist: true,
})
const KEYS = Object.keys(DEFAULT_ROOFING_WORKFLOW_PREFS) as (keyof RoofingWorkflowPreferences)[]
export function validateRoofingWorkflowPreferences(input: unknown): RoofingWorkflowPreferences {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { ...DEFAULT_ROOFING_WORKFLOW_PREFS }
  const obj = input as Record<string, unknown>
  return Object.fromEntries(KEYS.map((key) => [
    key, typeof obj[key] === 'boolean' ? obj[key] : DEFAULT_ROOFING_WORKFLOW_PREFS[key],
  ])) as RoofingWorkflowPreferences
}
export function loadRoofingWorkflowPreferences(): RoofingWorkflowPreferences {
  if (typeof window === 'undefined') return { ...DEFAULT_ROOFING_WORKFLOW_PREFS }
  try { return validateRoofingWorkflowPreferences(JSON.parse(window.localStorage.getItem(ROOFING_WORKFLOW_PREFS_KEY) || 'null')) }
  catch { return { ...DEFAULT_ROOFING_WORKFLOW_PREFS } }
}
export function saveRoofingWorkflowPreferences(preferences: RoofingWorkflowPreferences) {
  if (typeof window === 'undefined') return
  const valid = validateRoofingWorkflowPreferences(preferences)
  window.localStorage.setItem(ROOFING_WORKFLOW_PREFS_KEY, JSON.stringify(valid))
  window.dispatchEvent(new Event('roofos-roofing-preferences-changed'))
}
export function canAutoLookupAddress(address: string, preferences: RoofingWorkflowPreferences) {
  return preferences.autoAddressLookup && address.trim().length >= 8 && address.trim().length <= 240
}
