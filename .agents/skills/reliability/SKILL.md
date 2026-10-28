---
name: reliability
description: Agent reliability framework for Roof OS — challenge fixes, evidence-gating, source-vs-DB distinction, unresolved risks.
version: 1.0.0
author: roof-os-agent
compatible:
  opencode: ">=2.1.4"
  codex: true
tags: [reliability, security, debugging, adversarial, evidence-gating]
---

# Agent Reliability Skill — Roof OS

Used: systematic-debugging, adversarial review, evidence-gating, regression testing.

Rules (persistent, reusable):
1. Challenge every fix before claiming complete. Must identify root cause (Phase 1), compare patterns (Phase 2), test minimally (Phase 3), implement once (Phase 4).
2. Distinguish source-tested from database-tested explicitly in every report.
3. Preserve RLS, API auth, DB authorization; never disable security to pass a test.
4. Report unresolved risks; do not hide gaps behind passing source tests.
5. Use new migrations only; never edit applied migrations to avoid production drift.
6. Keep experimental / YOLO / sandbox paths separate from production authorization.

Evidence-gating: every claim needs a file path + line number + result (PASS/FAIL/UNVERIFIED).

Compatible: OpenCode (enhancement to AGENTS.md), Codex (.cursorrules reference), REA (read-only evidence), local Ollama (optional model, disabled by default).

Memory: framework lives in `.agents/skills/`; settings preserved in `.opencode/`; REA server unchanged.
