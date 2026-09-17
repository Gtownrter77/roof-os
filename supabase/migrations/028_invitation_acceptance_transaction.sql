-- Complete the invitation lifecycle with an atomic, email-bound acceptance flow.
-- The caller must be authenticated as the invited email address.
create or replace function public.accept_workspace_invitation(p_invitation_id uuid)
returns table (workspace_id uuid, role text)
language plpgsql
security definer
set search_path = public
as $$
declare
  invitation public.workspace_invitations%rowtype;
  current_email text;
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'authentication required';
  end if;

  current_email := lower(coalesce(auth.jwt() ->> 'email', ''));
  if current_email = '' then
    raise exception 'authenticated email is unavailable';
  end if;

  select * into invitation
  from public.workspace_invitations
  where id = p_invitation_id
  for update;

  if not found then
    raise exception 'invitation not found';
  end if;
  if invitation.status <> 'pending' then
    raise exception 'invitation is no longer pending';
  end if;
  if invitation.expires_at <= now() then
    update public.workspace_invitations
      set status = 'expired', updated_at = now()
      where id = invitation.id;
    raise exception 'invitation has expired';
  end if;
  if lower(invitation.email) <> current_email then
    raise exception 'invitation email does not match authenticated user';
  end if;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (invitation.workspace_id, current_user_id, invitation.role)
  on conflict (workspace_id, user_id) do update
    set role = excluded.role;

  update public.workspace_invitations
    set status = 'accepted', accepted_at = now(), accepted_user_id = current_user_id, updated_at = now()
    where id = invitation.id;

  return query select invitation.workspace_id, invitation.role;
end;
$$;

revoke all on function public.accept_workspace_invitation(uuid) from public, anon;
grant execute on function public.accept_workspace_invitation(uuid) to authenticated;
