// Parse the SHA-256 signing certificate fingerprint from apksigner output.
// Prefer the signer-specific label; accept only an unambiguous SHA-256 fallback.
export function extractSigningCertificateSha256(signatureReport) {
  const labeled = signatureReport.match(
    /Signer #1 certificate SHA-256 digest:\s*((?:[a-f0-9]{2}:){31}[a-f0-9]{2}|[a-f0-9]{64})/i,
  )
  if (labeled) {
    return {
      fingerprint: labeled[1].replaceAll(':', '').toLowerCase(),
      source: 'signer_label',
    }
  }

  const fallbackMatches = [
    ...signatureReport.matchAll(
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
