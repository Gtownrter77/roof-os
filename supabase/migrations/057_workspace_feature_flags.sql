-- ROOF/OS workspace feature flags.
--
-- These switches live on public.workspace_settings so an owner can turn a
-- behavior on or off for one workspace. Every flag defaults to true, which is
-- the same value the settings screen shows, so an existing workspace keeps its
-- documented behavior until an owner saves a change.
--
-- The flags are read by the server before any provider action happens:
--   enable_ai_receptionist                   receptionist inbound/outbound routes and the follow-up cron
--   enable_inspection_quality_agent          inspection-quality cron
--   enable_voice_copilot_whisper             /api/ai/transcribe
--   enable_auto_followup_tasks               the lead follow-up trigger below
--   enable_dual_retailer_watchlist           retailer cron and /api/pricing/lowes
--   enable_canvassing_lead_auto_convert      field canvass screen
--   enable_vcard_digital_business_card       field canvass screen
--   require_strict_e164_phone_format         outbound call, text, and field text routes
--   enforce_tcpa_quiet_hours_outbound        outbound call, text, and field text routes
--   enforce_stripe_24hr_link_expiration      invoice payment link route
--   require_photo_completeness_report_gate   Golden Report generation
--   require_technician_signature_signoff     Golden Report generation
--   enable_2021_irc_statutory_code_suggestions  building code lookup
--
-- enable_margin_guard_35, enable_retailer_surge_alerts, enable_offline_sqlite_queue,
-- and require_mfa_privileged_users are stored so the owner can record the decision.
-- They are not enforced yet, and the settings screen says so.

alter table public.workspace_settings
  add column if not exists enable_ai_receptionist boolean not null default true,
  add column if not exists enable_inspection_quality_agent boolean not null default true,
  add column if not exists enable_voice_copilot_whisper boolean not null default true,
  add column if not exists enable_auto_followup_tasks boolean not null default true,
  add column if not exists enable_margin_guard_35 boolean not null default true,
  add column if not exists enable_retailer_surge_alerts boolean not null default true,
  add column if not exists enable_dual_retailer_watchlist boolean not null default true,
  add column if not exists enable_canvassing_lead_auto_convert boolean not null default true,
  add column if not exists enable_vcard_digital_business_card boolean not null default true,
  add column if not exists enable_offline_sqlite_queue boolean not null default true,
  add column if not exists require_mfa_privileged_users boolean not null default true,
  add column if not exists require_strict_e164_phone_format boolean not null default true,
  add column if not exists enforce_tcpa_quiet_hours_outbound boolean not null default true,
  add column if not exists enforce_stripe_24hr_link_expiration boolean not null default true,
  add column if not exists require_photo_completeness_report_gate boolean not null default true,
  add column if not exists require_technician_signature_signoff boolean not null default true,
  add column if not exists enable_2021_irc_statutory_code_suggestions boolean not null default true;

comment on column public.workspace_settings.enable_auto_followup_tasks is 'Workspace switch for the automatic lead follow-up task.';
comment on column public.workspace_settings.enable_margin_guard_35 is 'Stored owner decision. Not enforced: estimate drafts are unpriced.';
comment on column public.workspace_settings.enable_retailer_surge_alerts is 'Stored owner decision. Not enforced: no retailer price delta worker yet.';
comment on column public.workspace_settings.enable_offline_sqlite_queue is 'Stored owner decision. Not enforced: the field app does not read workspace settings.';
comment on column public.workspace_settings.require_mfa_privileged_users is 'Stored owner decision. Not enforced at sign-in: forcing owner MFA locked the owner out of the app.';

-- Record the expiration window on the payment link ledger so an expired link is
-- not handed back to a caller as if it were still usable.
alter table public.receptionist_payment_links add column if not exists expires_at timestamptz;
comment on column public.receptionist_payment_links.expires_at is 'When the generated checkout link stops working. Null when the workspace did not require a 24-hour window.';

-- Re-apply the lead follow-up trigger so it honors the workspace switch.
create or replace function public.create_default_lead_followup()
returns trigger language plpgsql security definer set search_path = public
as $$
declare followup_key text;
declare followup_title text;
declare followup_hours integer;
begin
  if new.workspace_id is null or new.owner_id is null then return new; end if;

  if not exists (
    select 1 from public.workspace_settings
    where workspace_id = new.workspace_id and enable_auto_followup_tasks
  ) then return new; end if;

  if tg_op = 'INSERT' then
    if not exists (
      select 1 from public.automation_rules
      where workspace_id = new.workspace_id and agent_key = 'intake_router' and enabled
    ) then return new; end if;
    followup_key := 'intake:' || new.id::text;
    followup_title := 'First response: ' || new.name;
    followup_hours := 24;
  elsif new.status is distinct from old.status
    and new.status in ('qualified','inspected','report_approved') then
    if not exists (
      select 1 from public.automation_rules
      where workspace_id = new.workspace_id and agent_key = 'scheduler' and enabled
    ) then return new; end if;
    followup_key := 'status:' || new.id::text || ':' || new.status;
    followup_title := 'Follow up: ' || new.name || ' (' || replace(new.status, '_', ' ') || ')';
    followup_hours := case when new.status = 'inspected' then 48 else 168 end;
  else
    return new;
  end if;

  insert into public.tasks
    (workspace_id, lead_id, title, due_at, assigned_to, created_by, status, notes, automation_key)
  values
    (new.workspace_id, new.id, followup_title,
     now() + make_interval(hours => followup_hours), new.owner_id, new.owner_id,
     'open', 'Created by ROOF/OS scheduler agent default rule.', followup_key)
  on conflict (workspace_id, automation_key) do nothing;
  return new;
end;
$$;

revoke all on function public.create_default_lead_followup() from public, anon, authenticated;
