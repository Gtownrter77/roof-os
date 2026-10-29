# Post-merge verification — Days 27-30

Date: 2026-10-29 (UTC). Repository: `Gtownrter77/roof-os`.

## Scope

PR #366 merged Days 27-30 into `main`. This file records the verified merge SHA
and the required-check result on it. It does not add live evidence for any other
gate.

## Merge

| Item | Value |
| --- | --- |
| Pull request | #366 |
| Base before merge | `57350181b65e74a1b18be88d3622cead4b48db1f` |
| Head before merge | `1c932f2a1ca381d27c1d229edce806c3a4136cdf` |
| Merge commit | `c2b29fefe95246f28eab3b041f60ce846e9f9318` |

## Required checks on the merge commit

Read from the GitHub check-runs API for `c2b29fe`:

| Check | Result |
| --- | --- |
| `web` | success |
| `mobile` | success |
| `migration-safety` | success |
| `field-security` | success |
| `preview-build` | success |
| `refresh-field-lock` | skipped (no field lock change) |

`migration-safety` includes the disposable PostgreSQL lifecycle rehearsal
(`scripts/ci/production-job-lifecycle-assertions.sql`) and the isolated
dump/restore rehearsal (`scripts/ci/verify-restore-postgres.sh`).

Because those required checks are green on the merge commit,
`repositoryChecks` is `PASS` in `release-gates.json`.

## What this does not change

Every other gate stays `UNKNOWN`:

- no staging migration or schema-parity run;
- no real two-workspace Supabase Auth/Storage run;
- no staging RLS run with real tokens;
- no running staging worker or provider execution;
- no physical Android capture/offline/sync run;
- no staging or production restore.

The release decision therefore remains **NO-GO** for customer-facing
production use. The green checks prove the repository gates pass on this SHA,
not that the product is ready for customers.
