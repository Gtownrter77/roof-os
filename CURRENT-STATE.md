# Roof-OS Application Architecture & System State

**Current System Baseline Audit Timestamp**: October 2026
**Commit Identifier**: `3fa30cd` / `main`

---

## Executive Summary & Baseline

Roof-OS is an enterprise-grade roofing business operations, claims estimation, automated photo pipeline, and AI agent platform built with Next.js, TypeScript, Tailwind CSS, Supabase, and Expo (`apps/field`).

---

## Key System Accomplishments

### 1. 10-Minute Automated Photo-to-Report Pipeline Engine (`lib/ai/photo-pipeline-engine.ts`)
- **Address Disambiguation**: EXIF/OCR geolocation address matching producing 3–6 candidate addresses for field human verification.
- **Tri-Fork Parallel Execution**:
  - **Fork A**: Open-source aerial SAM vectorization + live Home Depot materials pricing + labor + dumpster fee + adjustable profit margin slider (company hold margin).
  * **Fork B**: NOAA 10-year storm dates query for wind/hail parameters.
  * **Fork C**: Statutory International Residential Code (IRC) building code lookup.
- **Technician Authorization & Instant Dispatch**: 1-click confirmation by field tech with immediate Email and SMS dispatch to customer in under 10 minutes, complete with SHA-256 cryptographic audit signature.

### 2. Multi-Agent Background Daemon & Admin Superuser Guardrail (`workers/all-agents-daemon.ts`)
- **4 Bounded Automation Agents**:
  - `intake_router`: Inbound lead normalization and territory assignment.
  - `scheduler`: Appointment conflict detection and follow-up tasks.
  - `inspection_quality`: Photo category checklist & evidence validation.
  - `office_copilot`: Inspection draft summary & report approval state.
- **Superuser Capability Engine (`lib/ai/agent-superuser-guardrail.ts`)**: Gated by Workspace Admin authentication (`andjustice4all_3770`). Auto-signing contracts and bulk price overrides require explicit admin passcode authorization.

### 3. Mobile Field App AI Suite (`apps/field/src/aiFieldSuite.ts`)
- **125 Mobile AI Features**: Computer vision hail/wind severity, voice dictation parsing, canvassing propensity radar, inclinometer pitch gauge, material deficit prediction, OSHA heat safety advisor, and dumpster tonnage calculator.

### 4. Open-Source AI Receptionist (`lib/receptionist-ai.ts`)
- Local Ollama inference (`llama3:8b`), OpenWhisper speech-to-text fallback, E.164 phone normalization, TwiML fallback, TCPA quiet hours, and 24-hr Stripe checkout links.

---

## 3-Level Verification Compliance

- **Level 1 (Security & Code Integrity)**: `release-check.mjs` & `security-check.mjs` pass cleanly across all API routes.
- **Level 2 (Workflow & Agent Integrity)**: `verify-all-agents.ts` and `agent-runtime-test.mjs` verified.
- **Level 3 (Production Build)**: `npm run build` succeeds cleanly for 111 static/dynamic routes.
