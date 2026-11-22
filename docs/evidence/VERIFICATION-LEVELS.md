# Verification levels (read before citing a test as proof)

Weak-link batches use three distinct evidence levels. A green exit code is never
proof of a higher level than the one the test actually exercises.

| Level | What it exercises | What it does **not** prove |
|---|---|---|
| **Pure helper / runtime** | A callable function imported by the test with real inputs and assertions (`stripe-webhook`, `lockout-status-guard`, `photo-approval`, `warranty-expiry`, `lockout-concurrency`, `estimate-creation-safety`). Deterministic and reproducible locally. | Hosted database behavior, provider APIs, physical devices. |
| **Source contract** | Assertions over source text (regex/includes) that wire a helper into a route or migration. Local, cheap, and useful against regressions. | Runtime behavior. A regex match is **not** execution: it does not prove a migration parses in PostgreSQL, a preflight works in a browser, or a route returns the expected status. |
| **Behavioral / field** | An actual request against a running system, a real provider event, a hosted Supabase/RLS check, a device run, or a deployed-SHA check. | Anything not explicitly observed. These stay `UNVERIFIED` until recorded with exact evidence. |

## Rules

1. Label every gate with its level in the ledger and in PR/handoff summaries.
2. Never describe a source-contract gate as "behavioral proof", "RLS verified",
   "Stripe verified", "browser preflight verified", or "device verified".
3. `test:field-device-evidence` reports `UNVERIFIED` for the checked-in
   template. A genuine device run with a failed case must be recorded as
   `FAIL` and blocks the gate; it is not downgraded to `UNKNOWN`.
4. Hosted Supabase migrations/RLS, live Stripe events, CORS preflight in a real
   browser, two-workspace live isolation, APK install on a physical device, and
   deployed-SHA checks remain unverified in this repository work package.
5. `test:all` exit 0 means the local source suite passed at the tested commit.
   It is not production, field, or deployment evidence.
