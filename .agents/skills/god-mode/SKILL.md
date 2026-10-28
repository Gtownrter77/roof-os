---
name: god-mode
description: Optional owner-only sandbox for Roof OS — removes repetitive approvals for authorized experimentation without bypassing production security.
version: 1.0.0
author: roof-os-agent
compatible:
  opencode: ">=2.1.4"
  codex: true
tags: [sandbox, owner-only, experimental, god-mode, authorization]
---

# God Mode — Owner-Only Sandbox (Optional)

Only the repository/system owner may activate. Never grants production authorization bypass. Removes repetitive approvals for sandbox experiments.

Requirements:
- Must pass `is_system_owner_check()` (matches `is_workspace_admin` with owner workspace).
- Must set `ENV=SANDBOX` and disable production migrations.
- Must keep `REPLICA` / production DB untouched.
- Must emit audit record to `agent_runs` with `approval_state: sandbox_only`.
- Must be disabled by default; enabled only via `god-mode-activate.mjs` script.

Security guarantee: God Mode never disables RLS, never edits applied migrations, never connects to production DB, never disables REA.

Disabled by design on this branch. Loading this skill does NOT activate God Mode.
