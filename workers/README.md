# ROOF/OS Agent Runtime

`agent-runtime.ts` is the shared deterministic runtime contract for the four bounded agents. It provides two primitives:

- `heartbeat(...)` records worker identity, version, capabilities, status, and last-seen time.
- `run(...)` enforces the workspace/agent/event idempotency key, records running/succeeded/failed states, preserves outputs, and supports approval states.

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
