/**
 * Agent 5 — supplement review API (review-only).
 *
 * Local-first: no CapOut key, no network call, no Ollama dependency.
 * Persists evidence-linked drafts for workspace members; exports stay blocked.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabase/server'
import { readJson, requireWorkspaceMember } from '../../../../lib/api-security'
import { parseStructuredLines } from '../../../../lib/agent5/parser'
import { buildReviewPacket, compareRevisions } from '../../../../lib/agent5/reviewer'
import { normalizeDoclingDocument } from '../../../../lib/documents/normalizer'

const MAX_ROWS = 500
const MAX_PAGES = 50

async function getWorkspaceContext() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase, user: null, workspaceId: null }
  const { data: workspaceId } = await supabase.rpc('current_workspace_id')
  return { supabase, user, workspaceId: typeof workspaceId === 'string' ? workspaceId : null }
}

export async function POST(request: NextRequest) {
  const { supabase, user, workspaceId } = await getWorkspaceContext()
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  if (!workspaceId) return NextResponse.json({ error: 'No workspace is configured.' }, { status: 400 })

  const membership = await requireWorkspaceMember(supabase, user.id, workspaceId)
  if ('response' in membership) return membership.response

  const parsed = await readJson(request, 256 * 1024)
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: parsed.status })
  const body = parsed.body as Record<string, unknown>

  if (typeof body.document_id !== 'string' || body.document_id.trim().length === 0) {
    return NextResponse.json({ error: 'document_id is required.' }, { status: 400 })
  }
  if (body.document_id.length > 64) {
    return NextResponse.json({ error: 'document_id is too long.' }, { status: 400 })
  }

  const carrierRows = Array.isArray(body.carrier_rows) ? body.carrier_rows : []
  const contractorRows = Array.isArray(body.contractor_rows) ? body.contractor_rows : []
  if (carrierRows.length > MAX_ROWS || contractorRows.length > MAX_ROWS) {
    return NextResponse.json({ error: `A maximum of ${MAX_ROWS} rows is allowed.` }, { status: 400 })
  }

  const docling = body.docling && typeof body.docling === 'object' ? body.docling as Record<string, unknown> : {}
  const doclingPages = Array.isArray(docling.pages) ? docling.pages : []
  if (doclingPages.length > MAX_PAGES) {
    return NextResponse.json({ error: `A maximum of ${MAX_PAGES} pages is allowed.` }, { status: 400 })
  }

  const measurements = Array.isArray(body.measurements)
    ? body.measurements.filter((value): value is string => typeof value === 'string').slice(0, 200)
    : []

  const normalized = carrierRows.length === 0
    ? normalizeDoclingDocument({ ...docling, document_id: body.document_id })
    : null
  const carrier = carrierRows.length > 0
    ? parseStructuredLines(carrierRows, body.document_id)
    : normalized!.rows

  if (carrier.length === 0) {
    return NextResponse.json({ error: 'No carrier scope rows could be extracted from the supplied document.' }, { status: 422 })
  }

  const contractor = parseStructuredLines(contractorRows, `contractor:${body.document_id}`)
  const packet = buildReviewPacket({
    documentId: body.document_id,
    carrier,
    contractor,
    measurements,
  })

  const { data: inserted, error } = await supabase
    .from('supplement_review_drafts')
    .insert({
      workspace_id: workspaceId,
      document_id: body.document_id,
      status: packet.status,
      packet,
      created_by: user.id,
    })
    .select('id,created_at')
    .single()

  if (error) {
    return NextResponse.json({ error: 'Could not persist the review draft.' }, { status: 502 })
  }

  let revision: ReturnType<typeof compareRevisions> | null = null
  if (typeof body.previous_draft_id === 'string') {
    const { data: previous } = await supabase
      .from('supplement_review_drafts')
      .select('packet')
      .eq('id', body.previous_draft_id)
      .eq('workspace_id', workspaceId)
      .maybeSingle()
    if (previous?.packet) {
      revision = compareRevisions(previous.packet, packet)
    }
  }

  return NextResponse.json({
    draft_id: inserted.id,
    created_at: inserted.created_at,
    packet,
    normalization: normalized
      ? {
          page_count: normalized.pages.length,
          pages: normalized.pages,
          warnings: normalized.warnings,
          truncated: normalized.truncated,
        }
      : null,
    revision,
    review_required: true,
    export_blocked: true,
  })
}
