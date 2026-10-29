# ROOF/OS Living Build Checklist

Markers: [ ] pending, [~] in progress, [✓] verified, [!] blocked, [—] out of scope.

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
- [~] Feature PR CI, review, authorized merge and merged-main CI.
- [!] Runway authentication verified: connected Free workspace exposes no video models. Actual actor/video generation requires a paid plan. No purchase or generation credits used.
- [—] Rigged 3D actor/lip-sync or full fluid/cloth/weather simulation: not produced by still artwork and camera effects.

Source/UI evidence is separate from authenticated production workflows, Supabase, field-device and provider execution. This checkpoint does not change the existing release NO-GO decision.
