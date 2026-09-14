# ROOF/OS Database Schema Draft

This draft extends the existing `001_leads.sql` and `002_workspaces_activity_storage.sql` migrations. Apply migrations in numeric order. The third migration adds durable status history, inspection sessions, and photo metadata while keeping binary images in private Supabase Storage.

## Relationship model

```text
auth.users
  └── workspace_members ──> workspaces
                              ├── leads
                              │    ├── lead_activity
                              │    └── lead_status_history
                              └── inspection_sessions
                                    └── inspection_photos ──> storage.objects
```

## Core tables

| Table | Key columns | Security boundary |
| --- | --- | --- |
| `workspaces` | `id`, `name`, `created_by` | Member read access |
| `workspace_members` | `workspace_id`, `user_id`, `role` | Members can see memberships in their workspace |
| `leads` | `id`, `workspace_id`, `owner_id`, `status` | Workspace membership; owner required on insert |
| `lead_activity` | `lead_id`, `workspace_id`, `user_id`, `kind`, `body` | Workspace membership; author required on insert |
| `lead_status_history` | `lead_id`, `workspace_id`, `from_status`, `to_status`, `changed_by` | Workspace read; authenticated member writes |
| `inspection_sessions` | `id`, `workspace_id`, `lead_id`, `status` | Workspace membership; creator required on insert |
| `inspection_photos` | `inspection_id`, `workspace_id`, `object_path`, `album`, `upload_status` | Workspace membership; uploader required on insert |

## Lead status lifecycle

The initial status vocabulary is:

```text
new → assigned → qualified → inspection_scheduled → inspected
    → report_pending → report_approved → won
    → lost
```

The database preserves every transition in `lead_status_history`. The existing `lead_activity` table remains the human-readable timeline for notes and UI events. A database trigger writes the status history automatically whenever a lead is inserted or its status changes.

## Photo storage model

Store image bytes in the private `inspection-photos` bucket. Store searchable metadata in `inspection_photos`.

Recommended object path:

```text
<workspace_id>/<user_id>/<inspection_id>/<photo_id>.<extension>
```

The first path segment is checked by Storage RLS against workspace membership. The metadata table additionally checks `workspace_id`, `inspection_id`, and `uploaded_by` through Postgres RLS.

## Migration files

1. `supabase/migrations/001_leads.sql` creates the initial lead table and owner-based policies.
2. `supabase/migrations/002_workspaces_activity_storage.sql` creates workspaces, membership, activity notes, workspace policies, and the private Storage bucket.
3. `supabase/migrations/003_status_history_inspection_photos.sql` creates status history, inspection sessions, photo metadata, indexes, trigger logic, and RLS policies.

The migration files are designed to be rerunnable for policies, triggers, indexes, and the Storage bucket. Apply them through the Supabase CLI or the project SQL Editor, then verify the tables, policies, bucket visibility, authenticated CRUD, and cross-workspace isolation.
