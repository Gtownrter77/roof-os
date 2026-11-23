# Field capture wiring — design (2026-11-23)

Status: **DRAFT — awaiting owner approval**. Nothing in this document has been built.

## Intent and why

PR #497 merged the Hover capture contract (`lib/hover/capture.ts`) with the eight required
side/corner slots, GPS-in-file enforcement, reference-anchor requirement and blur/light gates.
No screen or upload path calls it. This work makes that contract reachable from the field app
(`apps/field/App.tsx`) and preserves its evidence through upload, so the merged contract is
actually used rather than dead code.

## Goals

1. A technician can select one of the eight Hover slots for each model photo and record a
   reference measurement (bar/door/garage/wall, value, ft/m) while offline.
2. The field app computes local blur and light scores and shows `validateCapture` feedback before
   submission: missing slots, duplicate slots, missing embedded GPS, quality recapture, missing reference.
3. Slot, GPS-in-file, blur score and light score survive the offline SQLite queue, the Supabase
   upload, and the Hover ingest path into `scan_images`.
4. No measurement is published from an incomplete or unanchored capture; `Unknown` stays `Unknown`.

## Non-goals

- No new reconstruction binaries, no hosted Supabase changes performed by this design (a migration
  is proposed, not applied), and no ground-truth calibration claimed.
- No changes to the existing `photo-estimate` approval authority or report route.
- No paid SDK, licensed data feed, GPU rental or commercial engine.

## Anti-goals

- Do not present an uncalibrated blur/light number as a validated quality guarantee.
- Do not fabricate GPS-in-file when stamping failed; the existing code already keeps such photos
  as manual evidence only.
- Do not write slot/score metadata into a table the ingest path never reads.

## Constraints

- Offline-first: SQLite queue and retry behavior must remain intact; no network required to capture.
- Existing GPS stamping in `capturePhoto` is authoritative and already verified on write.
- Field app is Expo 57 / React Native 0.86; dependencies currently include no image-decoding or CV library.
- Web code is subject to the Next.js agent rules in `AGENTS.md`; relevant docs must be read before edits.
- Owner checkpoint law: commit/push after every three verified batches, verify local/remote SHA match,
  never merge with a failing check.
- All 15 upstream Superpowers skills must be audited for this work package (ledger below).

## Approaches considered

| Approach | What it does | Trade-off |
|----------|--------------|-----------|
| A — guidance only | Slot picker + local `validateCapture`; metadata stays on phone | Smallest, but no server-side effect |
| B — A + upload mapping | Also persist and upload slot/GPS metadata, map into `scan_images` | End-to-end truth; touches local schema, upload and web route |
| C — B + on-device scoring | Adds real blur/light scores from image pixels | Highest fidelity; needs a pixel path and device evidence for thresholds |

**Owner selected C.** A and B are not alternatives to C here; C includes both. This document
records their content as the required baseline.

## How (builder decisions where the owner left it to me)

### 1. Capture UI

- Add `hoverSlot` state initialised to `null`; the camera button is disabled for model photos until
  a slot is chosen, or the picker is presented immediately before `ImagePicker.launchCameraAsync`.
