// Recorded estimate acceptance and deposit state.
//
// The database owns the evidence: accepted amounts and timestamps are copied from
// the approved estimate by a trigger, and every deposit event is append-only.
// This module only derives the current deposit state from those events. It never
// collects a signature, never charges a card and never invents a balance.

export type DepositEventType = 'requested' | 'received' | 'waived' | 'refunded'

export type DepositEvent = {
  id?: string
  event_type: DepositEventType
  amount: number | string
  occurred_at: string
  method?: string | null
  reference?: string | null
  note?: string | null
}

export type DepositStatus = 'none' | 'requested' | 'received' | 'waived' | 'refunded'

export type DepositState = {
  status: DepositStatus
  label: string
  acceptedTotal: number
  requestedAmount: number
  receivedAmount: number
  refundedAmount: number
  /** Requested but not yet received. */
  outstandingAmount: number
  /** Received and not refunded. */
  appliedAmount: number
  eventCount: number
  nextAllowedEvents: DepositEventType[]
  problem: string | null
}

const toNumber = (value: number | string): number => {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

const roundMoney = (value: number): number => Math.round(value * 100) / 100

const LABELS: Record<DepositStatus, string> = {
  none: 'No deposit recorded',
  requested: 'Deposit requested',
  received: 'Deposit received',
  waived: 'Deposit waived',
  refunded: 'Deposit refunded',
}

export function deriveDepositState(acceptedTotal: number | string, rawEvents: DepositEvent[]): DepositState {
  const total = roundMoney(Math.max(0, toNumber(acceptedTotal)))
  const events = [...rawEvents].sort((a, b) => {
    const byTime = new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime()
    if (byTime !== 0) return byTime
    return String(a.id ?? '').localeCompare(String(b.id ?? ''))
  })

  let requestedAmount = 0
  let receivedAmount = 0
  let refundedAmount = 0
  let status: DepositStatus = 'none'
  let problem: string | null = null

  for (const event of events) {
    const amount = roundMoney(Math.max(0, toNumber(event.amount)))
    switch (event.event_type) {
      case 'requested':
        if (status !== 'none') problem = problem ?? 'A deposit request can only be recorded once.'
        requestedAmount += amount
        status = 'requested'
        break
      case 'received':
        if (status !== 'requested') problem = problem ?? 'A deposit can only be received after it is requested.'
        receivedAmount += amount
        status = 'received'
        break
      case 'refunded':
        if (status !== 'received') problem = problem ?? 'Only a received deposit can be refunded.'
        refundedAmount += amount
        status = 'refunded'
        break
      case 'waived':
        if (status !== 'none') problem = problem ?? 'A deposit waiver must be the only deposit event.'
        status = 'waived'
        break
    }
  }

  if (requestedAmount > total) problem = problem ?? 'The requested deposit exceeds the accepted total.'
  if (receivedAmount > requestedAmount) problem = problem ?? 'Received deposits exceed the requested amount.'
  if (refundedAmount > receivedAmount) problem = problem ?? 'Refunds exceed the received deposit.'

  const outstandingAmount = status === 'requested' ? roundMoney(Math.max(0, requestedAmount - receivedAmount)) : 0
  const appliedAmount = roundMoney(Math.max(0, receivedAmount - refundedAmount))

  let nextAllowedEvents: DepositEventType[] = []
  if (status === 'none') nextAllowedEvents = ['requested', 'waived']
  else if (status === 'requested') nextAllowedEvents = ['received']
  else if (status === 'received') nextAllowedEvents = ['refunded']

  return {
    status,
    label: LABELS[status],
    acceptedTotal: total,
    requestedAmount: roundMoney(requestedAmount),
    receivedAmount: roundMoney(receivedAmount),
    refundedAmount: roundMoney(refundedAmount),
    outstandingAmount,
    appliedAmount,
    eventCount: events.length,
    nextAllowedEvents,
    problem,
  }
}

export const ACCEPTANCE_METHODS = ['in_person', 'phone', 'email', 'text', 'portal'] as const
export type AcceptanceMethod = (typeof ACCEPTANCE_METHODS)[number]

export const DEPOSIT_METHODS = ['cash', 'check', 'card', 'ach', 'other'] as const
export type DepositMethod = (typeof DEPOSIT_METHODS)[number]

export function describeAcceptanceMethod(method: string): string {
  switch (method) {
    case 'in_person': return 'In person'
    case 'phone': return 'Phone'
    case 'email': return 'Email'
    case 'text': return 'Text message'
    case 'portal': return 'Customer portal'
    default: return 'Recorded'
  }
}

/** Shown wherever acceptance is recorded, so no one mistakes it for a signature. */
export const ACCEPTANCE_DISCLAIMER =
  'This records what the customer told office staff. It is not an electronic signature and it is not a substitute for a signed contract.'
