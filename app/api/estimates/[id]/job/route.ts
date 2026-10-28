import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../../lib/supabase/server'
import { readJson } from '../../../../../lib/api-security'

type ServerClient = Awaited<ReturnType<typeof createClient>>

const JOB_COLUMNS =
  'id,workspace_id,job_number,lead_id,estimate_id,acceptance_id,customer_name,property_address,status,accepted_total,accepted_at,estimate_formula_version,approved_scope,scope_item_count,created_by,created_at,updated_at'

function failureStatus(code: string | undefined): number {
  if (code === '23505') return 409
  if (code === '23514' || code === '23503') return 400
  return 502
}

async function loadContext(supabase: ServerClient, workspaceId: string, estimateId: string) {
  const { data: estimate, error: estimateError } = await supabase
    .from('estimates')
    .select('id,status,lead_id,total')
    .eq('id', estimateId)
    .eq('workspace_id', workspaceId)
    .maybeSingle()

  if (estimateError) return { error: 'Could not load the estimate.', status: 502 as const }
  if (!estimate) return { error: 'Estimate not found in this workspace.', status: 404 as const }

  const { data: acceptance, error: acceptanceError } = await supabase
    .from('estimate_acceptances')
    .select('id,accepted_total,accepted_at')
    .eq('estimate_id', estimateId)
    .eq('workspace_id', workspaceId)
    .maybeSingle()

  if (acceptanceError) return { error: 'Could not load the recorded acceptance.', status: 502 as const }

  const { data: job, error: jobError } = await supabase
    .from('production_jobs')
    .select(JOB_COLUMNS)
    .eq('estimate_id', estimateId)
    .eq('workspace_id', workspaceId)
    .maybeSingle()

  if (jobError) return { error: 'Could not load the production job.', status: 502 as const }

  return { status: 200 as const, estimate, acceptance: acceptance ?? null, job: job ?? null }
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
  const result = await loadContext(supabase, workspaceId, id)
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status })

  return NextResponse.json({
    job: result.job,
    acceptance: result.acceptance,
    can_handoff: result.estimate.status === 'approved' && result.acceptance !== null && result.job === null,
  })
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

  const read = await readJson(request)
  if ('error' in read) return NextResponse.json({ error: read.error }, { status: read.status })
  if (read.body.action !== 'create_job') {
    return NextResponse.json({ error: 'Unknown action.' }, { status: 400 })
  }

  const { id } = await params
  const context = await loadContext(supabase, workspaceId, id)
  if ('error' in context) return NextResponse.json({ error: context.error }, { status: context.status })

  if (context.estimate.status !== 'approved') {
    return NextResponse.json({ error: 'The estimate must be approved before production handoff.' }, { status: 409 })
  }
  if (!context.acceptance) {
    return NextResponse.json({ error: 'Record customer acceptance before production handoff.' }, { status: 409 })
  }
  if (context.job) {
    return NextResponse.json({ error: 'This estimate already has a production job.' }, { status: 409 })
  }

  // Placeholders are overwritten by the database trigger. The browser cannot
  // choose the job number, customer, amount or scope.
  const { error } = await supabase.from('production_jobs').insert({
    workspace_id: workspaceId,
    job_number: 'pending',
    lead_id: context.estimate.lead_id,
    estimate_id: id,
    acceptance_id: context.acceptance.id,
    customer_name: 'pending',
    property_address: 'pending',
    status: 'ready',
    accepted_total: 0.01,
    accepted_at: new Date().toISOString(),
    approved_scope: [],
    scope_item_count: 1,
    created_by: user.id,
  })

  if (error) {
    const status = failureStatus(error.code)
    return NextResponse.json({
      error: status === 502 ? 'Could not create the production job.' : error.message,
    }, { status })
  }

  const refreshed = await loadContext(supabase, workspaceId, id)
  if ('error' in refreshed) return NextResponse.json({ error: refreshed.error }, { status: refreshed.status })

  return NextResponse.json({ job: refreshed.job, acceptance: refreshed.acceptance, can_handoff: false }, { status: 201 })
}
