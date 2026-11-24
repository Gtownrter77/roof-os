// adjuster_messages is the thread of record. Memo keys group a day's notes;
// idempotency keys make appends replay-safe.

import type { AdjusterNote } from '../types.ts'
import { foreignKeysForNote, messageIdempotencyKey } from '../queue/index.ts'

export function memoKey(claimId: string, day: string): string {
  return `memo:${claimId}:${day}`
}

/** Append a note once. A repeated idempotency key is a no-op, never a duplicate. */
export function appendMessage<T extends AdjusterNote>(messages: T[], note: T): { messages: T[]; added: boolean } {
  if (messages.some((existing) => existing.idempotencyKey === note.idempotencyKey)) {
    return { messages, added: false }
  }
  return { messages: [...messages, note], added: true }
}

/** Normalize a note before it is written: FK-safe ids and an explicit key. */
export function prepareNote(note: Omit<AdjusterNote, 'idempotencyKey' | 'leadId' | 'identityId'> & {
  leadId?: string | null
  identityId?: string | null
}): AdjusterNote {
  const keys = foreignKeysForNote({
    claimId: note.claimId,
    leadId: note.leadId,
    identityId: note.identityId,
  })
  const prepared: AdjusterNote = {
    ...note,
    leadId: keys.leadId,
    identityId: keys.identityId,
    idempotencyKey: messageIdempotencyKey(note),
  }
  return prepared
}
