# Local security mitigation for deepmerge 4.3.1

Based on [TehShrike/deepmerge v4.3.1](https://github.com/TehShrike/deepmerge/tree/v4.3.1) (MIT license).

**Why:** [GHSA-gcqx-w48m-w2h4](https://github.com/advisories/GHSA-gcqx-w48m-w2h4) / CVE-2026-93753 describes prototype poisoning through the `mergeObject()` path. As of this patch, no upstream patched release is documented.

**Patch:** Replace default external `is-mergeable-object` with an equivalent inline predicate; filter `__proto__`, `constructor` and `prototype` from all enumerated source and target keys before copying or recursively merging. Keep upstream behavior for ordinary keys, arrays, symbols and `all`.

**Security gate:** `scripts/test-field-deepmerge-mitigation.cjs` verifies that the installed module resolves to this vendored code and tests hostile objects. The field audit accepts only this exact locked override when these tests pass, and continues to fail on any other unresolved medium/high/critical advisory.

Replace with a verified upstream patched dependency when available, after re-running runtime and dependency audits. Do not remove the audit gate as a workaround.
