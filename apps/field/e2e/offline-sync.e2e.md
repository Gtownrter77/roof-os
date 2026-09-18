# Mobile Offline Synchronization EAS Test Suite

This suite is intended for an Expo/EAS development build on a real Android or iOS device. It validates the local SQLite queue, authenticated user/workspace scoping, deterministic client keys, restart recovery, and retry behavior after partial remote success.

## Preconditions

Build with the `development` profile and configure `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, and `EXPO_PUBLIC_WEB_APP_URL` in the EAS environment. Apply migrations through `028_mobile_offline_idempotency.sql`. Use two test users with access to different workspaces and a private `inspection-photos` bucket. Enable device network controls or use airplane mode plus Wi-Fi toggling.

## Test matrix

| ID | Scenario | Steps | Expected result |
|---|---|---|---|
| OFF-01 | Authenticated offline draft | Sign in as User A; disable network; enter address; capture a photo; force-close and reopen the app. | Draft, photo count, and queued photo survive restart; no remote row is required while offline. |
| OFF-02 | Measurement persistence | Offline, save two manual measurements; restart; return to the same account. | Both measurements remain queued with stable client IDs and are not duplicated. |
| OFF-03 | User isolation | Sign out User A; sign in as User B on the same device. | User B cannot see User A’s local draft, measurements, or queued photos. |
| OFF-04 | Workspace isolation | Create a draft in Workspace A; switch the account’s active workspace to Workspace B; press sync. | Sync is blocked with a workspace-mismatch message; no evidence is written to Workspace B. |
| OFF-05 | Session idempotency | Capture offline; restore network; tap sync twice rapidly or kill the app after session creation and before local acknowledgment; retry. | Exactly one remote `inspection_sessions` row exists for the draft’s `(workspace_id, client_id)`. |
| OFF-06 | Measurement partial batch | Queue two measurements; interrupt network after the first remote insert; restore network and retry. | First measurement remains one row; second is eventually inserted; each local row is marked synced independently. |
| OFF-07 | Photo upload retry | Queue two photos; interrupt after Storage upload of photo 1 but before metadata insertion; restore network and retry. | Existing object is recovered; exactly one `inspection_photos` row exists per client key; both queue rows become synced. |
| OFF-08 | Photo upload failure | Deny network or force a Storage error for photo 2. | Photo 1 remains synced; photo 2 remains queued and retryable; the draft is not falsely marked complete. |
| OFF-09 | Auth expiry during sync | Start sync; expire the session or revoke the token; retry after re-authentication. | Sync pauses without data loss; re-authentication resumes the same client keys. |
| OFF-10 | Duplicate tap protection | Press “Sync queued work now” repeatedly while a sync is active. | Only one sync execution runs at a time; no duplicate remote rows are created. |
| OFF-11 | Cross-account key collision | Have User A and User B use the same synthetic client key in separate workspaces. | Rows remain isolated by workspace and RLS; neither user can read the other’s records. |
| OFF-12 | App upgrade migration | Install the previous pilot build with local data, upgrade to the hardened development build, and reopen. | SQLite initialization succeeds; new columns are available; old drafts without ownership are not exposed to another account. |

## Evidence to capture

For each test record the build ID, device model/OS, account/workspace, network state, local queue state before and after, remote row counts, Storage object paths, and any retry error. Verify counts with authorized Supabase queries rather than relying only on the UI.

## Pass criteria

The suite passes only when every client key produces at most one remote session, measurement, and photo record per workspace; failed records remain retryable; user and workspace boundaries are preserved; and the queue survives process termination and network transitions.

The repository-level deterministic check is:

```bash
node scripts/mobile-offline-sync-test.mjs
```

That check validates the code contract and simulates duplicate/partial-success behavior. It does not replace the real EAS device run because camera permissions, SQLite persistence, Storage uploads, and OS process termination require a native development build.
