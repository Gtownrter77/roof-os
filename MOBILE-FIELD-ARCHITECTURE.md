# ROOF/OS Mobile Field App Architecture

**Target:** A commercial iOS and Android field application for roofing sales representatives, inspectors, project managers, and crew leads.

## Architecture decision

Build a separate Expo/React Native application that shares the existing Supabase project with the Next.js desktop application. Do not make the desktop site the long-term mobile product. The phone and tablet workflow needs camera controls, offline persistence, background upload, push notifications, location-aware appointments, and app-store distribution.

The mobile app should be a thin, typed client over shared domain contracts. Supabase remains the system of record. The mobile app owns temporary drafts, upload queues, optimistic UI, and device capabilities. The desktop app owns company administration, dense data management, production planning, reporting, configuration, and billing.

## Technology stack

| Layer | Choice | Reason |
| --- | --- | --- |
| App runtime | React Native with Expo | One codebase for iOS and Android with native camera, notifications, location, and build services |
| Language | TypeScript with strict mode | Shared types and safer synchronization contracts |
| Navigation | Expo Router | File-based routes, deep links, tabs, and protected route groups |
| UI | NativeWind or Tamagui plus a small ROOF/OS design system | Mobile-first components with consistent tokens and accessible touch targets |
| Auth | `@supabase/supabase-js` and `expo-secure-store` | Supabase session persistence without storing credentials in plain storage |
| Server state | TanStack Query | Caching, invalidation, optimistic mutations, retry behavior, and offline-aware queries |
| Local database | `expo-sqlite` | Durable inspection drafts, mutation queue, photo metadata, and upload state |
| Forms | React Hook Form and Zod | Fast field forms with shared validation schemas |
| Camera/media | `expo-camera`, `expo-image-picker`, `expo-image-manipulator` | Camera capture, gallery selection, resizing, thumbnails, and compression |
| Uploads | Supabase Storage with resumable strategy where needed | Private workspace-scoped originals and thumbnails |
| Background work | `expo-background-task` and `expo-task-manager` | Retry queued uploads and sync work when the OS permits |
| Notifications | `expo-notifications` | Appointment reminders, assignment changes, upload failures, and mentions |
| Location/maps | `expo-location` plus a maps provider | Directions, arrival context, and optional check-in radius |
| Monitoring | Sentry plus structured product events | Crash/error visibility and field reliability metrics |
| Testing | Jest, React Native Testing Library, Detox, and EAS preview builds | Unit, component, device-flow, and release validation |
| Delivery | EAS Build, EAS Submit, and EAS Update | Signed store builds and controlled over-the-air JavaScript updates |

## Project structure

```text
apps/
  field/
    app/                    # Expo Router screens and protected route groups
    src/
      components/           # Mobile-only visual components
      features/
        auth/
        today/
        leads/
        inspections/
        photos/
        appointments/
        tasks/
        crew/
      db/                    # SQLite schema, migrations, repositories
      sync/                  # Mutation queue, retry, conflict handling
      lib/                   # Supabase, Sentry, device helpers
      theme/                 # Tokens and accessibility helpers
packages/
  domain/                   # Shared Zod schemas, types, status enums, permissions
  api/                      # Query keys and typed data access contracts
  config/                   # Environment and feature flags
```

The existing Next.js repository can adopt this structure incrementally. The first mobile pilot may live in `apps/field` while the desktop app remains at the repository root. Do not duplicate status strings, permission rules, or photo metadata types between applications.

## Navigation model

Use protected route groups:

```text
(auth)/sign-in
(auth)/magic-link
(app)/today
(app)/leads
(app)/leads/[id]
(app)/appointments
(app)/inspections/new
(app)/inspections/[id]/capture
(app)/inspections/[id]/review
(app)/photos/[id]
(app)/tasks
(app)/crew
(app)/settings
```

The default authenticated route is **Today**, not a generic dashboard. A field worker should reach the next appointment or **Start inspection** action in one tap.

## Sync model

Every write should follow this sequence:

1. Validate the payload with the shared Zod schema.
2. Write the mutation to a local SQLite queue with an idempotency key.
3. Update the local read model optimistically.
4. Attempt the Supabase mutation when online.
5. Mark the queue item `synced` after a confirmed response.
6. Retry transient failures with exponential backoff.
7. Mark permanent failures `blocked` and show a user-actionable message.
8. Reconcile server timestamps and status after synchronization.

Do not rely on `AsyncStorage` for inspection records or photo queues. It is not a suitable database for large, relational, retryable field data.

## Photo pipeline

1. Capture an original image with a stable local UUID.
2. Save local metadata and a thumbnail immediately.
3. Add an upload queue item containing the inspection ID, album, MIME type, dimensions, and local file URI.
4. Compress only the upload derivative; preserve the original according to the workspace retention policy.
5. Upload to a private path shaped as `<workspace_id>/<user_id>/<inspection_id>/<photo_id>.<ext>`.
6. Insert or update `inspection_photos` only after the Storage upload succeeds, or use a server-side Edge Function to make the two-step operation atomic from the client’s perspective.
7. Retry interrupted uploads and preserve progress state.
8. Generate signed URLs on demand; never make inspection evidence publicly accessible.

## Conflict rules

- Activity, notes, and photo metadata are append-oriented and should merge by UUID.
- Status updates use server order and retain every transition in `lead_status_history`.
- Editable lead fields use `updated_at` and a version counter; show a conflict state if the server version has changed since the local draft.
- Deletions should be soft deletes for business records and explicit purge jobs for media retention.

## Security model

- Require a valid Supabase session before entering `(app)` routes.
- Store sessions in SecureStore and refresh them through Supabase’s mobile client.
- Fetch the current workspace through an RLS-protected membership query or a narrowly scoped RPC.
- Enforce workspace and role checks in Postgres RLS. Client-side role checks are only for presentation.
- Keep Storage buckets private and use workspace-scoped object paths.
- Record device-independent audit events for status changes, uploads, signatures, exports, and permission changes.
- Request camera, media-library, notification, and location permissions only at the point of need, with an explanation screen first.

## Release gates

A field-app release is not ready for sale until it passes:

| Gate | Required evidence |
| --- | --- |
| Offline | Create an inspection in airplane mode, close/reopen the app, reconnect, and confirm complete sync |
| Photo reliability | Upload a multi-photo inspection on a weak network with retries and no duplicate metadata |
| Security | A second workspace cannot query, download, update, or delete the first workspace’s records or objects |
| Device coverage | iPhone, iPad/tablet, and representative Android phone/tablet smoke tests |
| Accessibility | Dynamic type, screen reader labels, focus order, contrast, and touch targets |
| Observability | Crash reporting, upload failure event, sync queue metrics, and release version recorded |
| Commercial | Workspace onboarding, invite/role flow, data export, retention, and subscription limit behavior |

## Initial implementation slice

Build the first field slice in this order:

1. Expo Router shell and Supabase Auth.
2. Today screen with real leads and appointments.
3. Inspection session creation and local SQLite draft.
4. Camera capture with albums and captions.
5. Upload queue backed by private Storage and `inspection_photos` metadata.
6. Desktop inspection review with status/activity timeline.
7. Retry, offline, and cross-workspace security tests.

This slice creates a valuable pilot without attempting estimates, payments, crew scheduling, or third-party measurement integrations before the evidence workflow is dependable.
