# Storm theme collection evidence — 2026-10-29

Baseline: `949594ba0d9d1d2574636a5dde34d16c1d4c2a53`.
Branch: `feat/storm-theme-collection-20261029`.
Rollback branch: `backup/pre-storm-theme-collection-20261029`.

## Source and UI checks

- `npm run test:theme-collection`: PASS. Six choices, invalid input, legacy migration, storage denial, quick-toggle compatibility and route chapters. Legacy cinema storage failure reproduced before repair and passed after repair.
- Existing cinema, dashboard-skin, auth-flow, radar-source, dashboard-weather, workspace-settings, frontend-route-integrity, security, reliability, release-check and production-job-gate: PASS locally.
- Production Next.js build and TypeScript: PASS locally.
- `scripts/theme-browser-test.cjs`: Playwright/Chromium tested actual production-rendered UI at 1440×1000 and 390×844 with synthetic Supabase configuration. Six Apply actions, preview does not save, Escape/focus restore, reload/cross-tab persistence, OS motion precedence, low power, actual AudioContext start/mute, 36s video playback, first-login default, Professional quick toggle, no horizontal overflow and denied-storage fallback.
- Review found trailer sound continued on a hidden tab. A browser assertion reproduced this before the visibility pause listener; rerun after the listener passed before publishing.
- Browser rendering is not authenticated business-flow or physical Pixel/Chromebook proof. Existing real NOAA/NWS radar integration is reused; no radar-feed availability claim is inferred from artwork.

## Media

`public/themes/roofos-storm-trailer.mp4`: ffprobe verifies 36 seconds, H.264 1280×720 video and AAC audio. FFmpeg renders original images with camera moves, six cuts/fades, titles and original synthesized wind/bass/impact audio. No licensed music or provider calls.

Theme backgrounds use original image-generation artwork, CSS 3D transforms and separate light/sweep/particle layers. The meteorologist is a photographic plate, not a rigged or lip-synced character. The scene follows the active route's chapter; route navigation is not evidence that a business action occurred.

Runway connection verified: its Free workspace exposes no video models. The account requires a paid plan for actual generated actor/video motion. No task, purchase or credit usage occurred.

## Release

Full required PR and post-merge CI must be recorded by the GitHub run attached to the final SHA. No production SQL, credentials, providers, login policy or payment behavior changed. A GitHub hosting integration may create automatic previews/deployments; this change does not perform a manual deploy.
