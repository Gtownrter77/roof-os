# MANDATORY CHECKPOINT LAW

## **CHECKPOINT AFTER EVERY 3 COMPLETED WORK BATCHES — MAXIMUM**

This is a user-directed operating rule for future ROOF/OS work. One “batch” is a coherent, verifiable unit of code, tests, or documentation—not an individual file.

1. A batch is complete only after its relevant checks pass.
2. **After every 3 completed, verified batches, commit and push the accumulated work to its correct GitHub branch or PR. Do not let a 4th completed batch accumulate.**
3. After every push, independently compare the local commit SHA (`git rev-parse HEAD`) with the remote branch SHA (`git ls-remote`). They must match.
4. Update `HANDOFF.md` with the checkpoint SHA, results, open blockers, and next action.
5. **Checkpoint earlier** if the user asks, before a handoff or long pause, before switching tasks/devices, at a major milestone, before merging, or before any broad, risky, or destructive action. Preserve and verify a remote backup ref before a broad or risky rewrite.
6. Never merge a PR while any required check is pending or failing. Do not bypass branch protection.
7. Do not claim production readiness from local or preview results. Keep production database and deployment evidence separate; record authorization blockers rather than guessing.

## Checkpoint record

For each push, record:

- Commit message and full SHA.
- Feature branch / PR URL.
- Exact local checks run and results.
- Remote SHA match result.
- Pending CI, production, database, security, or human-approval gates.
- The next action.

**Default frequency: after every third completed and verified work batch, and sooner at the checkpoints listed above.**
