import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabase/server'
import { readJson, requireWorkspaceMember } from '../../../../lib/api-security'

const ESTIMATE_STATUSES = ['draft', 'pending_approval', 'approved', 'rejected', 'superseded'] as const

async function getWorkspaceContext() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase, user: null, workspaceId: null }
  const { data: workspaceId } = await supabase.rpc('current_workspace_id')
  return { supabase, user, workspaceId }
}

function computeTotals(lineItems: { quantity: number; unit_cost: number; category: string }[]) {
  const material = lineItems.filter(i => i.category === 'material').reduce((sum, i) => sum + i.quantity * i.unit_cost, 0)
  const labor = lineItems.filter(i => i.category === 'labor').reduce((sum, i) => sum + i.quantity * i.unit_cost, 0)
  const allowance = lineItems.filter(i => i.category === 'allowance').reduce((sum, i) => sum + i.quantity * i.unit_cost, 0)
  const fee = lineItems.filter(i => i.category === 'fee').reduce((sum, i) => sum + i.quantity * i.unit_cost, 0)
  const taxItems = lineItems.filter(i => i.category === 'tax').reduce((sum, i) => sum + i.quantity * i.unit_cost, 0)
  const subtotal = material + labor + allowance + fee
  return { material, labor, tax: taxItems, subtotal, total: subtotal + taxItems }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { supabase, user, workspaceId } = await getWorkspaceContext()
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  if (!workspaceId) return NextResponse.json({ error: 'No workspace is configured.' }, { status: 400 })

  const { id } = await params
  const { data, error } = await supabase
    .from('estimates')
    .select('id,lead_id,template_version_id,price_book_id,status,formula_version,subtotal,tax,total,created_by,approved_by,approved_at,created_at,updated_at,estimate_snapshot,estimate_line_items(*)')
    .eq('id', id)
    .eq('workspace_id', workspaceId)
    .maybeSingle()

  if (error) return NextResponse.json({ error: 'Could not load estimate.', detail: error.message }, { status: 502 })
  if (!data) return NextResponse.json({ error: 'Estimate not found.' }, { status: 404 })

  return NextResponse.json({ estimate: { ...data, line_items: data.estimate_line_items ?? [], _estimate_line_items: undefined } })
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { supabase, user, workspaceId } = await getWorkspaceContext()
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  if (!workspaceId) return NextResponse.json({ error: 'No workspace is configured.' }, { status: 400 })

  const { id } = await params
  const parsedBody = await readJson(request)
  if ('error' in parsedBody) return NextResponse.json({ error: parsedBody.error }, { status: parsedBody.status })
  const body = parsedBody.body as {
    status?: string
    formula_version?: string
    customer_name?: string
    customer_email?: string
    customer_phone?: string
    property_address?: string
    property_city?: string
    property_state?: string
    property_zip?: string
    insurance_company?: string
    claim_number?: string
    adjuster_name?: string
    adjuster_phone?: string
    adjuster_email?: string
    notes_internal?: string
    notes_customer?: string
    line_items?: Array<{
      id?: string
      item_code?: string
      description: string
      category: 'material' | 'labor' | 'allowance' | 'fee' | 'tax'
      unit: string
      quantity: number
      unit_cost: number
      waste_factor?: number
      sort_order?: number
    }>
  }

  const { data: existing, error: loadError } = await supabase
    .from('estimates')
    .select('id,status,created_by,approved_by,approved_at,estimate_snapshot,formula_version')
    .eq('id', id)
    .eq('workspace_id', workspaceId)
    .maybeSingle()

  if (loadError) return NextResponse.json({ error: 'Could not load estimate.' }, { status: 502 })
  if (!existing) return NextResponse.json({ error: 'Estimate not found.' }, { status: 404 })

  const status = body.status ?? existing.status
  if (!['draft', 'pending_approval', 'approved', 'rejected', 'superseded'].includes(status)) {
    return NextResponse.json({ error: 'Invalid estimate status.' }, { status: 400 })
  }

  // Prevent editing approved/rejected/superseded estimates
  if (['approved', 'rejected', 'superseded'].includes(existing.status)) {
    return NextResponse.json({ error: `Cannot modify an estimate that is ${existing.status}.` }, { status: 409 })
  }

  // Handle status transitions
  let approved_by = existing.approved_by
  let approved_at = existing.approved_at
  if (status === 'approved' && existing.status !== 'approved') {
    approved_by = user.id
    approved_at = new Date().toISOString()
  } else if (status !== 'approved') {
    approved_by = null
    approved_at = null
  }

  let subtotal = 0, tax = 0, total = 0
  const lineItems = body.line_items
  if (lineItems !== undefined) {
    // One database transaction: an insert failure rolls back deletions and totals.
    const { error: replacementError } = await supabase.rpc('replace_estimate_line_items', {
      p_estimate_id: id,
      p_workspace_id: workspaceId,
      p_items: lineItems,
      p_status: status,
      p_formula_version: body.formula_version ?? existing.formula_version,
    })
    if (replacementError) {
      return NextResponse.json({ error: 'Could not replace estimate line items.', detail: replacementError.message }, { status: 502 })
    }

  } else if (body.status !== undefined || body.formula_version !== undefined || body.customer_name !== undefined || body.customer_email !== undefined || body.customer_phone !== undefined || body.property_address !== undefined || body.property_city !== undefined || body.property_state !== undefined || body.property_zip !== undefined || body.insurance_company !== undefined || body.claim_number !== undefined || body.adjuster_name !== undefined || body.adjuster_phone !== undefined || body.adjuster_email !== undefined || body.notes_internal !== undefined || body.notes_customer !== undefined) {
    // partial update of non-line-item fields
    const snapshot = existing.estimate_snapshot ?? {}
    const { error: updateError } = await supabase
      .from('estimates')
      .update({
        status,
        formula_version: body.formula_version ?? existing.formula_version,
        approved_by,
        approved_at,
        estimate_snapshot: {
          ...snapshot,
          customer: {
            name: body.customer_name ?? snapshot.customer?.name,
            email: body.customer_email ?? snapshot.customer?.email,
            phone: body.customer_phone ?? snapshot.customer?.phone,
          },
          property: {
            address: body.property_address ?? snapshot.property?.address,
            city: body.property_city ?? snapshot.property?.city,
            state: body.property_state ?? snapshot.property?.state,
            zip: body.property_zip ?? snapshot.property?.zip,
          },
          insurance: {
            company: body.insurance_company ?? snapshot.insurance?.company,
            claim_number: body.claim_number ?? snapshot.insurance?.claim_number,
            adjuster: {
              name: body.adjuster_name ?? snapshot.insurance?.adjuster?.name,
              phone: body.adjuster_phone ?? snapshot.insurance?.adjuster?.phone,
              email: body.adjuster_email ?? snapshot.insurance?.adjuster?.email,
            },
          },
          notes: {
            internal: body.notes_internal ?? snapshot.notes?.internal,
            customer: body.notes_customer ?? snapshot.notes?.customer,
          },
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('workspace_id', workspaceId)

    if (updateError) return NextResponse.json({ error: 'Could not update estimate.' }, { status: 502 })
  }

  const { data: updated } = await supabase
    .from('estimates')
    .select('id,lead_id,template_version_id,price_book_id,status,formula_version,subtotal,tax,total,created_by,approved_by,approved_at,created_at,updated_at,estimate_snapshot,estimate_line_items(*)')
    .eq('id', id)
    .eq('workspace_id', workspaceId)
    .maybeSingle()

  return NextResponse.json({ estimate: { ...updated!, line_items: updated?.estimate_line_items ?? [], _estimate_line_items: undefined } })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { supabase, user, workspaceId } = await getWorkspaceContext()
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  if (!workspaceId) return NextResponse.json({ error: 'No workspace is configured.' }, { status: 400 })

  const { id } = await params
  const { data: existing } = await supabase
    .from('estimates')
    .select('id,status,created_by')
    .eq('id', id)
    .eq('workspace_id', workspaceId)
    .maybeSingle()

  if (!existing) return NextResponse.json({ error: 'Estimate not found.' }, { status: 404 })

  // Only creator or admin can delete
  if (existing.created_by !== user.id) {
    const { data: isAdmin } = await supabase.rpc('is_workspace_admin', { target_workspace: workspaceId })
    if (!isAdmin) return NextResponse.json({ error: 'Only the creator or a workspace admin can delete this estimate.' }, { status: 403 })
  }

  if (['approved', 'superseded'].includes(existing.status)) {
    return NextResponse.json({ error: `Cannot delete an estimate that is ${existing.status}.` }, { status: 409 })
  }

  const { error } = await supabase.from('estimates').delete().eq('id', id).eq('workspace_id', workspaceId)
  if (error) return NextResponse.json({ error: 'Could not delete estimate.', detail: error.message }, { status: 502 })

  return NextResponse.json({ deleted: true })
}