/**
 * Recipients for mailto:/sms: links must not be percent-encoded (that breaks
 * @ and +), but customer-controlled values must not be able to inject extra
 * URL query parameters or headers. These helpers strip control/reserved
 * characters while keeping ordinary addresses and phone numbers readable.
 */
export function safeMailtoRecipient(value: unknown): string {
  if (typeof value !== 'string') return ''
  const cleaned = value.replace(/[\r\n]/g, '').trim()
  return /^[^\s?&#%@/,;]+@[^\s?&#%@/,;]+\.[^\s?&#%@/,;]+$/.test(cleaned) ? cleaned : ''
}

export function safeSmsRecipient(value: unknown): string {
  if (typeof value !== 'string') return ''
  // Keep dialable characters only; drop CR/LF and URL-reserved separators.
  return value.replace(/[\r\n]/g, '').replace(/[^0-9+()\-.\s]/g, '').trim()
}
