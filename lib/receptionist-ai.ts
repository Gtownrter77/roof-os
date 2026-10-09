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
  const ollamaHost = process.env.OLLAMA_HOST?.trim() || 'http://localhost:11434'
  try {
    const res = await fetch(`${ollamaHost}/api/generate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: process.env.OLLAMA_MODEL || 'llama3:8b',
        prompt: `System: You are the ROOF/OS AI receptionist for a roofing company. Return strict JSON with reply, intent (schedule, follow_up, payment_request, human, question, opt_out, or unknown), and optional requestedDateTime, callerName, address.\nCaller: ${input.transcript}`,
        format: 'json',
        stream: false,
      }),
    })
    if (res.ok) {
      const data = await res.json()
      if (data.response) return fromParsed(JSON.parse(data.response) as Partial<ReceptionistTurn>)
    }
  } catch {
    // Local model is down. Rule engine only. No paid API.
  }
  return ruleTurn(input.transcript)
}
