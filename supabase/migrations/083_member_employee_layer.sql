-- Carry the invited layer onto the workspace member.
-- Owner stays the system owner. Everyone else keeps the layer from the invite.

alter table public.workspace_members
  add column if not exists employee_layer text;

alter table public.workspace_members
  drop constraint if exists workspace_members_employee_layer_check;

alter table public.workspace_members
  add constraint workspace_members_employee_layer_check
  check (employee_layer is null or employee_layer in ('owner','operations','inspector','closer','canvasser','production'));

comment on column public.workspace_members.employee_layer is
  'Job layer carried from the accepted invite. Owner is set separately.';
