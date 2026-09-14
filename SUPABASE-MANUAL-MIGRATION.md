# ROOF/OS Supabase Manual Migration Guide

The workspace, activity, and private inspection-photo security layer is prepared in:

```text
supabase/migrations/002_workspaces_activity_storage.sql
```

The migration has been validated locally as source, but it must be executed in the target Supabase project before the new workspace-aware lead and photo workflows can be considered production-complete.

## Apply in Supabase SQL Editor

1. Open the Roof OS Supabase project dashboard.
2. Sign in if prompted.
3. Select **SQL Editor** from the left sidebar.
4. Select **New query**.
5. Open `supabase/migrations/002_workspaces_activity_storage.sql` from this repository and copy the entire file.
6. Paste the entire file into the SQL editor. Make sure the editor includes the final Storage policies; a truncated paste will produce an incomplete setup.
7. Review the statements. The migration creates workspace tables, a new-user workspace trigger, an existing-user backfill, activity-note storage, RLS policies, and a private `inspection-photos` bucket.
8. Click **Run** and wait for **Success**. If any error occurs, do not continue with a partial migration; correct the error and rerun the complete file.
9. Save the query as a private snippet, for example `ROOF OS workspace security 002`.

The migration is rerunnable for its policies and trigger. It uses `create table if not exists`, `drop policy if exists`, and `on conflict` for the bucket. Do not remove the workspace or lead data statements without reviewing the security impact.

## Verify the result

Run these read-only checks in SQL Editor:

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('workspaces', 'workspace_members', 'leads', 'lead_activity')
order by table_name;

select policyname, tablename, cmd
from pg_policies
where schemaname in ('public', 'storage')
  and tablename in ('workspaces', 'workspace_members', 'leads', 'lead_activity', 'objects')
order by tablename, policyname;

select id, name, public
from storage.buckets
where id = 'inspection-photos';
```

Expected results:

- `workspaces`, `workspace_members`, `leads`, and `lead_activity` are present.
- Workspace membership, lead, activity, and Storage object policies are present.
- The `inspection-photos` bucket exists with `public = false`.

## Verify in the live app

Open [https://roof-os-lemon.vercel.app](https://roof-os-lemon.vercel.app) and sign in.

1. Open **Leads** and create a lead.
2. Reload and confirm the lead persists.
3. Change its status and open activity; confirm a status-change event appears.
4. Add an activity note; reload and confirm it remains.
5. Open **Camera**, select a photo, and choose **Upload All**.
6. Confirm the upload succeeds and the object is private in the Supabase Storage browser.
7. Test with a second user/workspace and confirm the first user's leads and photos are not visible or mutable.

## Common errors

- `function current_workspace_id() does not exist`: the migration has not been applied.
- RLS denial on lead creation: confirm the signed-in user has a row in `workspace_members` and that the lead uses that workspace ID.
- Storage upload denial: confirm the object path begins with `<workspace_id>/<user_id>/` and that the bucket is private.
- Existing account has no workspace: rerun the migration's idempotent backfill block or insert the missing workspace/member record through a reviewed SQL query.

Never put a Supabase service-role key, database password, or other secret in the repository, browser code, or this guide.
