# Owner Break Glass — verification record

Owner-only emergency entry is `GET /auth/enter` guarded by `OWNER_ENTER_SECRET`.
Nothing in this change modifies the mechanism; it adds negative coverage.

## Behaviour under test

| Case | Expected |
| --- | --- |
| `OWNER_ENTER_SECRET` unset or blank | `enter_locked` — entry refused |
| Secret shorter than 16 chars, even if the request matches | `enter_locked` |
| Secret of exactly 16 chars | accepted when the key matches |
| Wrong length or wrong value | `enter_forbidden` |
| Empty / null / whitespace-only key | `enter_forbidden` |
| Matching key with surrounding whitespace | accepted (both sides trimmed) |
| Case difference | rejected (comparison is exact) |
| Query `?key=` or header `x-roof-os-enter` | both supported; gate runs before session mint |
| Gate failure | redirect to `/auth/login` with `enter_error`, `Cache-Control: no-store`, httpOnly+secure skip cookie |
| Session mint | password first, then service-role magic link; never creates or invites users; owner resolution fails closed |
| Login page | maps `enter_error` values to messages instead of appearing to succeed |

## Evidence

- `npm run test:owner-break-glass` — runtime gate checks plus source contracts for the route, session mint and login page. Runs in the required `web` job.
- Constant-time comparison uses `crypto.timingSafeEqual` with a length check first.
- No secret value is logged, returned, or written to a cookie.

## Limits

- This is a **source-level and gate-level** test. It does not create a live Supabase session.
- Real owner sign-in, magic-link minting and Supabase Auth behaviour are **not** exercised here; they need Supabase credentials and are a separate integration step.
- No production configuration was read or changed.
