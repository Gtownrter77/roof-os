# BAILEY BOSS Parallel research — anonymous/free-only integration

## Scope (2026-11-15)

The new /research page and POST /api/research/parallel use the **anonymous-only** Parallel MCP endpoint `https://mcp.parallel.ai/mcp?tools=web_search`. No API key, OAuth, billing credentials, REST Search API, or paid web_research tool is used. An authenticated BAILEY account is required to use the page.

The app's existing NWS, NCEI, Nominatim, OpenStreetMap/Overpass and imagery pathways are unchanged. Parallel is a supplementary public web-source discovery tool, not a replacement, a roof measurement source, or confirmation of storm damage, insurance entitlement, local code, or supplier pricing.

The UI warns users not to send private customer records to third-party research; input is limited to 180 characters and results to eight clickable HTTP(S) sources. Server requests have bounded timeouts and responses. The user must independently verify official sources. Parallel provider outages return an error, rather than silently falling back to a paid API.

## Control

`PARALLEL_ANONYMOUS_RESEARCH_ENABLED=false` disables the optional search feature. Otherwise its anonymous-only endpoint is available for authenticated users. Neither the app nor this feature provides paid Parallel access. Do not add credentials or sign-in variants without explicit owner approval and a separate code/security review.

## Verification and comparison

Run `node --experimental-strip-types scripts/parallel-anonymous-test.mjs`; it mocks HTTP and sends **no** Parallel calls. GitHub's `parallel-free-research` workflow runs this same regression.

Compare the same public, non-sensitive prompts against the existing BAILEY sources. Suggested pilot: roofing manufacturer installation docs, jurisdiction building-code publication, official NOAA/NWS storm event reference, public product specifications, and publicly listed supplier information. Track source authority, freshness, citation validity, coverage, and latency. Use only existing free resources; no paid API benchmark trials. Review independently and record sources rather than claiming accuracy from one run.

## Release evidence

The regression proves only request wiring and no-key transport under a mocked response. Live anonymous MCP connectivity, production deployment, real source relevance, runtime rate limits, privacy policy, CI, and cross-workspace load are **not** verified until tested separately. Keep live-release status distinct from source completion.
