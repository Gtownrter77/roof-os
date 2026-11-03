# ROOF/OS Agent Runtime

`agent-runtime.ts` is the shared deterministic runtime contract for the four bounded agents. It provides two primitives:

- `heartbeat(...)` records worker identity, version, capabilities, status, and last-seen time.
- `run(...)` enforces the workspace/agent/event idempotency key, records running/succeeded/failed states, preserves outputs, and supports approval states.

Pass `reviewTaskCreatorId` when constructing the runtime in a deployed worker. If a handler throws, the runtime records the failed run and creates an open task assigned to that user. The worker identity must still be validated by deployment configuration; this module does not choose an owner implicitly.

The module is intentionally infrastructure-neutral. It can run in a Supabase Edge Function, a scheduled worker, or a persistent process. The worker must receive `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` through the deployment secret manager; neither value belongs in the mobile bundle or browser code.

## Readiness checklist

Each agent is ready only after its worker:

1. Starts with a versioned heartbeat.
2. Validates workspace ownership before processing an event.
3. Calls `run` with a stable event key.
4. Writes a successful or review-required `agent_runs` record.
5. Writes a failed record and creates a human review task on error.
6. Passes a two-workspace isolation test.
7. Has an explicit approval boundary for outbound messages, estimates, contracts, and payments.

The runtime scaffold does not pretend that a worker is deployed. Deployment and live heartbeat evidence are still required before shipment.

## Registry and heartbeat verification

`agent-registry.ts` is the source-of-truth registry for the four bounded automation agents. It records whether a worker implementation and entry point actually exist. The protected `/api/cron/heartbeat` route is heartbeat-only: it reads the latest service-side heartbeat for every workspace and evaluates freshness without self-attesting a worker as healthy or executing any action.

The probe reports `worker_not_registered`, `heartbeat_missing`, `heartbeat_stale`, `worker_not_healthy`, or `worker_stopped` when evidence is insufficient. A source registration is not production proof. Production readiness still requires a deployed worker to write a fresh healthy heartbeat, an idempotent `agent_runs` record, a failure review task, and a two-workspace isolation result. Intake Router and Office Copilot now have source workers, but remain pilot-only until those external gates are demonstrated.
