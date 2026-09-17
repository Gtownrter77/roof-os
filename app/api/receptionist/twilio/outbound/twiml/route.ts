import { NextRequest } from 'next/server'
import { speechGather, twiml, assertTwilioRequest } from '../../../../../../lib/receptionist-twilio'

export async function POST(request: NextRequest) {
  const params = Object.fromEntries((await request.formData()).entries()) as Record<string, string>
  try {
    assertTwilioRequest(request, params)
    const message = new URL(request.url).searchParams.get('message') || 'This is a follow-up from Roof OS.'
    const publicUrl = process.env.RECEPTIONIST_PUBLIC_URL?.trim() || new URL(request.url).origin
    return twiml(speechGather(`${publicUrl}/api/receptionist/twilio/turn`, message))
  } catch (error) {
    return new Response(error instanceof Error ? error.message : 'Invalid Twilio request', { status: 403 })
  }
}
