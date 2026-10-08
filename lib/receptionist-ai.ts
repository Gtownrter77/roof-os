import OpenAI from 'openai'

export type ReceptionistIntent = 'schedule' | 'follow_up' | 'payment_request' | 'human' | 'question' | 'opt_out' | 'unknown'
export type ReceptionistTurn = { reply: string; intent: ReceptionistIntent; requestedDateTime?: string; callerName?: string; address?: string }

export async function generateReceptionistTurn(input: { transcript: string; callerPhone?: string; history?: string[] }): Promise<ReceptionistTurn> {
  const ollamaHost = process.env.OLLAMA_HOST?.trim() || 'http://localhost:11434'
  const apiKey = process.env.OPENAI_API_KEY?.trim()

  // Primary open-source local Ollama inference endpoint
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
      if (data.response) {
        const parsed = JSON.parse(data.response) as Partial<ReceptionistTurn>
        const allowed: ReceptionistIntent[] = ['schedule', 'follow_up', 'payment_request', 'human', 'question', 'opt_out', 'unknown']
        const intent = allowed.includes(parsed.intent as ReceptionistIntent) ? parsed.intent as ReceptionistIntent : 'unknown'
        return {
          reply: typeof parsed.reply === 'string' && parsed.reply.trim() ? parsed.reply.trim() : 'I can connect you with a team member to help.',
          intent,
          requestedDateTime: typeof parsed.requestedDateTime === 'string' ? parsed.requestedDateTime : undefined,
          callerName: typeof parsed.callerName === 'string' ? parsed.callerName : undefined,
          address: typeof parsed.address === 'string' ? parsed.address : undefined,
        }
      }
    }
  } catch {
    // Fall through to configured API or rule engine
  }

  if (apiKey) {
    const client = new OpenAI({ apiKey })
    const completion = await client.chat.completions.create({
      model: process.env.RECEPTIONIST_AI_MODEL || 'gpt-4o-mini',
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: [
            'You are the ROOF/OS AI receptionist for a roofing company.',
            'Be concise, warm, and transparent that you are an automated assistant.',
            'You may help schedule an inspection or follow-up, capture lead details, answer basic business questions, request a human transfer, or create a payment-request intent.',
            'Never quote prices, change invoice balances, approve estimates or supplements, promise coverage or start dates, or collect card/bank credentials.',
            'For payment requests, say a secure payment link can be sent; never ask for payment credentials.',
            'If the caller opts out of calls or messages, return intent opt_out and acknowledge the request.',
            'Return JSON with reply, intent, and optional requestedDateTime, callerName, and address. intent must be schedule, follow_up, payment_request, human, question, opt_out, or unknown.',
          ].join(' '),
        },
        ...(input.history || []).slice(-8).map((message) => ({ role: 'user' as const, content: message })),
        { role: 'user', content: input.transcript },
      ],
    })
    const raw = completion.choices[0]?.message.content
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<ReceptionistTurn>
      const allowed: ReceptionistIntent[] = ['schedule', 'follow_up', 'payment_request', 'human', 'question', 'opt_out', 'unknown']
      const intent = allowed.includes(parsed.intent as ReceptionistIntent) ? parsed.intent as ReceptionistIntent : 'unknown'
      return {
        reply: typeof parsed.reply === 'string' && parsed.reply.trim() ? parsed.reply.trim() : 'I can connect you with a team member to help.',
        intent,
        requestedDateTime: typeof parsed.requestedDateTime === 'string' ? parsed.requestedDateTime : undefined,
        callerName: typeof parsed.callerName === 'string' ? parsed.callerName : undefined,
        address: typeof parsed.address === 'string' ? parsed.address : undefined,
      }
    }
  }

  // Deterministic rule engine fallback if model endpoints are unreachable
  const text = input.transcript.toLowerCase()
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
