# ROOF OS Release Foreman: enforced merge discipline

## What the checks establish

- GitHub Actions validates the proposed branch on a combined base before merging: web, mobile, preview-build, migration-safety and field-security.
- `scripts/release-foreman-check.mjs` fails the required web job when a run command is duplicated or the dependency security audit is removed.
- `scripts/worker-heartbeat-runtime-test.mjs` executes the existing `workers/heartbeat.ts` helper with synthetic errors, duplicate workspace IDs and status transitions. It is **not** a real database test.
- One security mitigation belongs on main. Follow-up feature PRs must be rebased to the current main with their shared fixes stripped out; run CI on the rebased commit before merge.
- A green individual PR before earlier merges is not proof that the integration candidate works. Merge sequentially, then confirm the new main SHA and main CI.

## Branch rule gap requiring owner action

At review time, the active `main` GitHub ruleset required `web`, `mobile` and `migration-safety`, **not** `field-security`. The connector can inspect but cannot edit repository rulesets.

**Owner action:** [Edit main ruleset](https://github.com/Gtownrter77/roof-os/rules/24434629) to add the `field-security` status check as required. Until that is confirmed, the web job also runs the same security audit to ensure the **already required** web gate fails if the Expo vulnerability returns. Running a security check in two jobs is intentional defense in depth; copying the patch into multiple feature branches is not.

## Evidence boundary

- Source tests, CI jobs, real database tests, physical-device tests and production deployment are separate evidence levels.
- Do not present a marker-only test, workflow containing only `echo`, or source SQL review as real runtime/integration verification.
- Do not edit historical migrations already applied to a database to make new staging environments pass; use a new migration or a documented bootstrap step with migration-order review.
- The existing `.github/workflows/staging-migration-verify.yml` is the repository staging workflow. Do not introduce a second misleading no-op migration workflow.
- Migration 059 estimate-approval authorization and the owner-only God Mode specification are **not** covered by these PRs. Do not imply database verification or God Mode activation.

## Merge sequence

1. Identify PR dependencies and compare the changed paths against main.
2. Remove duplicate shared patches; preserve only the PR-specific changes.
3. Run GitHub Actions for the rewritten combined candidate, including the independent `field-security` check.
4. Never bypass a red or pending required status, and never force a merge through branch rules.
5. Merge only with the PR head SHA pinned; confirm the merge result, the main commit and post-merge CI.
6. Record what remains UNKNOWN rather than calling it PASS.
