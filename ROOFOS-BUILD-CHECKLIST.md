# ROOF/OS Living Build Checklist

Markers: [ ] pending, [~] in progress, [✓] verified, [!] blocked, [—] out of scope.

## 2026-11-16 — Reviewed per-plane pitch and saved draft (PR #461)

- [✓] Source TDD RED: `43973583322` (test-only commit `943c7f3`) fails on missing reviewed-pitch schema. Source GREEN: `43974736857` all five jobs green on code-bearing commit `07bb0b7`.
- [✓] `/measure` permits saving measured pitch per accepted plane; supports uniform or mixed pitches and shows computed draft quantity from reviewed geometry.
- [✓] API stores human-reviewed numeric pitch separately from model note, checks scale, shape, explicit top-down and pitch attestations before immutable confirmation.
- [✓] Draft save API calculates quantity from the stored plane shapes and pitches rather than stale AI area; rejects changed previews and does not approve unverified AI edge lengths.
- [✓] Additive repository migration `102_reviewed_plane_pitch.sql` added, **NOT applied to live DB**.
- [!] Read-only Supabase Roof OS schema lacks new columns. **No merge or deployment while live DB is unmigrated.** Protected migration requires separate backup, staging and owner-approved production release.
- [~] Final documentation-commit CI, independent reviewer, full staged/live end-to-end and owner acceptance remain required. No field claim.

## 2026-11-16 — Dossier R2 roof-plane precision (PR #460)

- [✓] Test-first overlap/shared-edge/calibration regressions: observed RED in PR CI `43967807554` before implementation, then corrected and verified with full five-job green PR CI `43968942343` on source SHA `e9e65a8304df860e8b22be91dffbee1ac5c4ed07`.
- [✓] Reject cross-plane overlaps, containment and duplicate outlines in the manual trace and calibrated draft paths; prevent double-counted plan area.
- [✓] Exclude valid shared internal boundaries from summed plan-outline perimeter. This number is **not** inferred eave, gutter, ridge, hip or valley footage.
- [✓] Require reviewed geometry, top-down confirmation and explicit pitch confirmation before draft quantities; mixed pitch must supply each plane's measured pitch to the calculation helper.
- [✓] Manual drawing refuses an overlapping newly finished plane; supported geometry/area/perimeter tests run in PR CI.
- [~] Link per-plane pitch editing, evidence, approvals and persistence through the measurement UI and versioned record; mixed-pitch support is currently **calculation helper only**.
- [~] Verify real address-first imagery coverage, scale and legal attribution, classification of all roof edges, actual site pitch and owner-rule estimate integration; do not require photo where real aerial can be obtained and do not invent imagery.
- [!] Customer/field operational approval remains blocked by production-auth, full staging/restore, provider, device and owner acceptance gates. GitHub CI is not field certification.

## 2026-10-29 — Storm theme collection

- [✓] Six theme choices: Professional, Tornado Alley, Storm Tracker 11, Hail Core, Lightning Front, After the Storm.
- [✓] Global theme preference: page roots, shell, navigation and panels use the selected scene and palette. Login initializes Storm Tracker 11 only when no explicit preference exists.
- [✓] Existing Professional/Storm quick toggle remembers the chosen storm. Preferences are device/browser-local, not account synchronization.
- [✓] Original detailed imagery; Atlanta skyline command-center plate; balanced darker exposure; CSS 3D pointer parallax, camera moves, lighting, radar sweep, hail effects.
- [✓] Preview without applying, Escape/skip and focus return; session intro, motion preferences, OS reduced motion, low-power mode.
- [✓] Opt-in local storm ambience, mute, stop on hidden tab/unmount; no paid sound service.
- [✓] Real 36-second 1280×720 H.264/AAC trailer, generated storm sound, native playback controls, pause on hidden tab.
- [✓] Runtime preference tests and browser tests: six themes, saved choice, cross-tab, denied storage, mobile layout, audio, video, preview focus.
- [✓] Existing auth, radar, dashboard weather, settings, security, release, reliability and production gate checks pass locally.
- [✓] Implementation PR #370 merged as `4623a3e549504122144d8e61cc3afa800c41719e`; PR CI `40823969333` and post-merge main CI `40824724249` passed.
- [✓] Both reviews completed; the hidden-tab issue was fixed before merge. The later corrupted-preference suggestion is addressed with parser/prepaint regressions and a validated saved-choice helper.

Verification snapshots name the tested implementation SHA. Follow-up preference-recovery changes must also pass their attached GitHub CI before merge.
- [!] Runway authentication verified: connected Free workspace exposes no video models. Actual actor/video generation requires a paid plan. No purchase or generation credits used.
- [—] Rigged 3D actor/lip-sync or full fluid/cloth/weather simulation: not produced by still artwork and camera effects.

Source/UI evidence is separate from authenticated production workflows, Supabase, field-device and provider execution. This checkpoint does not change the existing release NO-GO decision.

## 2026-11-01 — PR #374 merge remediation

- [✓] Preserve pre-fix head `a1ea24d` at `backup/pr374-before-audit-fix-a1ea24d`.
- [✓] Reproduce field audit failure, replace vulnerable glob/minimatch with exact upstream patches `14.0.2`/`11.0.1`, regenerate the lockfile, clean-install and pass the existing audit. Existing pinned build-only zod risk acceptance is unchanged; this is not a zero-vulnerability claim.
- [✓] Run roof-slope and estimate-creation tests and require both in the web CI job.
- [✓] Exercise the real estimate POST handler with a synthetic Supabase boundary: reject malformed items before writes, preserve draft defaults and totals, and attempt cleanup on line-write failure. Regression tests exposed and now prevent non-string item-code crashes and overflowing numeric totals.
- [✓] Regenerate the web lockfile with patched follow-redirects/qs and selector-parser, preserving platform selectors. The production audit no longer reports its former high/moderate findings.
- [✓] Correct stale navigation assertions after template-first creation replaced inline creation; continue requiring detail, edit, and new-estimate destinations.
- [~] Final repair commit must pass GitHub PR checks against current main before merge; post-merge main CI must also pass.

Local handler/source checks do not verify Supabase Auth/Storage or deployed database policies. Hosted migration-safety uses disposable PostgreSQL only. Preview readiness does not prove authenticated production workflows. No production database, authorization, or approval controls are relaxed by this repair.
