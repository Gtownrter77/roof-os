# Storm Theme Collection Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans task-by-task.

**Goal:** Build the six approved themes with real controls and preserved workflows.
**Architecture:** Extend device preferences; global procedural scene and isolated preview; existing live radar reused.
**Tech Stack:** Next.js, React, TypeScript, CSS/SVG, Web Audio. No new runtime dependency.
**Spec:** docs/superpowers/specs/2026-10-29-storm-themes-design.md

## Global Constraints
No paid assets, no production DB changes, no auth changes, no fabricated weather. Device-local preferences. OS motion preference respected. Explicit sound gesture only.

## Review Focus
Blocked storage; legacy toggle interoperability; preview cancellation; intro focus/keyboard; mobile overflow and motion/audio cleanup.

### Task 1: Preferences
Files: lib/theme/collection.ts, lib/theme/dashboard-skin.ts, scripts/theme-collection-test.mjs.
- [✓] Write runtime tests for migration, validation, persistence, denied storage and toggle compatibility; observe failure.
- [✓] Implement read/apply, safe prepaint bootstrap and remembered theme; run tests and existing dashboard/cinema suites.

### Task 2: Scene and controls
Files: components/ThemeScene.tsx, components/ThemeExperience.tsx, components/ThemePicker.tsx, components/useThemeCollection.ts, app/theme-collection.css, app/themes/page.tsx, app/layout.tsx, app/settings/page.tsx, components/DashboardSkinToggle.tsx.
- [✓] Add six distinct responsive scenes, preview/apply controls, preferences, session intro and synthesized opt-in audio.
- [✓] Apply global surfaces without intercepting business inputs; route chapters are navigation only.
- [✓] Verify typecheck/build and runtime/browser interaction tests at desktop/mobile, including motion/focus/persistence.

### Task 3: Integration and release
Files: package.json, .github/workflows/ci.yml, HANDOFF.md, ROOFOS-BUILD-CHECKLIST.md.
- [ ] Wire new suite into required web CI, update the living checklist and evidence.
- [ ] Run existing relevant suites/security/release/reliability; review branch; publish PR and wait for green checks.
- [ ] Merge authorized GitHub work only when green, then verify merged-main CI. No production SQL or manual deployment.
