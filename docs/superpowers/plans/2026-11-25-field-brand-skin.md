# ROOF/OS Field APK brand skin implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: use `subagent-driven-development` or `executing-plans`. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Make the field APK read as the same ROOF/OS product as the web dashboard: red roof brand mark, red primary action, dark glass panels, cyan ops labels, and colored status chips. Skin only — no behavior, safety, data, or permission changes. No new dependency, no paid service.

**Architecture:** All visual work stays in `apps/field/App.tsx` (one shared `StyleSheet` plus two tiny presentational helpers) and `apps/field/app.json` (native appearance). React Native cannot consume the web CSS gradients directly, and `expo-linear-gradient` is not installed, so gradients are approximated with solid brand colors plus border/shadow glow — the same cues that make the web UI distinctive. A new source-contract gate locks the look in.

## Tokens copied from the web app (`app/globals.css:5,36-77`)

- Background `#050812`; panel `#0a1428` with border `rgba(103,136,184,.36)`.
- Cyan `#16b8ff` (brand accent / ops label), green `#19eb77`, amber `#ffb21a`, red `#f32c33`.
- Primary CTA red `#f32c33` with red glow; secondary is a translucent slate fill.
- Brand mark: three skewed red roof bars; wordmark `ROOF` + red `OS`, sublabel `FIELD OPERATIONS`.

## Tasks

### 1. Failing contract gate first (TDD)

- [ ] Add `"test:mobile-visual-contract": "node scripts/mobile-visual-contract-test.mjs"` to root `package.json` near `test:mobile-release-contract`. `scripts/test-all.mjs:21-24` auto-discovers `test:*` gates, so no registry edit is needed.
- [ ] Create `scripts/mobile-visual-contract-test.mjs` using `node:assert/strict` + `readFileSync`, following the existing source-gate style of `scripts/mobile-release-contract-test.mjs`. Assert against `apps/field/App.tsx` and `apps/field/app.json`:
  - a `function BrandMark(` helper exists and the authenticated header renders `<BrandMark` inside `styles.brandLockup`;
  - `colors` contains `brand: '#f32c33'`, `panel: '#0a1428'`, `line: 'rgba(103, 136, 184, .36)'`, and `amber: '#ffb21a'`;
  - `styles.primary` and `styles.cameraButton` use `colors.brand` and a red `shadowColor`;
  - `styles.card` and `styles.authCard` use `colors.panel` and `colors.line`;
  - `styles.sectionTitle` has a brand-colored left accent;
  - `styles.statusChip` exists and the render uses it for sync status;
  - `StatusBar style="light"` and `app.json` has `"userInterfaceStyle": "dark"`;
  - the auth screen renders `<BrandMark` and `styles.brandLockup`;
  - `apps/field/package.json` still has no `expo-linear-gradient` dependency (skin must not add packages).
- [ ] Run `npm run test:mobile-visual-contract`; it must FAIL before any UI edit. Commit only the test + package.json script if desired, or keep together with task 2.

### 2. Shared tokens and brand mark

- [ ] In `apps/field/App.tsx:79-88`, extend `colors` with `brand: '#f32c33'`, `panel: '#0a1428'`, `line: 'rgba(103, 136, 184, .36)'`, `amber: '#ffb21a'`. Keep every existing key; no call site may break.
- [ ] Add a `BrandMark({ size = 30 })` presentational component near `Metric` (`apps/field/App.tsx:2065`) that renders three absolutely positioned skewed red bars inside a `View`, mirroring `.brand-mark span` at `app/globals.css:77`. Use `transform: [{ skewY: '-28deg' }]`; no images, no new library.
- [ ] Add `brandMark`, `brandBar`, `brandLockup`, `brandName`, `brandAccent`, `brandSub` styles.

### 3. Header, hero, and status chips

- [ ] Replace the plain eyebrow in the authenticated header (`apps/field/App.tsx:1295-1307`) with `brandLockup` containing `<BrandMark />`, `ROOF` + red `OS`, and `FIELD OPERATIONS`; keep the existing `Owner / inspector` title, online/offline subtitle, avatar, and sign-out control untouched in behavior.
- [ ] Add `statusChip`, `statusChipText`, and tone variants (`statusGreen`, `statusAmber`, `statusRed`, `statusBlue`) to the stylesheet. Wrap the existing sync status line (`apps/field/App.tsx:1372-1374`) in a chip whose tone is derived from the same booleans already used there; string content stays identical.
- [ ] Restyle the SOS button (`apps/field/App.tsx:1285-1287`) with a red alert-chip look; leave its `tel:911` handler and copy unchanged. Foreman and radar buttons keep secondary styling.
- [ ] Give `sectionTitle` and `cardTitle` a 3px `colors.brand` left accent and padding, matching the web panel heading accent.

### 4. Glass surfaces, red primary, auth screen

- [ ] Change `hero`, `card`, `authCard`, `metric`, `input`, `inputHalf`, `passwordContainer`, and `authTabRow` to use `colors.panel` / `colors.line` with a subtle dark shadow (`shadowColor`, `shadowRadius`, `elevation`). Keep radii and padding so layout does not shift materially.
- [ ] Change `primary` and `cameraButton` to `backgroundColor: colors.brand` + red `shadowColor: 'rgba(255, 22, 37, .35)'`, `shadowRadius: 12`, `elevation: 6`. `primaryText` stays white/800.
- [ ] Change switch `trackColor` in `apps/field/App.tsx:1464,1479` to `false: '#26344a'`, `true: '#0c85e8'`; thumb stays cyan. Do not touch the preference state, defaults, or accessibility labels.
- [ ] Add `BrandMark` + `brandLockup` above `authTitle` in `AuthScreen` (`apps/field/App.tsx:1891-1896`), keeping "ROOF/OS FIELD" copy available in the sublabel. Keep all auth handlers, modes, and copy intact.
- [ ] Change `StatusBar style="dark"` to `style="light"` (`apps/field/App.tsx:1283`) and `"userInterfaceStyle": "light"` to `"dark"` (`apps/field/app.json:8`) so system chrome matches the dark app.

### 5. Verify

- [ ] `npm run test:mobile-visual-contract` PASS.
- [ ] `npm run test:mobile-release-contract` and `npm run test:mobile-auth` PASS (no copy/handler regressions).
- [ ] `npm run typecheck` PASS and `(cd apps/field && npx tsc --noEmit)` PASS (field tsconfig covers native code).
- [ ] `npm run test:all` PASS; `git diff --check` clean.
- [ ] Build/run proof: if an EAS/local Android build is available in this environment, build the APK and confirm it launches; otherwise record that the APK was **not** built here and physical-device appearance remains UNVERIFIED. Never claim a visual fix is device-proven from source gates alone.

### 6. Integrate

- [ ] Commit with a focused message (`style(field): align APK with ROOF/OS brand`), push a branch, open a PR, wait for all checks green, then squash-merge into `main` under the owner's granted authority.
- [ ] Update no release-gate evidence to PASS on account of this skin change; `physicalDevice` stays UNKNOWN.
