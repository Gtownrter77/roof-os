# MANDATORY CHECKPOINT LAW

## **EVERY COMPLETED WORK BATCH MUST BE SAVED TO GITHUB IMMEDIATELY**

This is a user-directed operating rule for every future ROOF/OS task.

1. A work batch is complete only after its relevant checks pass.
2. **Immediately after each completed code, test, or documentation batch, commit and push it to the correct feature branch or pull request. Do not wait until the entire task, session, or day is finished.**
3. After every push, independently compare the local commit SHA (`git rev-parse HEAD`) with the remote branch SHA (`git ls-remote`). They must match.
4. Update `HANDOFF.md` in the same checkpoint with the commit, check results, open blockers, and next action.
5. **No more than one verified batch may remain only in a local sandbox.** If a check fails, fix it before declaring the batch complete; preserve the work locally and promptly push once verified.
6. Never merge a PR while any required check is pending or failing. A PR merge is the route to `main`; do not bypass branch protections.
7. Before a broad or risky rewrite, preserve a remote backup ref and verify its SHA.
8. Do not claim production readiness from local or preview results. Keep production database and deployment evidence separate, and record authorization blockers rather than guessing.

## Checkpoint record

For each checkpoint, record:

- Commit message and full SHA.
- Feature branch / PR URL.
- Exact local checks run and results.
- Remote SHA match result.
- Any pending CI, production, database, security, or human-approval gate.
- The next action.

**The frequency is after every completed work batch. “At the end” is not compliant.**
