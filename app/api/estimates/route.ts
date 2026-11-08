import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../lib/supabase/server'
import { isUuid, readJson, requireWorkspaceMember } from '../../../lib/api-security'
import { getDefaultEstimateTemplate } from '../../../lib/estimates/estimate-types'

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
  return { material, labor, allowance, fee, tax: taxItems, subtotal, total: subtotal + taxItems }
}

function generateEstimateNumber(workspaceId: string, createdAt: string) {
  const date = new Date(createdAt)
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  const shortWs = workspaceId.slice(0, 8).toUpperCase()
  return `EST-${yyyy}${mm}${dd}-${shortWs}`
}

export async function GET() {
  const { supabase, user, workspaceId } = await getWorkspaceContext()
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  if (!workspaceId) return NextResponse.json({ error: 'No workspace is configured.' }, { status: 400 })

  const { data, error } = await supabase
    .from('estimates')
    .select('id,lead_id,template_version_id,price_book_id,status,formula_version,subtotal,tax,total,created_by,approved_by,approved_at,created_at,updated_at,estimate_snapshot,estimate_line_items(*)')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) return NextResponse.json({ error: 'Could not load estimates.', detail: error.message }, { status: 502 })

  const estimates = (data ?? []).map(e => ({
    ...e,
    estimate_number: generateEstimateNumber(workspaceId, e.created_at),
    line_items: e.estimate_line_items ?? [],
    _estimate_line_items: undefined,
  }))

  return NextResponse.json({ estimates })
}

