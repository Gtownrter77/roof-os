import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../../lib/supabase/server'
import { readJson } from '../../../../../lib/api-security'
import {
  ACCEPTANCE_DISCLAIMER,
  ACCEPTANCE_METHODS,
  DEPOSIT_METHODS,
  deriveDepositState,
  type DepositEvent,
  type DepositEventType,
} from '../../../../../lib/estimates/acceptance'

type ServerClient = Awaited<ReturnType<typeof createClient>>

const DEPOSIT_EVENT_TYPES: DepositEventType[] = ['requested', 'received', 'waived', 'refunded']

const ACCEPTANCE_COLUMNS =
  'id,estimate_id,accepted_by_name,acceptance_method,note,accepted_subtotal,accepted_tax,accepted_total,estimate_formula_version,accepted_at,recorded_by,created_at'
const DEPOSIT_COLUMNS =
  'id,event_type,amount,method,reference,note,occurred_at,recorded_by,created_at'

function failureStatus(code: string | undefined): number {
  if (code === '23505') return 409
  if (code === '23514' || code === '23503') return 400
  return 502
}

async function loadAcceptance(supabase: ServerClient, workspaceId: string, estimateId: string) {
  const { data: estimate, error: estimateError } = await supabase
    .from('estimates')
    .select('id,status,subtotal,tax,total,formula_version')
    .eq('id', estimateId)
    .eq('workspace_id', workspaceId)
    .maybeSingle()

  if (estimateError) return { error: 'Could not load the estimate.', status: 502 as const }
  if (!estimate) return { error: 'Estimate not found in this workspace.', status: 404 as const }

  const { data: acceptance, error: acceptanceError } = await supabase
    .from('estimate_acceptances')
    .select(ACCEPTANCE_COLUMNS)
    .eq('estimate_id', estimateId)
    .eq('workspace_id', workspaceId)
    .maybeSingle()

  if (acceptanceError) return { error: 'Could not load the recorded acceptance.', status: 502 as const }

  let events: DepositEvent[] = []
  if (acceptance) {
    const { data, error } = await supabase
      .from('estimate_deposit_events')
      .select(DEPOSIT_COLUMNS)
      .eq('acceptance_id', acceptance.id)
      .eq('workspace_id', workspaceId)
      .order('occurred_at', { ascending: true })
      .order('id', { ascending: true })
    if (error) return { error: 'Could not load the deposit ledger.', status: 502 as const }
    events = (data ?? []) as DepositEvent[]
  }

  return {
    status: 200 as const,
    payload: {
      estimate,
      acceptance: acceptance ?? null,
      deposits: events,
      depositState: deriveDepositState(acceptance?.accepted_total ?? estimate.total, events),
      disclaimer: ACCEPTANCE_DISCLAIMER,
    },
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })

  const { data: workspaceId } = await supabase.rpc('current_workspace_id')
  if (!workspaceId) return NextResponse.json({ error: 'No workspace is configured.' }, { status: 400 })

  const { id } = await params
  const result = await loadAcceptance(supabase, workspaceId, id)
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json(result.payload)
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })

  const { data: workspaceId } = await supabase.rpc('current_workspace_id')
  if (!workspaceId) return NextResponse.json({ error: 'No workspace is configured.' }, { status: 400 })

  const { id } = await params
  const read = await readJson(request)
  if ('error' in read) return NextResponse.json({ error: read.error }, { status: read.status })
  const body = read.body

  const existing = await loadAcceptance(supabase, workspaceId, id)
  if ('error' in existing) return NextResponse.json({ error: existing.error }, { status: existing.status })

  if (body.action === 'record_acceptance') {
    const acceptedByName = String(body.accepted_by_name ?? '').trim()
    if (!acceptedByName || acceptedByName.length > 120) {
      return NextResponse.json({ error: 'Enter the name of the customer who accepted.' }, { status: 400 })
    }
    const method = String(body.acceptance_method ?? '')
    if (!ACCEPTANCE_METHODS.includes(method as (typeof ACCEPTANCE_METHODS)[number])) {
      return NextResponse.json({ error: 'Choose how the customer accepted.' }, { status: 400 })
    }
    const note = String(body.note ?? '').trim().slice(0, 2000)

    const { error } = await supabase.from('estimate_acceptances').insert({
      workspace_id: workspaceId,
      estimate_id: id,
      accepted_by_name: acceptedByName,
      acceptance_method: method,
      note: note || null,
      recorded_by: user.id,
    })

    if (error) {
      const status = failureStatus(error.code)
      return NextResponse.json({
        error: status === 502 ? 'Could not record the acceptance.' : error.message,
      }, { status })
    }
  } else if (body.action === 'deposit_event') {
    const eventType = String(body.event_type ?? '') as DepositEventType
    if (!DEPOSIT_EVENT_TYPES.includes(eventType)) {
      return NextResponse.json({ error: 'Choose a deposit event.' }, { status: 400 })
    }
    if (!existing.payload.acceptance) {
      return NextResponse.json({ error: 'Record customer acceptance before a deposit.' }, { status: 409 })
    }

    const rawAmount = body.amount === undefined || body.amount === null || body.amount === ''
      ? (eventType === 'waived' ? 0 : NaN)
      : Number(body.amount)
    if (!Number.isFinite(rawAmount) || rawAmount < 0) {
      return NextResponse.json({ error: 'Enter a valid deposit amount.' }, { status: 400 })
    }

    const method = body.method === undefined || body.method === null || body.method === ''
      ? null
      : String(body.method)
    if (method && !DEPOSIT_METHODS.includes(method as (typeof DEPOSIT_METHODS)[number])) {
      return NextResponse.json({ error: 'Choose a valid payment method.' }, { status: 400 })
    }
    if ((eventType === 'received' || eventType === 'refunded') && !method) {
      return NextResponse.json({ error: 'A payment method is required.' }, { status: 400 })
    }
    if (eventType === 'waived' && rawAmount !== 0) {
      return NextResponse.json({ error: 'A waived deposit has no amount.' }, { status: 400 })
    }

    const { error } = await supabase.from('estimate_deposit_events').insert({
      workspace_id: workspaceId,
      estimate_id: id,
      acceptance_id: existing.payload.acceptance.id,
      event_type: eventType,
      amount: rawAmount,
      method,
      reference: String(body.reference ?? '').trim().slice(0, 200) || null,
      note: String(body.note ?? '').trim().slice(0, 2000) || null,
      recorded_by: user.id,
    })

    if (error) {
      const status = failureStatus(error.code)
      return NextResponse.json({
        error: status === 502 ? 'Could not record the deposit event.' : error.message,
      }, { status })
    }
  } else {
    return NextResponse.json({ error: 'Unknown action.' }, { status: 400 })
  }

  const refreshed = await loadAcceptance(supabase, workspaceId, id)
  if ('error' in refreshed) return NextResponse.json({ error: refreshed.error }, { status: refreshed.status })
  return NextResponse.json(refreshed.payload)
}
