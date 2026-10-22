-- Fix for stuck settings: Adding missing feature toggles to workspace_settings
ALTER TABLE public.workspace_settings 
ADD COLUMN IF NOT EXISTS enable_ai_receptionist BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS enable_inspection_quality_agent BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS enable_voice_copilot_whisper BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS enable_auto_followup_tasks BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS enable_margin_guard_35 BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS enable_retailer_surge_alerts BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS enable_dual_retailer_watchlist BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS enable_canvassing_lead_auto_convert BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS enable_vcard_digital_business_card BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS enable_offline_sqlite_queue BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS require_mfa_privileged_users BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS require_strict_e164_phone_format BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS enforce_tcpa_quiet_hours_outbound BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS enforce_stripe_24hr_link_expiration BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS require_photo_completeness_report_gate BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS require_technician_signature_signoff BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS enable_2021_irc_statutory_code_suggestions BOOLEAN DEFAULT true;
