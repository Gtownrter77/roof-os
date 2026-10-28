# Docling verification on GitHub-hosted worker

The workflow .github/workflows/claims-worker-ci.yml builds the existing Docling
container on a GitHub-hosted Ubuntu runner. It checks the HTTP health endpoint,
rejects a forbidden HTTPS source origin, creates a synthetic PDF without
customer data, and uses the actual Docling DocumentConverter to extract and
assert the text of that synthetic PDF.

The same run also asserts structured output: `pages[]` must be non-empty, every
page number must come from Docling provenance and be at least 1, and the
expected text must appear in the structured pages. This is a real Docling
execution on a synthetic PDF, not an accuracy test on a carrier document.

It is triggered by PR changes to the worker or test workflow, or by an
authorized manual workflow dispatch. It does not require apt, sudo, Docker,
PostgreSQL or models on the low-memory Chromebook.

Local contract tests (`scripts/pdf-normalizer-test.mjs`) exercise the
normalizer and the worker/route contracts without Docker or Docling. Only the
GitHub-hosted job executes Docling.

This is a disposable CI worker test, not a persistent private parsing service.
It does not prove end-to-end signed Supabase Storage document ingestion,
multi-tenant authorization, CapOut provider operation, live PDF accuracy,
production deployment, or customer readiness. Those have separate gates.

No CapOut API key is needed. No production SQL, deployment, owner Break Glass,
God Mode, Agent 4, REA skills or OpenCode configuration is changed.
