# REA execution ledger — Day 15

Issue: #336. Machine-readable form: [`rea-ledger.json`](./rea-ledger.json). Study it supports: [CapOut public-behavior study](./capout-public-study.md).

This ledger records what was actually run in this environment. It separates completed runs from failed and unavailable ones. No entry claims a runtime observation that did not happen.

## Environment

| Item | Value |
| --- | --- |
| Host | Debian 13 |
| Node | 24.22.1 |
| REA CLI | `6.8.0` (`/home/rlongmbox/.local/bin/rea`) |
| REA skill | `reverse-engineer-anything`, version 49 |
| Client registration | OpenCode, `/home/rlongmbox/.config/opencode/opencode.jsonc` |
| Workspace | `/mnt/shared/removable/SD3/roof-os-current` |

`rea doctor --client opencode --json` returned `healthy: true` and `environment_healthy: false`. Registration is healthy. Hopper, Ghidra, IDA, JADX, and Kuna are missing. The JavaScript analyzer was the only usable provider for this target.

## Completed

### 1. Public documentation retrieval

Ten public pages were fetched over HTTPS without authentication. All returned `200`. The saved copies, byte counts, SHA-256 digests, and source URLs are in the JSON ledger.

Pages: `llms.txt`, quickstart, upload, structured imports, download ESX, realtime updates, claims, MCP overview, API reference overview, document status.

This is reading, not reverse engineering. It establishes the documented contract that the study compares against.

### 2. REA static analysis — Mintlify runtime bootstrap

Command:

```bash
rea analyze-javascript-application /tmp/opencode/rea-capout-runtime \
  --detail summary \
  --evidence_output /tmp/opencode/rea-runtime-evidence.json \
  --json
```

- Exit code `0`
- Evidence id `ev_73175a99a3fb8c5e03aa83cce08550901abc2d60a557d1341ac3593b96e2bfae`
- 1 file, 1,358 bytes, 433 AST nodes, 8 findings
- 11 graph nodes, 10 edges, 0 routes
- Authority `shipped-artifact`, confidence `derived`

Result: inert bootstrap code. No product behavior.

### 3. REA static analysis — main documentation bundle

Command:

```bash
rea analyze-javascript-application /tmp/opencode/rea-capout-index \
  --detail summary \
  --evidence_output /tmp/opencode/rea-index-evidence.json \
  --analysis-timeout-ms 900000 \
  --json
```

- Exit code `0`, wall time about four minutes
- Evidence id `ev_bcababac417cf81892b8ad59a37b9ae429463f7a86a96194fd68cf2911a623a9`
- 1 file, 748,194 bytes, 171,250 AST nodes, 905 findings
- Semantic graph: 20,000 nodes, 16,187 relations, 20,000 unknowns
- Route inventory: 0 routes, 0 occurrences
- Authority `shipped-artifact`, confidence `derived`

Both semantic caps were reached: `max_semantic_nodes_per_file=20000` and `max_semantic_unknowns_per_file=20000`. The graph is therefore truncated, not exhaustive. The analyzer's own limitation list applies:

- Graph coverage is incomplete; unavailable facts are not absence.
- JavaScript was parsed as inert text; bundle bootstrap code was never executed.
- Static imports and endpoints do not prove runtime execution.
- Static paths may stay unresolved when expressions are dynamic.

A direct text search of the same three public assets found zero occurrences of `api.capout.ai`, `capout-api-key`, `upload/json`, `ws/token`, `esx`, or `mcp.capout`. The docs bundle contains documentation chrome, not the product client. That is a finding about the docs site only.

## Failed

### First combined analyzer run

The first attempt pointed the analyzer at the whole download directory. The caller timed out at 300,000 ms before the CLI finished, and no evidence bundle was written. It is recorded as failed and its output is not used. Remediation: split into one input per bundle and set `--analysis-timeout-ms 900000`.

## Unavailable

| Capability | Reason | Remediation |
| --- | --- | --- |
| `rea capture-browser-scenario` | Playwright Chromium headless shell downloaded, but `libnspr4.so`, `libnss3.so`, `libnssutil3.so` are missing. Installing them needs root, which this task forbids. | Supply a working browser or install NSS/NSPR, then run a declared scenario. |
| `rea analyze-web-bundle` | Needs a loopback CDP endpoint and target id from a running browser. | Same browser prerequisite. |
| `rea inspect-web-page` | Same CDP prerequisite. | Same browser prerequisite. |
| Authenticated CapOut observation | Out of scope by owner instruction; no account or key used. | Separate authorization required. |
| CapOut product internals | Clean-room boundary excludes proprietary source, private endpoints, pricing, and ESX internals. | Not a goal. |

## What this ledger does not prove

- It does not prove CapOut extraction quality, accuracy, carrier coverage, or ESX contents.
- It does not prove the docs site behaves the same as the product.
- It does not establish any fact beyond public prose and inert static structure.

## Reproducibility

Large bundles stay in `/tmp/opencode` and are not committed. The ledger records SHA-256 digests and evidence ids, so a reviewer can tell whether a later run used the same bytes.
