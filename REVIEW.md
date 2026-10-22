# ROOF/OS Review

**Status — 2026-10-20:** Historical pointer only. Current release truth is maintained in [HANDOFF.md](HANDOFF.md), including the unresolved authenticated-login and physical-Android verification gates.

Superseded by [STATE-OF-THE-UNION.md](STATE-OF-THE-UNION.md).

Auth is Supabase magic-link + SSR session cookies, not a demo cookie. Production identity still depends on real Vercel secrets and applied migrations.
