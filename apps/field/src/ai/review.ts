export type AiReviewStatus = 'suggested' | 'accepted' | 'corrected' | 'rejected' | 'superseded'

export type AiReviewState = {
  reviewStatus: AiReviewStatus
  reviewerValue: Record<string, unknown> | null
  rejectionReason: string | null
  reviewedAt: string | null
}

const reviewedAt = () => new Date().toISOString()

function requireRecord(value: Record<string, unknown>): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('A corrected AI value must be an object.')
  return value
}

export function validateAiReviewState(state: AiReviewState): void {
  const terminal = state.reviewStatus !== 'suggested'
  if (terminal && !state.reviewedAt) throw new Error('Reviewed AI states require a review timestamp.')
  if (state.reviewStatus === 'corrected' && !state.reviewerValue) throw new Error('Corrected AI suggestions require a reviewer value.')
  if (state.reviewStatus === 'rejected') {
    if (!state.rejectionReason?.trim()) throw new Error('A rejection reason is required.')
  } else if (state.rejectionReason !== null) {
    throw new Error('A rejection reason is only valid for rejected suggestions.')
  }
  if (state.reviewStatus === 'suggested' && (state.reviewerValue !== null || state.reviewedAt !== null)) {
    throw new Error('Suggested AI observations cannot contain review data.')
  }
}

export function acceptAiSuggestion(): AiReviewState {
  const state = { reviewStatus: 'accepted' as const, reviewerValue: null, rejectionReason: null, reviewedAt: reviewedAt() }
  validateAiReviewState(state)
  return state
}

export function correctAiSuggestion(value: Record<string, unknown>): AiReviewState {
  const state = { reviewStatus: 'corrected' as const, reviewerValue: requireRecord(value), rejectionReason: null, reviewedAt: reviewedAt() }
  validateAiReviewState(state)
  return state
}

export function rejectAiSuggestion(reason: string): AiReviewState {
  const normalized = reason.trim()
  if (!normalized || normalized.length > 1000) throw new Error('A rejection reason is required and must be 1000 characters or fewer.')
  const state = { reviewStatus: 'rejected' as const, reviewerValue: null, rejectionReason: normalized, reviewedAt: reviewedAt() }
  validateAiReviewState(state)
  return state
}

/** AI review never creates or mutates an authoritative measurement. */
export function canBecomeMeasurementCandidate(state: AiReviewState): boolean {
  validateAiReviewState(state)
  return state.reviewStatus === 'accepted' || (state.reviewStatus === 'corrected' && state.reviewerValue !== null)
}
