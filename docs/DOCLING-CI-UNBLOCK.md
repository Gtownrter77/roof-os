# Docling verification on GitHub-hosted worker

The workflow .github/workflows/claims-worker-ci.yml builds the existing Docling
container on a GitHub-hosted Ubuntu runner. It checks the HTTP health endpoint,
rejects a forbidden HTTPS source origin, creates a synthetic PDF without
customer data, and uses the actual Docling DocumentConverter to extract and
assert the text of that synthetic PDF.

It is triggered by PR changes to the worker or test workflow, or by an
authorized manual workflow dispatch. It does not require apt, sudo, Docker,
PostgreSQL or models on the low-memory Chromebook.

This is a disposable CI worker test, not a persistent private parsing service.
It does not prove end-to-end signed Supabase Storage document ingestion,
multi-tenant authorization, CapOut provider operation, live PDF accuracy,
production deployment, or customer readiness. Those have separate gates.

No CapOut API key is needed. No production SQL, deployment, owner Break Glass,
God Mode, Agent 4, REA skills or OpenCode configuration is changed.
