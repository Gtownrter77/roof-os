import twilio from 'twilio'

export function requireTwilioConfig() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim()
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim()
  const phoneNumber = process.env.TWILIO_PHONE_NUMBER?.trim()
  if (!accountSid || !authToken || !phoneNumber) throw new Error('TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER are required')
  return { accountSid, authToken, phoneNumber }
}

export function assertTwilioRequest(request: Request, params: Record<string, string>) {
  const { authToken } = requireTwilioConfig()
  const signature = request.headers.get('x-twilio-signature')
  if (!signature) throw new Error('Missing Twilio signature')
  const url = new URL(request.url).toString()
  if (!twilio.validateRequest(authToken, signature, url, params)) throw new Error('Invalid Twilio signature')
}

export function xmlEscape(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')
}

export function twiml(body: string) {
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response>${body}</Response>`, { headers: { 'Content-Type': 'text/xml; charset=utf-8' } })
}

export function speechGather(action: string, prompt: string) {
  return `<Gather input="speech" action="${xmlEscape(action)}" method="POST" speechTimeout="auto" language="en-US"><Say>${xmlEscape(prompt)}</Say></Gather><Say>I did not hear anything. Goodbye.</Say><Hangup/>`
}
