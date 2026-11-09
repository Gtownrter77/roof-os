-- Employee layers for ROOF/OS.
-- Owner stays the system owner. Everyone else is invited into a layer.
-- manager maps to workspace admin. The rest map to member.
-- YOLO MODE stays owner only.

alter table public.workspace_invitations
  add column if not exists employee_layer text;

alter table public.workspace_invitations
  drop constraint if exists workspace_invitations_employee_layer_check;

alter table public.workspace_invitations
  add constraint workspace_invitations_employee_layer_check
  check (employee_layer is null or employee_layer in ('operations','inspector','closer','canvasser','production'));

comment on column public.workspace_invitations.employee_layer is
  'Job layer: operations, inspector, closer, canvasser, or production. Owner is not invited. AI stays inside the layer.';
