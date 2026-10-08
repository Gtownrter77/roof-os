'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

type Settings = {
  price_refresh_frequency: string
  default_language: string
  default_zipcode: string
  preferred_brands: Record<string, string>
  material_search_mode: string
  // AI & Automation Toggles
  enable_ai_receptionist: boolean
  enable_inspection_quality_agent: boolean
  enable_voice_copilot_whisper: boolean
  enable_auto_followup_tasks: boolean
  // Pricing & Margin Controls
  enable_margin_guard_35: boolean
  enable_retailer_surge_alerts: boolean
  enable_dual_retailer_watchlist: boolean
  // Field Canvassing & Mobile Settings
  enable_canvassing_lead_auto_convert: boolean
  enable_vcard_digital_business_card: boolean
  enable_offline_sqlite_queue: boolean
  // Security & Compliance Gates
  require_mfa_privileged_users: boolean
  require_strict_e164_phone_format: boolean
  enforce_tcpa_quiet_hours_outbound: boolean
  enforce_stripe_24hr_link_expiration: boolean
  // Golden Report & Evidence Rules
  require_photo_completeness_report_gate: boolean
  require_technician_signature_signoff: boolean
  enable_2021_irc_statutory_code_suggestions: boolean
  // Weather & Storm Tracker Settings
  enable_noaa_swath_overlays: boolean
  enable_hail_threshold_alerts: boolean
  enable_wind_speed_alerts: boolean
  // Aerial & Drone Inspection Settings
  enable_rafter_slope_multipliers: boolean
  enable_exif_telemetry_checks: boolean
  enable_autofacet_confidence_thresholds: boolean
  // Invoicing & Financial Ledger Settings
  enable_three_stage_progress_billing: boolean
  enable_deposit_shortfall_alerts: boolean
  enable_automatic_tax_application: boolean
  // Roof Passport & Warranty Portal Settings
  enable_public_verification_links: boolean
  enable_transfer_certificate_generator: boolean
  enable_annual_maintenance_dispatch: boolean
  // Team, Roles & Permission Settings
  enable_admin_estimate_approval_gate: boolean
  restrict_financials_to_admins: boolean
  enable_round_robin_lead_assignment: boolean
  // Notification & Alert Channels
  enable_inapp_sound_cues: boolean
  enable_critical_exception_sms_dispatch: boolean
}

type TaxRates = { state: number; county: number; city: number; specialDistrict: number }

const initialSettings: Settings = {
  price_refresh_frequency: 'weekly',
  default_language: 'en-US',
  default_zipcode: '30123',
  preferred_brands: { shingles: 'GAF' },
  material_search_mode: 'catalog_and_retailer',
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
  enable_noaa_swath_overlays: true,
  enable_hail_threshold_alerts: true,
  enable_wind_speed_alerts: true,
  enable_rafter_slope_multipliers: true,
  enable_exif_telemetry_checks: true,
  enable_autofacet_confidence_thresholds: true,
  enable_three_stage_progress_billing: true,
  enable_deposit_shortfall_alerts: true,
  enable_automatic_tax_application: true,
  enable_public_verification_links: true,
  enable_transfer_certificate_generator: true,
  enable_annual_maintenance_dispatch: true,
  enable_admin_estimate_approval_gate: true,
  restrict_financials_to_admins: true,
  enable_round_robin_lead_assignment: true,
  enable_inapp_sound_cues: true,
  enable_critical_exception_sms_dispatch: true,
}

const initialTax: TaxRates = { state: 0, county: 0, city: 0, specialDistrict: 0 }

