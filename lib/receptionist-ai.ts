import { askOllamaJson } from './ai/ollama.ts'

export type ReceptionistIntent = 'schedule' | 'follow_up' | 'payment_request' | 'human' | 'question' | 'opt_out' | 'unknown'
export type ReceptionistTurn = { reply: string; intent: ReceptionistIntent; requestedDateTime?: string; callerName?: string; address?: string }

const ALLOWED: ReceptionistIntent[] = ['schedule', 'follow_up', 'payment_request', 'human', 'question', 'opt_out', 'unknown']

function fromParsed(parsed: Partial<ReceptionistTurn>): ReceptionistTurn {
  const intent = ALLOWED.includes(parsed.intent as ReceptionistIntent) ? parsed.intent as ReceptionistIntent : 'unknown'
  return {
    reply: typeof parsed.reply === 'string' && parsed.reply.trim() ? parsed.reply.trim() : 'I can connect you with a team member to help.',
    intent,
    requestedDateTime: typeof parsed.requestedDateTime === 'string' ? parsed.requestedDateTime : undefined,
    callerName: typeof parsed.callerName === 'string' ? parsed.callerName : undefined,
    address: typeof parsed.address === 'string' ? parsed.address : undefined,
  }
}

function ruleTurn(transcript: string): ReceptionistTurn {
  const text = transcript.toLowerCase()
  let intent: ReceptionistIntent = 'unknown'
  if (text.includes('human') || text.includes('operator') || text.includes('person')) intent = 'human'
  else if (text.includes('schedule') || text.includes('inspection') || text.includes('appointment')) intent = 'schedule'
  else if (text.includes('pay') || text.includes('invoice') || text.includes('bill')) intent = 'payment_request'
  else if (text.includes('stop') || text.includes('unsubscribe') || text.includes('cancel')) intent = 'opt_out'
  return {
    reply: 'Thanks for calling Roof OS. I am an automated assistant and can help schedule an inspection or connect you with a team member.',
    intent,
  }
}

export async function generateReceptionistTurn(input: { transcript: string; callerPhone?: string; history?: string[] }): Promise<ReceptionistTurn> {
  const result = await askOllamaJson<Partial<ReceptionistTurn>>([
    'You are the ROOF/OS AI receptionist for a roofing company.',
    'Return only JSON with reply, intent (schedule, follow_up, payment_request, human, question, opt_out, or unknown), and optional requestedDateTime, callerName, address.',
    'Never promise a booking, payment, contract, estimate, or external message. A human approval step is required for those actions.',
    `Caller transcript: ${input.transcript.slice(0, 4000)}`,
  ].join('\n'), { timeoutMs: 1_500 })
  if (result?.value) return fromParsed(result.value)
  return ruleTurn(input.transcript)
}
