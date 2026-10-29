/**
 * Production invoices for one job.
 *
 * The database computes the invoice from the approved scope, the recorded tax,
 * the approved change orders, and the received deposit (migration 071). This
 * route only creates a draft and moves it to issued or void. It never accepts
 * an amount, a line item, a tax, or a payment.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../../lib/supabase/server'
import { isUuid, readJson, requireWorkspaceMember } from '../../../../../lib/api-security'
import {
  buildInvoiceDraft,
  nextInvoiceStatuses,
} from '../../../../../lib/jobs/invoicing.ts'
import type { InvoiceStatus } from '../../../../../lib/jobs/invoicing.ts'

const INVOICE_COLUMNS =
  'id,invoice_number,status,currency,source_accepted_total,source_tax,scope_lines_total,change_order_total,subtotal,tax,total,deposit_credit,balance_due,scope_item_count,line_items,issued_at,issued_by,voided_at,voided_by,void_reason,created_by,created_at,updated_at'

function failureStatus(code: string | undefined): number {
  if (code === '42501') return 403
  if (code === '23505') return 409
  if (code === '23514' || code === '23503' || code === '22P02') return 409
  return 502
}

async function loadJob(supabase: Awaited<ReturnType<typeof createClient>>, id: string, workspaceId: string) {
  const { data, error } = await supabase
    .from('production_jobs')
    .select('id,status,accepted_total,acceptance_id,approved_scope')
    .eq('id', id)
    .eq('workspace_id', workspaceId)
    .maybeSingle()
  return { job: data, error }
}

type JobRow = {
  id: string
  status: string
  accepted_total: number | string
  acceptance_id: string
  approved_scope: unknown
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  if (!isUuid(id)) return NextResponse.json({ error: 'A valid production job id is required.' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })

  const { data: workspaceId } = await supabase.rpc('current_workspace_id')
  if (!workspaceId) return NextResponse.json({ error: 'No workspace is configured.' }, { status: 400 })

  const membership = await requireWorkspaceMember(supabase, user.id, workspaceId)
  if ('response' in membership) return membership.response

  const { job, error: jobError } = await loadJob(supabase, id, workspaceId)
  if (jobError) return NextResponse.json({ error: 'Could not load the production job.' }, { status: 502 })
  if (!job) return NextResponse.json({ error: 'Production job not found.' }, { status: 404 })
  const jobRow = job as JobRow

  const [acceptanceResult, changeOrderResult, depositResult, invoiceResult, adminResult] = await Promise.all([
    supabase
      .from('estimate_acceptances')
      .select('id,accepted_tax,accepted_total')
      .eq('id', jobRow.acceptance_id)
      .eq('workspace_id', workspaceId)
      .maybeSingle(),
    supabase
      .from('production_job_change_orders')
      .select('id,description,amount_delta,status')
      .eq('job_id', id)
      .eq('workspace_id', workspaceId),
    supabase
      .from('estimate_deposit_events')
      .select('event_type,amount')
      .eq('acceptance_id', jobRow.acceptance_id)
      .eq('workspace_id', workspaceId),
    supabase
      .from('production_invoices')
      .select(INVOICE_COLUMNS)
      .eq('job_id', id)
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase.rpc('is_workspace_admin', { target_workspace: workspaceId }),
  ])

  if (acceptanceResult.error) {
    return NextResponse.json({ error: 'Could not load the recorded acceptance.' }, { status: 502 })
  }
  if (changeOrderResult.error) {
    return NextResponse.json({ error: 'Could not load the change orders.' }, { status: 502 })
  }
  if (depositResult.error) {
    return NextResponse.json({ error: 'Could not load the deposit ledger.' }, { status: 502 })
  }
  if (invoiceResult.error) {
    return NextResponse.json({ error: 'Could not load the invoices.' }, { status: 502 })
  }

  const scopeLines = Array.isArray(jobRow.approved_scope) ? jobRow.approved_scope : []
  const preview = buildInvoiceDraft({
    acceptedTotal: acceptanceResult.data?.accepted_total ?? jobRow.accepted_total,
    acceptedTax: acceptanceResult.data?.accepted_tax ?? 0,
    scopeLines: scopeLines as never[],
    changeOrders: (changeOrderResult.data ?? []) as never[],
    depositEvents: (depositResult.data ?? []) as never[],
  })

  return NextResponse.json({
    job: { id: jobRow.id, status: jobRow.status },
    invoices: invoiceResult.data ?? [],
    draft_preview: preview,
    can_manage: adminResult.data === true,
    note: 'The database computes the invoice from the approved scope, tax, approved change orders, and received deposit. This is not a payment.',
  })
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  if (!isUuid(id)) return NextResponse.json({ error: 'A valid production job id is required.' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })

  const { data: workspaceId } = await supabase.rpc('current_workspace_id')
  if (!workspaceId) return NextResponse.json({ error: 'No workspace is configured.' }, { status: 400 })

  const membership = await requireWorkspaceMember(supabase, user.id, workspaceId)
  if ('response' in membership) return membership.response

  const { data: isAdmin } = await supabase.rpc('is_workspace_admin', { target_workspace: workspaceId })
  if (isAdmin !== true) {
    return NextResponse.json({ error: 'Workspace owner or administrator access is required to create an invoice.' }, { status: 403 })
  }

  const { job, error: jobError } = await loadJob(supabase, id, workspaceId)
  if (jobError) return NextResponse.json({ error: 'Could not load the production job.' }, { status: 502 })
  if (!job) return NextResponse.json({ error: 'Production job not found.' }, { status: 404 })
  const jobRow = job as JobRow
  if (jobRow.status === 'cancelled') {
    return NextResponse.json({ error: 'A cancelled production job cannot be invoiced.' }, { status: 409 })
  }

  const { data, error } = await supabase
    .from('production_invoices')
    .insert({
      workspace_id: workspaceId,
      job_id: id,
      acceptance_id: jobRow.acceptance_id,
      created_by: user.id,
    })
    .select(INVOICE_COLUMNS)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message || 'Could not create the invoice.' }, { status: failureStatus(error.code) })
  }

  return NextResponse.json({
    invoice: data,
    note: 'Draft created from the approved scope. The database supplied every amount. Issuing is a separate owner decision.',
  }, { status: 201 })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  if (!isUuid(id)) return NextResponse.json({ error: 'A valid production job id is required.' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })

  const { data: workspaceId } = await supabase.rpc('current_workspace_id')
  if (!workspaceId) return NextResponse.json({ error: 'No workspace is configured.' }, { status: 400 })

  const membership = await requireWorkspaceMember(supabase, user.id, workspaceId)
  if ('response' in membership) return membership.response

  const { data: isAdmin } = await supabase.rpc('is_workspace_admin', { target_workspace: workspaceId })
  if (isAdmin !== true) {
    return NextResponse.json({ error: 'Workspace owner or administrator access is required to move an invoice.' }, { status: 403 })
  }

  const parsed = await readJson(request, 8 * 1024)
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: parsed.status })
  const body = parsed.body

  if (body.action !== 'issue' && body.action !== 'void') {
    return NextResponse.json({ error: 'action must be issue or void.' }, { status: 400 })
  }
  if (!isUuid(body.invoice_id)) {
    return NextResponse.json({ error: 'invoice_id must be a valid UUID.' }, { status: 400 })
  }
  const target: InvoiceStatus = body.action === 'issue' ? 'issued' : 'void'
  const voidReason = typeof body.void_reason === 'string' ? body.void_reason.trim() : ''
  if (voidReason.length > 1000) {
    return NextResponse.json({ error: 'void_reason must be at most 1000 characters.' }, { status: 400 })
  }

  const { data: current, error: loadError } = await supabase
    .from('production_invoices')
    .select('id,status')
    .eq('id', body.invoice_id)
    .eq('job_id', id)
    .eq('workspace_id', workspaceId)
    .maybeSingle()
  if (loadError) return NextResponse.json({ error: 'Could not load the invoice.' }, { status: 502 })
  if (!current) return NextResponse.json({ error: 'Invoice not found.' }, { status: 404 })

  if (!nextInvoiceStatuses(current.status).includes(target)) {
    return NextResponse.json({
      error: `Invalid invoice status transition from ${current.status} to ${target}.`,
    }, { status: 409 })
  }

  const update: Record<string, unknown> = { status: target }
  if (target === 'void') update.void_reason = voidReason

  const { data, error } = await supabase
    .from('production_invoices')
    .update(update)
    .eq('id', current.id)
    .eq('job_id', id)
    .eq('workspace_id', workspaceId)
    .select(INVOICE_COLUMNS)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message || 'Could not move the invoice.' }, { status: failureStatus(error.code) })
  }

  return NextResponse.json({
    invoice: data,
    note: 'The database stamped who issued or voided the invoice and when. No payment was taken.',
  })
}
