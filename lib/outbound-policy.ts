export const QUIET_HOURS_START_HOUR = 8
export const QUIET_HOURS_END_HOUR = 20

export function isWithinQuietHours(now: Date = new Date(), timeZone?: string): boolean {
  const hour = timeZone
    ? Number(new Intl.DateTimeFormat('en-US', { hour: '2-digit', hour12: false, timeZone }).format(now))
    : now.getHours()
  return hour >= QUIET_HOURS_START_HOUR && hour < QUIET_HOURS_END_HOUR
}

export function quietHoursMessage(channel: 'call' | 'text' = 'text') {
  return `Outbound ${channel === 'call' ? 'calls' : 'texts'} are restricted to local quiet hours (${QUIET_HOURS_START_HOUR}:00 AM to ${QUIET_HOURS_END_HOUR}:00 PM).`
}

export function normalizeStrictE164(phone: string): string | null {
  const trimmed = phone.trim()
  if (/^\+1[2-9]\d{9}$/.test(trimmed)) return trimmed
  const digits = trimmed.replace(/[^0-9]/g, '')
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
  return null
}

export function strictPhoneMessage() {
  return 'Phone numbers must be +1NXXNXXXXXX.'
}
