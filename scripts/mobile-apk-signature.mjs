// Parse the SHA-256 signing certificate fingerprint from apksigner output.
// Prefer certificate-labeled digests; never confuse the public-key digest with the certificate.
export function extractSigningCertificateSha256(signatureReport) {
  const normalizedReport = signatureReport.replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, '')
  const certificateMatches = [
    ...normalizedReport.matchAll(
      /(?:Signer\s+#\d+\s+)?certificate\s+SHA-?256(?:\s+digest)?\s*:\s*((?:[a-f0-9]{2}:){31}[a-f0-9]{2}|[a-f0-9]{64})/gim,
    ),
  ]
  const certificateFingerprints = [...new Set(
    certificateMatches.map((match) => match[1].replaceAll(':', '').toLowerCase()),
  )]
  if (certificateFingerprints.length === 1) {
    return {
      fingerprint: certificateFingerprints[0],
      source: certificateMatches.some((match) => /^Signer\s+#\d+/i.test(match[0]))
        ? 'signer_label'
        : 'certificate_label',
    }
  }
  if (certificateFingerprints.length > 1) {
    throw new Error('APK signing output contains multiple certificate SHA-256 fingerprints; refusing an ambiguous identity')
  }

  // Older/tool-wrapped output may omit the word "certificate". Keep the fallback
  // conservative: public-key SHA-256 lines are not certificate identities.
  const fallbackLines = normalizedReport
    .split(/\r?\n/)
    .filter((line) => !/public\s+key/i.test(line))
  const fallbackMatches = [
    ...fallbackLines.join('\n').matchAll(
      /SHA-?256(?:\s+digest)?[^\r\n]*?((?:[a-f0-9]{2}:){31}[a-f0-9]{2}|[a-f0-9]{64})/gi,
    ),
  ]
  const fingerprints = [...new Set(
    fallbackMatches.map((match) => match[1].replaceAll(':', '').toLowerCase()),
  )]
  if (fingerprints.length === 1) {
    return { fingerprint: fingerprints[0], source: 'fallback' }
  }
  if (fingerprints.length > 1) {
    throw new Error('APK signing output contains multiple SHA-256 fingerprints; refusing an ambiguous identity')
  }
  throw new Error('APK signing certificate SHA-256 fingerprint is missing')
}
