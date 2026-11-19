## 2026-11-19 — Owner lockout sequence merged and field APK dispatched

- PR #490 merged as `b6c1dee2138cbd481e7b0e86b93623bfc06e1d8d` (owner-set lockout/tagout sequences for estimate approval).
- Rule: owner decides the sequence (e.g. self → inspector → owner). AI builds the estimate; tech tags locks only if correct. Send (email/text) stays locked until every required step is tagged.
- Field APK dispatched from this exact SHA: [run 44464708613](https://github.com/Gtownrter77/roof-os/actions/runs/44464708613). Build completed successfully (Expo validation, local EAS Android preview, binary identity/signature verification, provenance, artifact upload).
- Artifact: [roof-os-field-preview-b6c1dee2138cbd481e7b0e86b93623bfc06e1d8d](https://github.com/Gtownrter77/roof-os/actions/runs/44464708613/artifacts/14502365379). Version `0.5.0`, package `com.roofos.field`, version code `46`, size `73,559,500` bytes.
- APK SHA-256: `f4d2a0ffa7c7848b482476e5100b2fe7c6a70f465f422c1561f1156c515c1e4b`. Signing certificate SHA-256: `7a1c64b0a0bdae5ac87aef821ee7d6a6a56a6ec21ef53c249149b8e90b74868f`. Provenance reports signature verification true and EAS CLI `27.2.0`.
- On-device AI stays disabled by design. Physical-device install and live two-workspace isolation remain unverified.
- Next: owner physical install verification of the new APK; continue remaining open issues (e.g. #468 picomatch advisory).

## 2026-11-18 — Owner location is the measurement gate

- PR #484 merged as `a5b40e84e7b7c7e428338281201c0138fe5d7778`. PR #461 (reviewed plane pitch) is already on main.
- Rule: owner allows location. GPS is written into the photo. That photo can be measured and becomes an estimate. No location permission, or no GPS in the file, means the photo is evidence only. No measurement starts from it.
- Device location is never stamped in place of missing EXIF. A photo without embedded GPS is kept and marked manual-only.
- Next: dispatch `ROOF OS Mobile APK` from this merged SHA and record the artifact.

[... rest of file preserved from main ...]