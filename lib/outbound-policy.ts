export const QUIET_HOURS_START_HOUR = 8
export const QUIET_HOURS_END_HOUR = 20

export function isWithinQuietHours(now: Date = new Date(), timeZone?: string): boolean {
  let hour: number
  if (timeZone) {
    try {
      const parts = new Intl.DateTimeFormat('en-US', {
        hour: '2-digit', hour12: false, timeZone,
      }).formatToParts(now)
      // en-US hour12:false renders midnight as 24; normalize it to 0.
      hour = Number(parts.find((part) => part.type === 'hour')?.value ?? '24') % 24
    } catch {
      hour = now.getHours()
    }
  } else {
    hour = now.getHours()
  }
  return hour >= QUIET_HOURS_START_HOUR && hour < QUIET_HOURS_END_HOUR
}

export function quietHoursMessage(channel: 'call' | 'text' = 'text') {
  return `Outbound ${channel === 'call' ? 'calls' : 'texts'} are restricted to local quiet hours (${QUIET_HOURS_START_HOUR}:00 AM to ${QUIET_HOURS_END_HOUR}:00 PM).`
}

export function normalizeStrictE164(phone: string): string | null {
  const trimmed = phone.trim()
  if (/^\+1[2-9]\d{2}[2-9]\d{6}$/.test(trimmed)) return trimmed
  const digits = trimmed.replace(/[^0-9]/g, '')
  const nationalNumber = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits
  if (/^[2-9]\d{2}[2-9]\d{6}$/.test(nationalNumber)) return `+1${nationalNumber}`
  return null
}

export function strictPhoneMessage() {
  return 'Phone numbers must be +1NXXNXXXXXX.'
}
