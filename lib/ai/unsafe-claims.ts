export class UnsafeAIClaimError extends Error {
  constructor(readonly path: string) {
    super(`Unsafe AI claim detected at ${path}`)
    this.name = 'UnsafeAIClaimError'
  }
}

const UNSAFE_CLAIM_PATTERN = /(?:\$\s*\d|\b(?:USD|pricing|price quote|estimated cost|coverage approved|claim payable|claim approved|claim denied|code violation|code compliant|code determination|certified measurement|verified measurement|exact pitch|authoritative(?: measurement| quantity)?|guaranteed|engineered)\b)/i

/**
 * Rejects unsafe prose emitted by a model while allowing numeric formulation
 * fields. Numeric values are validated by the geometry/measurement contracts;
 * this scanner protects the separate authority and commercial boundary.
 */
export function rejectUnsafeClaims(value: unknown, path = 'root'): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => rejectUnsafeClaims(item, `${path}[${index}]`))
    return
  }
  if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      if (key === 'authority_disclaimer') continue
      rejectUnsafeClaims(item, `${path}.${key}`)
    }
    return
  }
  if (typeof value === 'string' && UNSAFE_CLAIM_PATTERN.test(value)) {
    throw new UnsafeAIClaimError(path)
  }
}
