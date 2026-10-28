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
import { fingerprintRequest, normalizeIdempotencyKey } from '../../../../lib/agent5/idempotency'
import { classifyPersistenceError } from '../../../../lib/agent5/retry'

const MAX_ROWS = 500
const MAX_PAGES = 50

async function getWorkspaceContext() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase, user: null, workspaceId: null }
  const { data: workspaceId } = await supabase.rpc('current_workspace_id')
  return { supabase, user, workspaceId: typeof workspaceId === 'string' ? workspaceId : null }
}

/** Listing stays metadata-only so a long packet list cannot bloat the response. */
function draftSummary(packet: unknown) {
  const value = packet && typeof packet === 'object' ? packet as Record<string, unknown> : {}
  const proposals = Array.isArray(value.proposals) ? value.proposals : []
  const lines = Array.isArray(value.lines) ? value.lines : []
  const totals = value.totals && typeof value.totals === 'object' ? value.totals as Record<string, unknown> : {}
  const number = (input: unknown) => typeof input === 'number' && Number.isFinite(input) ? input : null
  return {
    line_count: lines.length,
    proposal_count: proposals.length,
    carrier_source_total: number(totals.carrier_source_total),
    contractor_total: number(totals.contractor_total),
    delta: number(totals.delta),
    export_blocked: value.export_blocked === true,
  }
}

export async function GET() {
  const { supabase, user, workspaceId } = await getWorkspaceContext()
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  if (!workspaceId) return NextResponse.json({ error: 'No workspace is configured.' }, { status: 400 })

  const membership = await requireWorkspaceMember(supabase, user.id, workspaceId)
  if ('response' in membership) return membership.response

  const { data: isAdmin } = await supabase.rpc('is_workspace_admin', { target_workspace: workspaceId })
  const { data, error } = await supabase
    .from('supplement_review_drafts')
    .select('id,document_id,revision,status,created_at,approved_at,packet')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) return NextResponse.json({ error: 'Could not load supplement review drafts.' }, { status: 502 })

  return NextResponse.json({
    drafts: (data ?? []).map((row) => ({
      id: row.id,
      document_id: row.document_id,
      revision: row.revision,
      status: row.status,
      created_at: row.created_at,
      approved_at: row.approved_at,
      ...draftSummary(row.packet),
    })),
    can_approve: isAdmin === true,
    review_required: true,
    export_blocked: true,
    external_submission: false,
  })
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

  // A caller retry carries the same key. The key is scoped to the workspace and
  // the fingerprint decides replay versus conflict.
  const idempotency = normalizeIdempotencyKey(request.headers.get('idempotency-key'))
  if (idempotency.error) {
    return NextResponse.json({ error: idempotency.error, code: 'invalid_idempotency_key' }, { status: 400 })
  }
  const requestFingerprint = idempotency.key
    ? fingerprintRequest({
        document_id: body.document_id,
        carrier_rows: body.carrier_rows,
        contractor_rows: body.contractor_rows,
        docling: body.docling,
        measurements: body.measurements,
        previous_draft_id: body.previous_draft_id,
      })
    : null

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
      idempotency_key: idempotency.key,
      request_fingerprint: requestFingerprint,
    })
    .select('id,created_at')
    .single()

  if (error) {
    const code = typeof error.code === 'string' ? error.code : null

    if (code === '23505' && idempotency.key) {
      // A retry with the same key. If the stored fingerprint matches, return the
      // original draft; if it differs, the caller reused the key for new work.
      const { data: existing, error: replayError } = await supabase
        .from('supplement_review_drafts')
        .select('id,created_at,packet,request_fingerprint')
        .eq('workspace_id', workspaceId)
        .eq('idempotency_key', idempotency.key)
        .maybeSingle()

      if (replayError) {
        return NextResponse.json({ error: 'Could not resolve the idempotent retry.' }, { status: 502 })
      }
      if (existing) {
        if (existing.request_fingerprint !== requestFingerprint) {
          return NextResponse.json({
            error: 'This Idempotency-Key was already used with a different payload.',
            code: 'idempotency_conflict',
          }, { status: 409 })
        }
        return NextResponse.json({
          draft_id: existing.id,
          created_at: existing.created_at,
          packet: existing.packet,
          normalization: null,
          revision: null,
          idempotent_replay: true,
          review_required: true,
          export_blocked: true,
          external_submission: false,
        })
      }
      return NextResponse.json({
        error: 'A concurrent review draft write was not resolved. Retry the request.',
        code: 'revision_conflict',
        retryable: true,
        retry_after_seconds: 1,
      }, { status: 409, headers: { 'Retry-After': '1' } })
    }

    const retry = classifyPersistenceError(code)
    if (retry.retryable) {
      return NextResponse.json({
        error: 'The review draft could not be persisted yet. Retry the request.',
        code: retry.reason,
        retryable: true,
        retry_after_seconds: retry.retry_after_seconds,
      }, {
        status: 503,
        headers: { 'Retry-After': String(retry.retry_after_seconds ?? 1) },
      })
    }

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
    idempotent_replay: false,
    review_required: true,
    export_blocked: true,
  })
}
