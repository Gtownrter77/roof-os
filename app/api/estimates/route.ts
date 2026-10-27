import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../../lib/supabase/server'
import { readJson, requireWorkspaceMember } from '../../../../../lib/api-security'
import { getDefaultEstimateTemplate, estimateStatusSchema } from '../../../../../lib/estimates/estimate-types'

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
    .select('id,lead_id,template_version_id,price_book_id,status,formula_version,subtotal,tax,total,created_by,approved_by,approved_at,created_at,updated_at,estimate_line_items(*)')
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

  const lineItems = body.line_items ?? []
  const { subtotal, tax, total } = computeTotals(lineItems)

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
      created_by: user.id,
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