-- Enforce lead/workspace consistency for workspace-scoped lead audit rows.
alter table public.leads drop constraint if exists leads_id_workspace_key;
alter table public.leads add constraint leads_id_workspace_key unique (id, workspace_id);
do $$ begin
  if exists (select 1 from public.lead_activity a where not exists (select 1 from public.leads l where l.id = a.lead_id and l.workspace_id = a.workspace_id)) then raise exception 'Existing lead_activity rows contain lead/workspace mismatches'; end if;
  if exists (select 1 from public.lead_status_history h where not exists (select 1 from public.leads l where l.id = h.lead_id and l.workspace_id = h.workspace_id)) then raise exception 'Existing lead_status_history rows contain lead/workspace mismatches'; end if;
end $$;
alter table public.lead_activity drop constraint if exists lead_activity_lead_workspace_fkey;
alter table public.lead_activity add constraint lead_activity_lead_workspace_fkey foreign key (lead_id, workspace_id) references public.leads (id, workspace_id) on delete cascade;
alter table public.lead_status_history drop constraint if exists lead_status_history_lead_workspace_fkey;
alter table public.lead_status_history add constraint lead_status_history_lead_workspace_fkey foreign key (lead_id, workspace_id) references public.leads (id, workspace_id) on delete cascade;
