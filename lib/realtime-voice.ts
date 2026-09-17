export type RealtimeVoiceTransport = 'livekit-sip' | 'asterisk-websocket' | 'twilio-media-streams'
export type RealtimeVoiceEventType = 'session.started' | 'audio.input' | 'transcript.final' | 'response.started' | 'response.audio' | 'response.cancel' | 'barge_in' | 'tool.call' | 'tool.result' | 'handoff' | 'session.ended'

export type RealtimeVoiceEvent = {
  eventId: string
  sessionId: string
  workspaceId: string
  type: RealtimeVoiceEventType
  sequence: number
  occurredAt: string
  payload: Record<string, unknown>
}

export type RealtimeToolCall = {
  name: 'lookup_lead' | 'propose_appointment' | 'book_appointment' | 'create_follow_up' | 'request_human'
  callId: string
  arguments: Record<string, unknown>
}

export type RealtimeSessionPolicy = {
  transport: RealtimeVoiceTransport
  allowBargeIn: boolean
  maxTurnMs: number
  maxSilenceMs: number
  transferOnLowConfidence: boolean
  requireHumanApprovalForPayment: boolean
  requireHumanApprovalForEstimate: boolean
}

export const DEFAULT_REALTIME_POLICY: RealtimeSessionPolicy = {
  transport: 'livekit-sip',
  allowBargeIn: true,
  maxTurnMs: 20_000,
  maxSilenceMs: 1_200,
  transferOnLowConfidence: true,
  requireHumanApprovalForPayment: true,
  requireHumanApprovalForEstimate: true,
}

export function isBargeIn(event: RealtimeVoiceEvent) {
  return event.type === 'barge_in' || event.type === 'response.cancel'
}

export function validateEvent(event: RealtimeVoiceEvent) {
  if (!event.eventId || !event.sessionId || !event.workspaceId) throw new Error('Realtime event identifiers are required')
  if (!Number.isInteger(event.sequence) || event.sequence < 0) throw new Error('Realtime event sequence must be a non-negative integer')
  if (!event.occurredAt || Number.isNaN(Date.parse(event.occurredAt))) throw new Error('Realtime event timestamp is invalid')
  return event
}