export default function SettingsPage() {
  const router = useRouter()
  const [settings, setSettings] = useState<Settings>(initialSettings)
  const [taxRates, setTaxRates] = useState<TaxRates>(initialTax)
  const [taxSource, setTaxSource] = useState('')
  const [loaded, setLoaded] = useState(false)
  const [message, setMessage] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    Promise.all([fetch('/api/settings'), fetch('/api/pricing/labor-rates')]).then(async ([settingsResponse, pricingResponse]) => {
      const settingsPayload = await settingsResponse.json()
      const pricingPayload = await pricingResponse.json()
      if (settingsResponse.ok && settingsPayload.settings) {
        setSettings({ ...initialSettings, ...settingsPayload.settings, preferred_brands: { ...initialSettings.preferred_brands, ...(settingsPayload.settings.preferred_brands ?? {}) } })
      }
      if (pricingResponse.ok) {
        setTaxRates({ ...initialTax, ...(pricingPayload.taxRates ?? {}) })
        setTaxSource(pricingPayload.taxSource ?? '')
      }
      setLoaded(true)
    }).catch(() => {
      setLoaded(true)
      setMessage('Could not load saved settings.')
    })
  }, [])

  const toggleSetting = (key: keyof Settings) => {
    setSettings(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const updateTax = (key: keyof TaxRates, value: string) => setTaxRates(prev => ({ ...prev, [key]: Number(value) || 0 }))
  const totalTax = Object.values(taxRates).reduce((sum, rate) => sum + rate, 0)

  const save = async () => {
    if (saving) return
    setSaving(true)
    setMessage('Saving master workspace settings & granular feature toggles…')
    try {
      const settingsResponse = await fetch('/api/settings', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(settings) })
      const settingsPayload = await settingsResponse.json().catch(() => ({}))
      if (!settingsResponse.ok) {
        setMessage(settingsPayload.error ?? 'Could not save workspace settings.')
        return
      }

      const pricingResponse = await fetch('/api/pricing/labor-rates', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ rates: {}, market: settings.default_zipcode || 'owner-defined market', taxRates, taxSource }) })
      const pricingPayload = await pricingResponse.json().catch(() => ({}))
      if (!pricingResponse.ok) {
        setMessage(`Workspace settings saved, but pricing could not be saved: ${pricingPayload.error ?? 'unknown error'}`)
        return
      }

      setMessage(`Saved. Combined tax rate is ${totalTax.toFixed(4)}%. All 30+ operational feature toggles saved across active workspace.`)
    } catch {
      setMessage('Could not save settings because the network request failed.')
    } finally {
      setSaving(false)
    }
  }

  const refreshPrices = async () => {
    if (refreshing) return
    setRefreshing(true)
    setMessage('Refreshing the active Home Depot and Lowe’s watchlist…')
    try {
      const response = await fetch('/api/pricing/refresh', { method: 'POST' })
      const payload = await response.json().catch(() => ({}))
      setMessage(response.ok
        ? `Manual refresh complete: ${payload.count ?? 0} watchlist item(s) processed.`
        : (payload.error ?? 'Manual refresh failed.'))
    } catch {
      setMessage('Manual refresh failed because the network request could not be completed.')
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-gradient-to-r from-blue-700 to-indigo-700 text-white shadow-lg sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center">
            <button onClick={() => router.back()} className="mr-3 text-xl">←</button>
            <h1 className="text-xl font-bold">⚙️ Master Workspace Settings & Granular Toggles</h1>
          </div>
          <span className="bg-emerald-400 text-black text-xs font-bold px-2.5 py-0.5 rounded uppercase">
            30+ TOGGLES ACTIVE
          </span>
        </div>
      </header>

      <main className="p-4 max-w-2xl mx-auto space-y-4">
        {/* AI & Automation Toggles */}
        <section className="bg-white rounded-lg shadow p-4 border-l-4 border-indigo-600 space-y-3">
          <h2 className="font-bold text-sm text-gray-900 flex items-center">
            <span className="text-lg mr-1.5">🤖</span> AI & Automation Engine Controls
          </h2>
          <div className="space-y-2 text-xs">
            <ToggleRow
              label="AI Virtual Receptionist (Twilio Inbound/Outbound)"
              desc="OpenWhisper STT & Ollama local inference dialogue engine"
              checked={settings.enable_ai_receptionist}
              onToggle={() => toggleSetting('enable_ai_receptionist')}
            />
            <ToggleRow
              label="Inspection Quality Agent (Agent 3)"
              desc="Automated photo completeness checks & review task generation"
              checked={settings.enable_inspection_quality_agent}
              onToggle={() => toggleSetting('enable_inspection_quality_agent')}
            />
            <ToggleRow
              label="Voice Command Copilot (OpenWhisper STT)"
              desc="Hands-free dictation & voice intent navigation router"
              checked={settings.enable_voice_copilot_whisper}
              onToggle={() => toggleSetting('enable_voice_copilot_whisper')}
            />
            <ToggleRow
              label="Auto Follow-up Task Creation"
              desc="Automatically schedule follow-up tasks on lead state changes"
              checked={settings.enable_auto_followup_tasks}
              onToggle={() => toggleSetting('enable_auto_followup_tasks')}
            />
          </div>
        </section>

        {/* Pricing & Margin Controls */}
        <section className="bg-white rounded-lg shadow p-4 border-l-4 border-emerald-600 space-y-3">
          <h2 className="font-bold text-sm text-gray-900 flex items-center">
            <span className="text-lg mr-1.5">💰</span> Pricing, Retailers & Owner Margin Guard
          </h2>
          <div className="space-y-2 text-xs">
            <ToggleRow
              label="35% Owner Gross Margin Floor Guard"
              desc="Block unapproved bids or discounts falling under 35% gross margin"
              checked={settings.enable_margin_guard_35}
              onToggle={() => toggleSetting('enable_margin_guard_35')}
            />
            <ToggleRow
              label="Retailer Price Surge Alerts"
              desc="Flag material cost increases across watchlist items"
              checked={settings.enable_retailer_surge_alerts}
              onToggle={() => toggleSetting('enable_retailer_surge_alerts')}
            />
            <ToggleRow
              label="Dual Retailer Watchlist (Home Depot + Lowe's)"
              desc="Enable side-by-side contractor material price feeds"
              checked={settings.enable_dual_retailer_watchlist}
              onToggle={() => toggleSetting('enable_dual_retailer_watchlist')}
            />
          </div>

          <div className="pt-2 border-t text-xs space-y-2">
            <label className="block text-xs font-bold text-gray-700">Retailer Watchlist Refresh Cadence</label>
            <select
              value={settings.price_refresh_frequency}
              onChange={e => setSettings({ ...settings, price_refresh_frequency: e.target.value })}
              className="w-full p-2 border rounded font-semibold"
            >
              <option value="weekly">Weekly Automated Sync (Default)</option>
              <option value="manual">Manual Refresh Only</option>
              <option value="disabled">Disabled</option>
            </select>
            <button
              onClick={refreshPrices}
              disabled={refreshing || settings.price_refresh_frequency === 'disabled'}
              className="w-full bg-blue-600 text-white py-2 rounded font-bold disabled:opacity-50 hover:bg-blue-700"
            >
              {refreshing ? 'Refreshing Retailers…' : '🔄 Refresh Retailer Prices Now'}
            </button>
          </div>
        </section>

        {/* Weather & Storm Tracker Settings */}
        <section className="bg-white rounded-lg shadow p-4 border-l-4 border-amber-500 space-y-3">
          <h2 className="font-bold text-sm text-gray-900 flex items-center">
            <span className="text-lg mr-1.5">🌩️</span> Weather & NOAA Storm Corroboration
          </h2>
          <div className="space-y-2 text-xs">
            <ToggleRow
              label="NOAA Severe Weather Radar Swath Overlays"
              desc="Overlay official NOAA hail and wind swaths on territory maps"
              checked={settings.enable_noaa_swath_overlays}
              onToggle={() => toggleSetting('enable_noaa_swath_overlays')}
            />
            <ToggleRow
              label="Hail Size Threshold Alerts (>= 1.00 in)"
              desc="Trigger severe hail notifications when hail diameter exceeds 1.00 inch"
              checked={settings.enable_hail_threshold_alerts}
              onToggle={() => toggleSetting('enable_hail_threshold_alerts')}
            />
            <ToggleRow
              label="Severe Wind Speed Alerts (>= 50 MPH)"
              desc="Alert field teams during localized high wind uplift storm events"
              checked={settings.enable_wind_speed_alerts}
              onToggle={() => toggleSetting('enable_wind_speed_alerts')}
            />
          </div>
        </section>

        {/* Aerial & Drone Inspection Settings */}
        <section className="bg-white rounded-lg shadow p-4 border-l-4 border-cyan-600 space-y-3">
          <h2 className="font-bold text-sm text-gray-900 flex items-center">
            <span className="text-lg mr-1.5">📐</span> Aerial Geometry & Drone Telemetry
          </h2>
          <div className="space-y-2 text-xs">
            <ToggleRow
              label="Rafter Slope Multipliers (1.054x to 1.414x)"
              desc="Automatically calculate pitch geometry multipliers in square area math"
              checked={settings.enable_rafter_slope_multipliers}
              onToggle={() => toggleSetting('enable_rafter_slope_multipliers')}
            />
            <ToggleRow
              label="EXIF Telemetry & Altitude Verification Checks"
              desc="Require drone capture metadata (altitude, camera make, coordinates)"
              checked={settings.enable_exif_telemetry_checks}
              onToggle={() => toggleSetting('enable_exif_telemetry_checks')}
            />
            <ToggleRow
              label="Auto-Facet Detection Confidence Thresholds"
              desc="Flag low-confidence aerial roof facets for manual technician review"
              checked={settings.enable_autofacet_confidence_thresholds}
              onToggle={() => toggleSetting('enable_autofacet_confidence_thresholds')}
            />
          </div>
        </section>

        {/* Invoicing & Financial Ledger Settings */}
        <section className="bg-white rounded-lg shadow p-4 border-l-4 border-purple-600 space-y-3">
          <h2 className="font-bold text-sm text-gray-900 flex items-center">
            <span className="text-lg mr-1.5">📊</span> Invoicing & Progress Billing Ledger
          </h2>
          <div className="space-y-2 text-xs">
            <ToggleRow
              label="3-Stage Progress Billing (50% Deposit / 30% Progress / 20% Final)"
              desc="Structure contractor invoices according to 3-stage progress billing ledger"
              checked={settings.enable_three_stage_progress_billing}
              onToggle={() => toggleSetting('enable_three_stage_progress_billing')}
            />
            <ToggleRow
              label="50% Contract Deposit Shortfall Alerts"
              desc="Flag jobs where deposit falls below 50% contract total before ordering materials"
              checked={settings.enable_deposit_shortfall_alerts}
              onToggle={() => toggleSetting('enable_deposit_shortfall_alerts')}
            />
            <ToggleRow
              label="Automatic Local Tax Jurisdiction Calculation"
              desc="Apply verified combined state/county/city tax rates in price books"
              checked={settings.enable_automatic_tax_application}
              onToggle={() => toggleSetting('enable_automatic_tax_application')}
            />
          </div>
        </section>

        {/* Roof Passport & Warranty Portal Settings */}
        <section className="bg-white rounded-lg shadow p-4 border-l-4 border-blue-600 space-y-3">
          <h2 className="font-bold text-sm text-gray-900 flex items-center">
            <span className="text-lg mr-1.5">🏠</span> Roof Passport & Warranty Digital Twin
          </h2>
          <div className="space-y-2 text-xs">
            <ToggleRow
              label="Public Verification Token Links for Homeowners"
              desc="Allow homeowners to track roof passport records via signed secure URLs"
              checked={settings.enable_public_verification_links}
              onToggle={() => toggleSetting('enable_public_verification_links')}
            />
            <ToggleRow
              label="Homeowner Warranty Transfer Certificate Generator"
              desc="Generate digital SHA-256 signed warranty transfer certificate packets"
              checked={settings.enable_transfer_certificate_generator}
              onToggle={() => toggleSetting('enable_transfer_certificate_generator')}
            />
            <ToggleRow
              label="Annual Warranty Maintenance Task Dispatch"
              desc="Automatically dispatch annual inspection tasks for registered warranties"
              checked={settings.enable_annual_maintenance_dispatch}
              onToggle={() => toggleSetting('enable_annual_maintenance_dispatch')}
            />
          </div>
        </section>

        {/* Team, Roles & Permission Settings */}
        <section className="bg-white rounded-lg shadow p-4 border-l-4 border-rose-600 space-y-3">
          <h2 className="font-bold text-sm text-gray-900 flex items-center">
            <span className="text-lg mr-1.5">👥</span> Team Roles, Permissions & Access Gates
          </h2>
          <div className="space-y-2 text-xs">
            <ToggleRow
              label="Admin Estimate Approval Gate"
              desc="Require workspace admin or owner sign-off before releasing estimates"
              checked={settings.enable_admin_estimate_approval_gate}
              onToggle={() => toggleSetting('enable_admin_estimate_approval_gate')}
            />
            <ToggleRow
              label="Restrict Revenue & Financials to Admins"
              desc="Hide contract pricing totals and revenue charts from non-admin team members"
              checked={settings.restrict_financials_to_admins}
              onToggle={() => toggleSetting('restrict_financials_to_admins')}
            />
            <ToggleRow
              label="Round-Robin Automatic Lead Assignment"
              desc="Distribute incoming phone and web leads evenly among sales reps"
              checked={settings.enable_round_robin_lead_assignment}
              onToggle={() => toggleSetting('enable_round_robin_lead_assignment')}
            />
          </div>
        </section>

        {/* Notification & Alert Channels */}
        <section className="bg-white rounded-lg shadow p-4 border-l-4 border-yellow-500 space-y-3">
          <h2 className="font-bold text-sm text-gray-900 flex items-center">
            <span className="text-lg mr-1.5">🔔</span> Notifications & Alert Channels
          </h2>
          <div className="space-y-2 text-xs">
            <ToggleRow
              label="In-App Status Sound Cues"
              desc="Play audio feedback for successful status updates and notifications"
              checked={settings.enable_inapp_sound_cues}
              onToggle={() => toggleSetting('enable_inapp_sound_cues')}
            />
            <ToggleRow
              label="Critical Exception SMS Dispatch"
              desc="Dispatch immediate SMS alerts for critical exception events to workspace admin"
              checked={settings.enable_critical_exception_sms_dispatch}
              onToggle={() => toggleSetting('enable_critical_exception_sms_dispatch')}
            />
          </div>
        </section>

        {/* Field Canvassing & Mobile Settings */}
        <section className="bg-white rounded-lg shadow p-4 border-l-4 border-slate-600 space-y-3">
          <h2 className="font-bold text-sm text-gray-900 flex items-center">
            <span className="text-lg mr-1.5">🚶</span> Field Canvassing & Mobile App Settings
          </h2>
          <div className="space-y-2 text-xs">
            <ToggleRow
              label="Canvassing Pin One-Click Lead Conversion"
              desc="Allow field reps to convert interested pins directly into CRM leads"
              checked={settings.enable_canvassing_lead_auto_convert}
              onToggle={() => toggleSetting('enable_canvassing_lead_auto_convert')}
            />
            <ToggleRow
              label="Digital Business Card (vCard) Module"
              desc="Enable contractor license badges & QR contact sharing in field"
              checked={settings.enable_vcard_digital_business_card}
              onToggle={() => toggleSetting('enable_vcard_digital_business_card')}
            />
            <ToggleRow
              label="Offline Local SQLite Sync Queue"
              desc="Persist field photo evidence and pins offline until connection restores"
              checked={settings.enable_offline_sqlite_queue}
              onToggle={() => toggleSetting('enable_offline_sqlite_queue')}
            />
          </div>
        </section>

        {/* Security & Compliance Gates */}
        <section className="bg-white rounded-lg shadow p-4 border-l-4 border-red-600 space-y-3">
          <h2 className="font-bold text-sm text-gray-900 flex items-center">
            <span className="text-lg mr-1.5">🔒</span> Security, Compliance & TCPA Gates
          </h2>
          <div className="space-y-2 text-xs">
            <ToggleRow
              label="Require Privileged MFA for Owner/Admin Users"
              desc="Enforce Supabase Auth AAL2 TOTP verification on login"
              checked={settings.require_mfa_privileged_users}
              onToggle={() => toggleSetting('require_mfa_privileged_users')}
            />
            <ToggleRow
              label="Strict E.164 Phone Normalization (+1NXXNXXXXXX)"
              desc="Normalize all lead & caller phone numbers to prevent duplicates"
              checked={settings.require_strict_e164_phone_format}
              onToggle={() => toggleSetting('require_strict_e164_phone_format')}
            />
            <ToggleRow
              label="TCPA Outbound Quiet Hours (8:00 AM – 8:00 PM)"
              desc="Restrict automated outbound calls and SMS outside local daytime hours"
              checked={settings.enforce_tcpa_quiet_hours_outbound}
              onToggle={() => toggleSetting('enforce_tcpa_quiet_hours_outbound')}
            />
            <ToggleRow
              label="24-Hour Stripe Payment Link Expiration"
              desc="Set strict expiration windows on generated invoice Checkout links"
              checked={settings.enforce_stripe_24hr_link_expiration}
              onToggle={() => toggleSetting('enforce_stripe_24hr_link_expiration')}
            />
          </div>
        </section>

        {/* Golden Report & Evidence Rules */}
        <section className="bg-white rounded-lg shadow p-4 border-l-4 border-teal-600 space-y-3">
          <h2 className="font-bold text-sm text-gray-900 flex items-center">
            <span className="text-lg mr-1.5">📄</span> Golden Report Standards & IRC Code Rules
          </h2>
          <div className="space-y-2 text-xs">
            <ToggleRow
              label="100% Photo Category Completeness Gate"
              desc="Block report generation until all required photo categories are captured"
              checked={settings.require_photo_completeness_report_gate}
              onToggle={() => toggleSetting('require_photo_completeness_report_gate')}
            />
            <ToggleRow
              label="Mandatory Technician Signature Sign-off"
              desc="Require signed verification in Section 7 before report release"
              checked={settings.require_technician_signature_signoff}
              onToggle={() => toggleSetting('require_technician_signature_signoff')}
            />
            <ToggleRow
              label="2021 IRC Statutory Building Code Suggestions"
              desc="Suggest drip edge (R905.2.8.5) and ice barrier (R905.1.2) upgrades"
              checked={settings.enable_2021_irc_statutory_code_suggestions}
              onToggle={() => toggleSetting('enable_2021_irc_statutory_code_suggestions')}
            />
          </div>
        </section>

        {/* Tax Jurisdiction */}
        <section className="bg-white rounded-lg shadow p-4 border space-y-3">
          <h2 className="font-bold text-sm text-gray-900">🏛️ Tax Jurisdiction Rates</h2>
          <div className="grid grid-cols-2 gap-3 text-xs">
            {([['state','State'],['county','County'],['city','City / Municipality'],['specialDistrict','Special District']] as const).map(([key, label]) => (
              <label key={key} className="block">
                <span className="font-semibold">{label}</span>
                <div className="flex items-center mt-1">
                  <input type="number" min="0" max="100" step="0.0001" value={taxRates[key]} onChange={e => updateTax(key, e.target.value)} className="w-full p-2 border rounded" />
                  <span className="ml-1 font-bold">%</span>
                </div>
              </label>
            ))}
          </div>
          <p className="text-xs font-bold text-gray-900 pt-1">Combined Tax Rate: {totalTax.toFixed(4)}%</p>
          <label className="block text-xs">
            <span className="font-semibold">Tax Source / Jurisdiction</span>
            <input value={taxSource} onChange={e => setTaxSource(e.target.value)} maxLength={200} className="w-full mt-1 p-2 border rounded" placeholder="Cobb County, GA — owner verified" />
          </label>
        </section>

        {/* Language and Market Defaults */}
        <section className="bg-white rounded-lg shadow p-4 border space-y-3">
          <h2 className="font-bold text-sm text-gray-900">🌐 Language & Market Defaults</h2>
          <div className="space-y-3 text-xs">
            <label className="block">
              <span className="font-semibold">Default Language</span>
              <select value={settings.default_language} onChange={e => setSettings({ ...settings, default_language: e.target.value })} className="w-full mt-1 p-2 border rounded">
                <option value="en-US">English (US)</option>
                <option value="es-US">Spanish (US)</option>
              </select>
            </label>
            <label className="block">
              <span className="font-semibold">Default ZIP Code</span>
              <input value={settings.default_zipcode} onChange={e => setSettings({ ...settings, default_zipcode: e.target.value })} inputMode="numeric" maxLength={5} className="w-full mt-1 p-2 border rounded" placeholder="30123" />
            </label>
            <label className="block">
              <span className="font-semibold">Material Search Mode</span>
              <select value={settings.material_search_mode} onChange={e => setSettings({ ...settings, material_search_mode: e.target.value })} className="w-full mt-1 p-2 border rounded">
                <option value="catalog_and_retailer">Catalog plus retailer reference</option>
                <option value="catalog_only">Catalog only</option>
              </select>
            </label>
            <label className="block">
              <span className="font-semibold">Preferred Shingle Brand</span>
              <input value={settings.preferred_brands.shingles ?? ''} onChange={e => setSettings({ ...settings, preferred_brands: { ...settings.preferred_brands, shingles: e.target.value } })} className="w-full mt-1 p-2 border rounded" placeholder="GAF" />
            </label>
          </div>
        </section>

        <button onClick={save} disabled={!loaded || saving} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3.5 rounded-lg font-bold text-sm disabled:opacity-50">
          {saving ? 'Saving Settings…' : '💾 Save All Master Settings & Toggles'}
        </button>

        {message && <p className="text-xs font-bold bg-blue-50 text-blue-900 border border-blue-200 rounded p-3">{message}</p>}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t flex justify-around py-2 px-4">
        <button onClick={() => router.push('/')} className="text-gray-500 text-sm">🏠 Home</button>
        <button onClick={() => router.push('/pricing-config')} className="text-gray-500 text-sm">💰 Pricing</button>
        <button onClick={() => router.push('/settings')} className="text-blue-600 font-bold text-sm">⚙️ Settings</button>
      </nav>
    </div>
  )
}

function ToggleRow({ label, desc, checked, onToggle }: { label: string; desc: string; checked: boolean; onToggle: () => void }) {
  return (
    <div className="flex justify-between items-start p-2 border rounded bg-gray-50/50">
      <div className="pr-2">
        <p className="font-bold text-gray-900">{label}</p>
        <p className="text-[10px] text-gray-500">{desc}</p>
      </div>
      <button
        type="button"
        onClick={onToggle}
        className={`w-11 h-6 shrink-0 flex items-center rounded-full p-1 transition-colors ${checked ? 'bg-emerald-600' : 'bg-gray-300'}`}
      >
        <div className={`w-4 h-4 bg-white rounded-full shadow transform transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
      </button>
    </div>
  )
}
