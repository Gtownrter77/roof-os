# ROOF/OS Automation Agents

ROOF/OS should use four bounded automation agents. Each agent is an auditable worker with deterministic rules first and optional local open-source language-model assistance second. The system must continue to function when no model is configured.

## Agent 1: Intake and Lead Router

**Trigger:** New lead, inbound form, imported contact, or changed lead address.

**Actions:** Normalize phone/email, detect duplicate contacts, assign a workspace pipeline stage, create a first-response task, and suggest an owner using round-robin or territory rules.

**Model option:** Ollama running a small instruction model for extracting names, addresses, and intent from free text. Deterministic validation remains authoritative.

## Agent 2: Scheduler and Follow-up Coordinator

**Trigger:** New lead, completed inspection, overdue task, or status transition.

**Actions:** Suggest the next appointment, create follow-up tasks, detect calendar conflicts, and remind assigned users. It should never send an external message or reschedule a customer without a configured approval rule.

**Model option:** No model required for the first release. Use deterministic scheduling rules and optional local text generation for the reminder draft.

## Agent 3: Inspection Quality Agent

**Trigger:** Inspection completion or photo upload batch completion.

**Actions:** Check for required photo categories, missing captions, failed uploads, duplicate files, and incomplete checklist items. Create a review task when evidence is incomplete.

**Model option:** Open-source vision models can classify image categories later. The initial release should use metadata and checklist rules so quality checks are free and explainable.

## Agent 4: Office Copilot and Report Agent

**Trigger:** Inspection marked complete, status changed to report pending, or user requests a summary.

**Actions:** Assemble a draft inspection summary, list deficiencies, summarize activity, identify missing data, and prepare a report draft for human approval.

**Model option:** Ollama or another self-hosted open-source model. Keep report generation behind an approval state and store the prompt version, model name, and output in `agent_runs`.

## Runtime design

- Run deterministic triggers in Supabase Edge Functions or a small background worker.
- Use Postgres changes or scheduled jobs to enqueue work.
- Keep agent configuration in the workspace database.
- Use an `agent_runs` audit record for every attempt, including trigger, status, model, input reference, output, error, and approval state.
- Use a local Ollama deployment for zero per-token cost when model assistance is needed. A hosted model is optional and must be configured separately.
- Do not let agents bypass RLS. Background workers should use a narrowly scoped service role only after validating workspace and record ownership.
- Enforce idempotency with a unique event key and retry status.
- Never auto-send customer communications, sign contracts, approve estimates, or submit payments without an explicit human approval rule.

## Recommended first implementation

Start with Agents 1–3 because they provide immediate operational value without requiring a model. Add Agent 4 after the inspection schema and photo metadata are live. The free/open-source path is deterministic TypeScript plus optional Ollama; it does not require paid agent APIs, but it does require a persistent host if Ollama is used continuously.
