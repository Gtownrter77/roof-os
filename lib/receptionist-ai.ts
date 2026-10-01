import OpenAI from 'openai'

export type ReceptionistIntent = 'schedule' | 'follow_up' | 'payment_request' | 'human' | 'question' | 'opt_out' | 'unknown'
export type ReceptionistTurn = { reply: string; intent: ReceptionistIntent; requestedDateTime?: string; callerName?: string; address?: string }

export async function generateReceptionistTurn(input: { transcript: string; callerPhone?: string; history?: string[] }): Promise<ReceptionistTurn> {
  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (!apiKey) throw new Error('OPENAI_API_KEY is required for receptionist dialogue')
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
  if (!raw) throw new Error('Receptionist model returned no content')
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
