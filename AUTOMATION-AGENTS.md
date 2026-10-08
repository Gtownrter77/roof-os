# ROOF/OS Automation Agents

ROOF/OS should use four bounded automation agents. Each agent is an auditable worker with deterministic rules first and optional local open-source or hosted AI language/vision model assistance second. The system must continue to function when no model is configured.

## Agent 1: Intake and Lead Router

**Trigger:** New lead, inbound form, imported contact, or changed lead address.

**Actions:** Normalize phone/email, detect duplicate contacts, assign a workspace pipeline stage, create a first-response task, and suggest an owner using round-robin or territory rules.

**Model option:** Ollama or Gemini model for extracting names, addresses, and intent from free text. Deterministic validation remains authoritative.

## Agent 2: Scheduler and Follow-up Coordinator

**Trigger:** New lead, completed inspection, overdue task, or status transition.

**Actions:** Suggest the next appointment, create follow-up tasks, detect calendar conflicts, and remind assigned users. It should never send an external message or reschedule a customer without a configured approval rule.

**Model option:** No model required for the first release. Use deterministic scheduling rules and optional local text generation for the reminder draft.

## Agent 3: Inspection Quality Agent

**Trigger:** Inspection completion or photo upload batch completion from web or mobile field app.

**Actions:** Check for required photo categories (pitch gauge, eave/drip edge, shingles, slope damage), missing captions, failed uploads, duplicate files, and incomplete checklist items. Automatically create a review task when evidence is incomplete.

**Model option:** Gemini / vision model contract verification to tag damage types and shingle conditions. The rules enforce strict non-authoritative bounds (no direct carrier decision output without technician signoff).

## Agent 4: Office Copilot and Report Agent

**Trigger:** Inspection marked complete, status changed to report pending, or user requests a summary.

**Actions:** Assemble a draft inspection summary, list deficiencies, summarize activity, identify missing data, and prepare a report draft for human approval.

**Model option:** Ollama or hosted model. Keep report generation behind an approval state and store the prompt version, model name, and output in `agent_runs`.

## Mobile Field App Top-Level AI Automation Features

1. **AI Vision Damage Contract (Gemini AI Integration):**
   - Strictly structured schema contract for analyzing roof & siding photos.
   - Extracts pitch estimation, shingle type/wear, facet detection, and storm damage tagging.
   - Output rules enforce non-authoritative claims (never output raw pitch degrees or binding carrier coverage decisions directly without human approval).

2. **Inspection Quality Agent (Agent 3):**
   - Automatically evaluates photo batch completeness upon upload from the field app.
   - Detects missing required categories (e.g. pitch gauge, drip edge, hail damage) or uncaptioned photos.
   - Automatically generates an idempotent review task for the inspector when evidence is incomplete.

3. **Offline Resilient AI Queue:**
   - Field photos and local notes captured offline in SQLite are automatically processed upon network reconnection.
   - AI vision processing and feature extraction run through an authenticated backend route without exposing API keys to the mobile client.

4. **Speech-to-Text Voice Site Notes:**
   - Integrated Web Speech API / MediaRecorder interface allowing field technicians to dictate site notes hands-free, auto-categorized into inspection findings.

5. **AI Receptionist & Inbound Lead Bridge:**
   - Automated Twilio voice/SMS receptionist AI captures customer reports and populates inspection leads directly into the field inspector's task queue.

## Runtime design

- Run deterministic triggers in Supabase Edge Functions or a small background worker.
- Use Postgres changes or scheduled jobs to enqueue work.
- Keep agent configuration in the workspace database.
- Use an `agent_runs` audit record for every attempt, including trigger, status, model, input reference, output, error, and approval state.
- Use an `agent_worker_heartbeats` table to track agent readiness and health continuously.
- Do not let agents bypass RLS. Background workers should use a narrowly scoped service role only after validating workspace and record ownership.
- Enforce idempotency with a unique event key and retry status.
- Never auto-send customer communications, sign contracts, approve estimates, or submit payments without an explicit human approval rule.
