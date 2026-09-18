-- Reconcile executable grants for SECURITY DEFINER helpers.
--
-- Trigger-only helpers must not be exposed as REST RPCs. RLS helper functions
-- need authenticated execution for policies, but anonymous callers do not.
-- The receptionist booking helper is intentionally worker-only: it has no
-- caller identity parameter validation and must be executed only by the
-- trusted server-side worker using the service role.

begin;

-- RLS predicates: available to signed-in application users only.
revoke all on function public.current_workspace_id() from public, anon;
grant execute on function public.current_workspace_id() to authenticated;

revoke all on function public.is_system_owner() from public, anon;
grant execute on function public.is_system_owner() to authenticated;

revoke all on function public.is_workspace_admin(uuid) from public, anon;
grant execute on function public.is_workspace_admin(uuid) to authenticated;

revoke all on function public.is_workspace_member(uuid) from public, anon;
grant execute on function public.is_workspace_member(uuid) to authenticated;

-- Direct user-facing RPCs retain only their intended signed-in callers.
revoke all on function public.accept_workspace_invitation(uuid) from public, anon;
grant execute on function public.accept_workspace_invitation(uuid) to authenticated;

revoke all on function public.reserve_retailer_price_query(uuid, text, date, integer) from public, anon;
grant execute on function public.reserve_retailer_price_query(uuid, text, date, integer) to authenticated;

-- Trigger and setup functions must never be REST-callable.
revoke all on function public.handle_new_user_workspace() from public, anon, authenticated;
revoke all on function public.create_default_lead_followup() from public, anon, authenticated;
revoke all on function public.record_lead_status_change() from public, anon, authenticated;
revoke all on function public.seed_default_automation_rules(uuid, uuid) from public, anon, authenticated;

-- The booking procedure writes appointments and receptionist event data under
-- SECURITY DEFINER. Keep it inaccessible to browser/API roles; the trusted
-- server-side receptionist worker uses SUPABASE_SERVICE_ROLE_KEY.
revoke all on function public.book_receptionist_appointment(uuid, uuid, text, timestamptz, text, uuid, text) from public, anon, authenticated;
grant execute on function public.book_receptionist_appointment(uuid, uuid, text, timestamptz, text, uuid, text) to service_role;

commit;
