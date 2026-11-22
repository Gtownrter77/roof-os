// PostgREST signals "no rows matched" for a `.single()` query as a PGRST116
// error with `data: null`, not as a null error. Keeping that distinction in one
// tested helper prevents a genuinely unknown call session from being reported
// as a retryable server failure.
export function sessionLookupFailureStatus(error: { code?: string } | null, hasSession: boolean): 404 | 503 | null {
  if (error?.code === 'PGRST116') return 404
  if (error) return 503
  if (!hasSession) return 404
  return null
}

// Deduplicate only the exact trailing caller+assistant pair. A bare
// `includes(callerLine)` matched any earlier utterance, so a caller repeating
// "yes" or "no" in the same call had that turn silently dropped. Checking the
// trailing pair still prevents a Twilio retry from appending the same turn
// twice while preserving legitimate repeated speech with a different reply.
export function shouldAppendTurn(transcript: string | null | undefined, callerLine: string, assistantLine: string): boolean {
  if (!transcript) return true
  return !transcript.trimEnd().endsWith(`${callerLine}\n${assistantLine}`)
}