- Add a reference-measurement panel with kind (from the contract's `bar`/`door`/`garage`/`wall`),
  numeric value > 0, and unit `ft`/`m`. Store it per draft, not per photo.
- Keep the existing photo album/caption UI; Hover slot is an additional field, not a replacement.

### 2. Local persistence

- Extend `inspection_photo_queue` through the existing `ensureLocalColumns` pattern with
  `hover_slot TEXT`, `gps_in_file INTEGER NOT NULL DEFAULT 0`, `blur_score REAL`, `light_score REAL`.
- Add a small local table `inspection_hover_anchors (id, draft_id, kind, value, unit, captured_at)`
  so reference measurements survive draft reload and offline retry.
- Do not retroactively mark existing rows as GPS-verified; default `gps_in_file = 0`.

### 3. On-device quality scores (the risky part)

- My call: use the already-installed `react-native-webview` to load a local HTML page containing a
  canvas, draw a downscaled copy of the retained JPEG, and compute:
  - blur: normalised Laplacian variance on a 64×64 grayscale sample;
  - light: normalised mean luminance on the same sample.
  Results return via `postMessage`; failures leave both scores `null` and are disclosed as unscored.
- The thresholds in `lib/hover/capture.ts` (blur 0.6, light 0.4) were written for a normalised
  0–1 signal. The WebView mapping must be documented and tested with synthetic images; real-device
  calibration is **not** claimed by this work package and remains a follow-up.
- No new dependency is added; if the WebView path proves unreliable on a device, the fallback is
  to keep scores `null` and surface "unscored — capture guidance only" in the UI.

### 4. Validation feedback

- Assemble `ScanImage[]` from the queued rows (`role: 'model'` for slotted photos, `gpsInFile` from
  the stored flag, scores from the stored values) and `ScaleAnchor[]` from the local anchors table.
- Call `validateCapture` and render its `missingSlots`, `rejectedImages`, `quality` and `reason` in
  the existing draft/detail screen. Never convert an `Unknown`/unscored value into a pass.
- Do **not** change the merged `validateCapture` or `buildInputManifest` behavior: existing tests
  assert that an unanchored manifest is allowed and that null scores pass `assessImageQuality`.
  Blocking publication stays with the downstream metric-status and scale gates; the field screen
  discloses status only. Changing those contracts would be a separate, approved work package.

### 5. Upload mapping

- Include `hover_slot`, `blur_score`, `light_score` in the `inspection_photos` upsert. **Do not** send a
  client `gps_in_file` value as authoritative: the server derives it from the byte-verifying
  provenance authority and writes that derived value into `scan_images`.
- Migration 111 already defines `scan_images.slot/gps_in_file/blur_score/light_score` and the RLS'd
  `scale_anchors` table. There is **no** new Hover table and no gap-fill migration for those objects.
  Migration 112 is only for the new `inspection_photos` columns.
- Add a `superseded_at`/`superseded_reason` pair to the local queue row. A recapture of a slot marks
  the old row superseded (file retained on disk) and the new row takes the slot; validation excludes
  superseded rows. This avoids a permanent duplicate-slot deadlock while keeping the evidence trail.
- **Owner decision:** ingest auto-creates one `scan_jobs` row per inspection draft on first upload,
  stores the UUID back on the draft, and uses it for all subsequent photos and anchors. This needs a
  server-side insert path with workspace RLS; the field app does not gain a job picker.
- Anchors upload with the draft sync using an idempotency key derived from workspace, draft, kind,
  value and unit; they go straight into `scale_anchors`. Fixed confidence is used for a
  human-entered reference and is recorded in the manifest so hashes stay reproducible.
- Extend the Hover ingest route so uploaded slotted rows become `scan_images` with server-derived GPS
  status and anchors become `scale_anchors`. The existing provenance route stays the byte-verifying
  authority.
- Also update `apps/field/src/localDb.web.ts` and its `test:field-localdb-web` gate for the new
  columns, supersede fields and anchors table.
- **Owner decision:** apply migration 112 before the field release; uploads may require the new
  columns. Applying it to a hosted project still needs the target project and credentials and is a
  separate release gate, not something this work package claims to have done.

### 6. Tests

- Field source-contract tests for slot picker, anchor persistence, score mapping, and the
  `validateCapture` call; RED → GREEN → REFACTOR with recorded output.
- Web contract test for the ingest mapping and a migration-order test for 112.
- Full `npm run test:all` plus field gate; SHA match before merge.

## What is left to the builder

Exact component layout, state variable names, query strings, message protocol, and test file names
are builder decisions. The owner must approve the WebView-canvas scoring call above before any
implementation begins, because it determines whether C is genuinely delivered or degrades to B.

## Upstream skill audit (owner directive, 15 skills)

`performed` = action taken here; `blocked` = exact limitation; `not triggered` = reviewed, condition absent.

1. `using-superpowers` — reviewed current inventory and selected skills | performed
2. `brainstorming` — this design, owner approach choice C | performed
3. `writing-plans` — pending after design approval | blocked: approval gate
4. `using-git-worktrees` — existing worktrees at `/home/rlongmbox/projects/roof-os` (main) and
   `/home/rlongmbox/projects/roof-os-hover-parity` will be used; SD3 mounting not relevant | performed
5. `test-driven-development` — RED→GREEN planned; no code written yet | blocked: approval gate
6. `systematic-debugging` — no failure in this work package yet | not triggered
7. `executing-plans` — pending after plan | blocked: approval gate
8. `subagent-driven-development` — fresh general-purpose builder-check subagent dispatched successfully
   (session `ses_df7b6959cffeTwkCZycVfAYcil`); it returned eight ranked questions, three of which
   required owner decisions and are resolved above | performed
9. `dispatching-parallel-agents` — tasks are sequential (UI → local schema → upload → ingest) | not triggered
10. `requesting-code-review` — pending after implementation | blocked: approval gate
11. `receiving-code-review` — no review feedback yet | not triggered
12. `verification-before-completion` — final checks planned, none claimed | blocked: approval gate
13. `finishing-a-development-branch` — PR/merge after green checks | blocked: approval gate
14. `writing-skills` — no skill file changes | not triggered
15. `diagnosing-superpowers` — no session failure to diagnose | not triggered
