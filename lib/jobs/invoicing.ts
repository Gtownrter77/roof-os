// Production invoice presentation and preview helpers.
//
// The database owns the invoice (see migration 071). It reads the approved
// scope, the recorded tax, the approved change orders, and the received
// deposit, then computes every amount. This module mirrors that computation for
// a preview and for tests. It never collects money or invents a balance.

export const INVOICE_STATUSES = ['draft', 'issued', 'void'] as const
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number]

export const INVOICE_TRANSITIONS: Record<InvoiceStatus, InvoiceStatus[]> = {
  draft: ['issued', 'void'],
  issued: ['void'],
  void: [],
}

const LABELS: Record<InvoiceStatus, string> = {
  draft: 'Draft',
  issued: 'Issued',
  void: 'Void',
}

export function describeInvoiceStatus(status: string): string {
  return LABELS[status as InvoiceStatus] ?? 'Unknown status'
}

export function nextInvoiceStatuses(status: string): InvoiceStatus[] {
  return INVOICE_TRANSITIONS[status as InvoiceStatus] ?? []
}

/** Only a draft can be issued. An issued invoice can only be voided. */
export function canIssueInvoice(status: string): boolean {
  return status === 'draft'
}

export interface InvoiceScopeLine {
  line_item_id?: string | null
  item_code?: string | null
  description?: string | null
  category?: string | null
  unit?: string | null
  quantity?: number | string | null
  unit_cost?: number | string | null
  line_total?: number | string | null
}

export interface InvoiceChangeOrder {
  id?: string | null
  description?: string | null
  amount_delta?: number | string | null
  status?: string | null
}

export interface InvoiceDepositEvent {
  event_type?: string | null
  amount?: number | string | null
}

export interface InvoiceLineItem {
  kind: 'scope' | 'change_order'
  line_item_id?: string
  change_order_id?: string
  item_code?: string
  description: string
  category?: string
  unit?: string
  quantity?: number
  unit_cost?: number
  line_total: number
}

export interface InvoiceDraft {
  scope_lines_total: number
  change_order_total: number
  subtotal: number
  tax: number
  total: number
  deposit_credit: number
  balance_due: number
  scope_item_count: number
  line_items: InvoiceLineItem[]
  /** True when the scope plus tax matches the accepted total and the tax lines, if any, match. */
  reconciles: boolean
  blockers: string[]
}

export interface InvoiceDraftInput {
  acceptedTotal: number | string
  acceptedTax: number | string
  scopeLines: InvoiceScopeLine[]
  changeOrders?: InvoiceChangeOrder[]
  depositEvents?: InvoiceDepositEvent[]
}

const toNumber = (value: number | string | null | undefined): number => {
  if (value === null || value === undefined) return 0
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

const roundMoney = (value: number): number => Math.round(value * 100) / 100

const isTaxCategory = (line: InvoiceScopeLine): boolean => line.category === 'tax'

export function buildInvoiceDraft(input: InvoiceDraftInput): InvoiceDraft {
  const acceptedTotal = roundMoney(Math.max(0, toNumber(input.acceptedTotal)))
  const acceptedTax = roundMoney(Math.max(0, toNumber(input.acceptedTax)))
  const blockers: string[] = []

  const scopeLines: InvoiceLineItem[] = input.scopeLines.map((line) => ({
    kind: 'scope',
    line_item_id: line.line_item_id ?? undefined,
    item_code: line.item_code ?? undefined,
    description: line.description ?? '',
    category: line.category ?? undefined,
    unit: line.unit ?? undefined,
    quantity: toNumber(line.quantity),
    unit_cost: toNumber(line.unit_cost),
    line_total: roundMoney(toNumber(line.line_total)),
  }))

  const scopeSubtotal = roundMoney(
    scopeLines.filter((line) => line.category !== 'tax').reduce((sum, line) => sum + line.line_total, 0),
  )
  const scopeTax = roundMoney(
    scopeLines.filter((line) => line.category === 'tax').reduce((sum, line) => sum + line.line_total, 0),
  )

  if (scopeLines.length === 0) blockers.push('The approved scope has no line items.')

  if (scopeTax > 0 && Math.abs(scopeTax - acceptedTax) > 0.005) {
    blockers.push('The approved tax line items do not match the recorded acceptance tax.')
  }
  if (Math.abs(scopeSubtotal + acceptedTax - acceptedTotal) > 0.005) {
    blockers.push('The approved scope does not reconcile with the accepted total and tax.')
  }

  const approvedChangeOrders = (input.changeOrders ?? []).filter((order) => order.status === 'approved')
  const changeOrderLines: InvoiceLineItem[] = approvedChangeOrders.map((order) => ({
    kind: 'change_order',
    change_order_id: order.id ?? undefined,
    description: order.description ?? 'Approved change order',
    line_total: roundMoney(toNumber(order.amount_delta)),
  }))
  const changeOrderTotal = roundMoney(
    changeOrderLines.reduce((sum, line) => sum + line.line_total, 0),
  )

  const subtotal = roundMoney(scopeSubtotal + changeOrderTotal)
  const total = roundMoney(subtotal + acceptedTax)
  if (subtotal <= 0) blockers.push('The invoice needs a positive subtotal.')

  const received = (input.depositEvents ?? [])
    .filter((event) => event.event_type === 'received')
    .reduce((sum, event) => sum + roundMoney(toNumber(event.amount)), 0)
  const refunded = (input.depositEvents ?? [])
    .filter((event) => event.event_type === 'refunded')
    .reduce((sum, event) => sum + roundMoney(toNumber(event.amount)), 0)
  const depositCredit = roundMoney(Math.min(Math.max(received - refunded, 0), Math.max(total, 0)))
  const balanceDue = roundMoney(Math.max(total - depositCredit, 0))

  return {
    scope_lines_total: scopeSubtotal,
    change_order_total: changeOrderTotal,
    subtotal,
    tax: acceptedTax,
    total,
    deposit_credit: depositCredit,
    balance_due: balanceDue,
    scope_item_count: scopeLines.length,
    line_items: [...scopeLines, ...changeOrderLines],
    reconciles: blockers.length === 0,
    blockers,
  }
}
