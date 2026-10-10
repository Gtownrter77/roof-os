# Production migration source archive

This folder preserves candidate source files for production migration-ledger entries 044–048 that are missing from current `main`.

## Provenance

- Recovered from branch `fix/reality-integrity-clean-main`.
- Source branch commit: `aa47e4a1dbb8fd3806a1a4da3c4e755341f6ede1`.
- The archived filenames match five entries in the live timestamped Supabase migration ledger.
- The ledger records migration versions and names, not the SQL bytes, so these files are **historical source candidates**, not byte-for-byte verified copies of the exact SQL applied in production.

## Safety

- These files are stored under `docs/`, not the executable `supabase/migrations/` directory.
- Do not execute them as new migrations or copy them over the current `044`–`048` files, which have different contents.
- Before any reconstruction, compare each definition/constraint/trigger against the live schema and the applied production state.