export async function POST(request: NextRequest) {
  const { supabase, user, workspaceId } = await getWorkspaceContext()
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  if (!workspaceId) return NextResponse.json({ error: 'No workspace is configured.' }, { status: 400 })

  const parsedBody = await readJson(request)
  if ('error' in parsedBody) return NextResponse.json({ error: parsedBody.error }, { status: parsedBody.status })

  const body = parsedBody.body as {
    lead_id?: string
    template_version_id?: string
    price_book_id?: string
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

  const status = body.status ?? 'draft'
  if (!ESTIMATE_STATUSES.includes(status as any)) {
    return NextResponse.json({ error: 'Invalid estimate status.' }, { status: 400 })
  }
  // Production approval via create also requires workspace-admin authority.
  if (status === 'approved') {
    const { data: isAdminData, error: adminCheckError } = await supabase.rpc('is_workspace_admin', { target_workspace: workspaceId })
    if (adminCheckError) return NextResponse.json({ error: 'Workspace authorization could not be verified.' }, { status: 502 })
    if (!isAdminData) return NextResponse.json({ error: 'Workspace administrator authority is required to approve this estimate.' }, { status: 403 })
  }

  const lineItems = body.line_items ?? []
  if (!Array.isArray(lineItems) || lineItems.length > 200) {
    return NextResponse.json({ error: 'An estimate may contain at most 200 line items.' }, { status: 400 })
  }
  if (body.lead_id !== undefined && body.lead_id !== null && !isUuid(body.lead_id)) {
    return NextResponse.json({ error: 'lead_id must be a valid UUID.' }, { status: 400 })
  }
  if (body.template_version_id !== undefined && body.template_version_id !== null && !isUuid(body.template_version_id)) {
    return NextResponse.json({ error: 'template_version_id must be a valid UUID.' }, { status: 400 })
  }
  if (body.price_book_id !== undefined && body.price_book_id !== null && !isUuid(body.price_book_id)) {
    return NextResponse.json({ error: 'price_book_id must be a valid UUID.' }, { status: 400 })
  }
  if (body.lead_id) {
    const { data, error } = await supabase.from('leads').select('id').eq('id', body.lead_id).eq('workspace_id', workspaceId).maybeSingle()
    if (error) return NextResponse.json({ error: 'Could not validate lead access.' }, { status: 503 })
    if (!data) return NextResponse.json({ error: 'The lead does not belong to this workspace.' }, { status: 400 })
  }
  if (body.price_book_id) {
    const { data, error } = await supabase.from('price_books').select('id').eq('id', body.price_book_id).eq('workspace_id', workspaceId).maybeSingle()
    if (error) return NextResponse.json({ error: 'Could not validate price-book access.' }, { status: 503 })
    if (!data) return NextResponse.json({ error: 'The price book does not belong to this workspace.' }, { status: 400 })
  }
  if (body.template_version_id) {
    const { data: version, error: versionError } = await supabase.from('estimate_template_versions').select('id,template_id').eq('id', body.template_version_id).maybeSingle()
    if (versionError) return NextResponse.json({ error: 'Could not validate estimate-template access.' }, { status: 503 })
    if (!version) return NextResponse.json({ error: 'The estimate template version was not found.' }, { status: 400 })
    const { data: template, error: templateError } = await supabase.from('estimate_templates').select('id').eq('id', version.template_id).eq('workspace_id', workspaceId).maybeSingle()
    if (templateError) return NextResponse.json({ error: 'Could not validate estimate-template workspace.' }, { status: 503 })
    if (!template) return NextResponse.json({ error: 'The estimate template does not belong to this workspace.' }, { status: 400 })
  }
  const allowedCategories = new Set(['material', 'labor', 'allowance', 'fee', 'tax'])
  for (const [index, item] of lineItems.entries()) {
    if (!item || typeof item !== 'object' || typeof item.description !== 'string' || typeof item.category !== 'string' || typeof item.unit !== 'string' || item.description.trim().length === 0 || item.description.length > 500 || item.unit.trim().length === 0 || item.unit.length > 20 || !allowedCategories.has(item.category) || !Number.isFinite(item.quantity) || item.quantity < 0 || !Number.isFinite(item.unit_cost) || item.unit_cost < 0 || !Number.isFinite(item.quantity * item.unit_cost) || (item.item_code != null && typeof item.item_code !== 'string')) {
      return NextResponse.json({ error: `Line item ${index + 1} must have a description, valid category, unit, and nonnegative numeric quantity and cost.` }, { status: 400 })
    }
  }
  const { subtotal, tax, total } = computeTotals(lineItems)
  if (![subtotal, tax, total].every(Number.isFinite)) {
    return NextResponse.json({ error: 'Estimate totals must be finite numbers.' }, { status: 400 })
  }

  const { data: estimate, error } = await supabase
    .from('estimates')
    .insert({
      workspace_id: workspaceId,
      lead_id: body.lead_id ?? null,
      template_version_id: body.template_version_id ?? null,
      price_book_id: body.price_book_id ?? null,
      status,
      formula_version: body.formula_version ?? 'v1',
      subtotal,
      tax,
      total,
      created_by: user.id,
      estimate_snapshot: {
        customer: {
          name: body.customer_name,
          email: body.customer_email,
          phone: body.customer_phone,
        },
        property: {
          address: body.property_address,
          city: body.property_city,
          state: body.property_state,
          zip: body.property_zip,
        },
        insurance: {
          company: body.insurance_company,
          claim_number: body.claim_number,
          adjuster: {
            name: body.adjuster_name,
            phone: body.adjuster_phone,
            email: body.adjuster_email,
          },
        },
        notes: {
          internal: body.notes_internal,
          customer: body.notes_customer,
        },
      },
    })
    .select('id,status,subtotal,tax,total,created_at,estimate_snapshot')
    .single()

  if (error) return NextResponse.json({ error: 'Could not create estimate.', detail: error.message }, { status: 502 })

  if (lineItems.length) {
    const lineItemRows = lineItems.map((item, idx) => ({
      estimate_id: estimate.id,
      item_code: item.item_code?.trim() ?? `ITEM-${idx + 1}`,
      description: item.description.trim(),
      category: item.category,
      unit: item.unit.trim(),
      quantity: item.quantity,
      unit_cost: item.unit_cost,
      line_total: item.quantity * item.unit_cost,
      source_snapshot: { waste_factor: item.waste_factor ?? 0, sort_order: item.sort_order ?? idx },
    }))
    const { error: lineError } = await supabase.from('estimate_line_items').insert(lineItemRows)
    if (lineError) {
      await supabase.from('estimates').delete().eq('id', estimate.id)
      return NextResponse.json({ error: 'Could not create estimate line items.', detail: lineError.message }, { status: 502 })
    }
  }

  const estimateNumber = generateEstimateNumber(workspaceId, estimate.created_at)
  return NextResponse.json({ estimate: { ...estimate, estimate_number: estimateNumber, line_items: lineItems } }, { status: 201 })
}
