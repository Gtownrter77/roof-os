# Changelog

All notable changes to ROOF/OS are documented here.

## [0.1.1] — 2026-10-08

### Production release

- Verified the live Vercel production deployment at <https://roof-os-lemon.vercel.app>.
- Confirmed the production deployment is **READY** and tracks `main` commit `ccfbf8d`.
- Confirmed the live site responds with the expected authentication redirect and security headers.
- Confirmed the post-merge GitHub Actions workflow passes all web, mobile, preview-build, migration-safety, and lock-refresh jobs.

### Verification and reliability

- Completed the three-level release audit with 28 regression scripts passing.
- Confirmed the Next.js production build compiles 111 routes successfully.
- Confirmed production dependency audit reports zero vulnerabilities.
- Added the AI chat regression test to the CI matrix and fixed its Node 22 TypeScript runtime invocation.
- Updated GitHub Actions to current Node 24-compatible action majors to remove Node 20 runtime migration warnings.

### Documentation

- Refreshed the current-state and Level 3 verification evidence to the actual production baseline.
- Recorded this release in the repository changelog.
