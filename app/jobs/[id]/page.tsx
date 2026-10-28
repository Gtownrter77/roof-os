'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import {
  ASSIGNMENT_ROLES,
  describeAssignmentRole,
  describeAssignmentStatus,
  describeMaterialStatus,
  nextAssignmentStatuses,
  nextMaterialStatuses,
} from '../../../lib/jobs/schedule'
import { describeProductionJobStatus } from '../../../lib/jobs/production'

type Job = {
  id: string
  job_number: string
  customer_name: string
  property_address: string
  status: string
  accepted_total: number
  accepted_at: string
  scope_item_count: number
  approved_scope: Array<{ line_item_id: string; item_code: string; description: string; unit: string; quantity: number }>
}

type Assignment = {
  id: string
  member_user_id: string
  role: string
  scheduled_start: string
  scheduled_end: string
  status: string
  notes: string
}

type Material = {
  id: string
  line_item_id: string | null
  description: string
  quantity: number
  unit: string
  status: string
  needed_by: string | null
  vendor: string
  notes: string
}

type Member = { user_id: string; role: string }

type Readiness = {
  assignments_active: number
  crew_lead_assigned: boolean
  materials_total: number
  materials_needed: number
  materials_ordered: number
  materials_delivered_count: number
  crew_scheduled: boolean
  materials_all_delivered: boolean
}

type SchedulePayload = {
  job: Job
  assignments: Assignment[]
  materials: Material[]
  members: Member[]
  readiness: Readiness
  can_edit: boolean
  note: string
}

function money(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value)
}

export default function JobSchedulePage() {
  const params = useParams<{ id: string }>()
  const jobId = typeof params.id === 'string' ? params.id : ''
  const [data, setData] = useState<SchedulePayload | null>(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [memberId, setMemberId] = useState('')
  const [role, setRole] = useState('crew')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [assignmentNotes, setAssignmentNotes] = useState('')
  const [description, setDescription] = useState('')
  const [quantity, setQuantity] = useState('')
  const [unit, setUnit] = useState('')
  const [vendor, setVendor] = useState('')
  const [neededBy, setNeededBy] = useState('')
  const [lineItemId, setLineItemId] = useState('')
  const [materialNotes, setMaterialNotes] = useState('')

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch(`/api/production-jobs/${jobId}/schedule`, { signal })
      const result = await response.json().catch(() => ({}))
      if (signal?.aborted) return
      if (!response.ok) {
        setMessage(result.error ?? 'Could not load the schedule.')
        return
      }
      setData(result as SchedulePayload)
    } catch {
      if (!signal?.aborted) setMessage('Could not load the schedule.')
    }
  }, [jobId])

  useEffect(() => {
    if (!jobId) return
    const controller = new AbortController()
    void load(controller.signal)
    return () => controller.abort()
  }, [jobId, load])

  const send = async (method: 'POST' | 'PATCH', body: Record<string, unknown>) => {
    setBusy(true)
    setMessage('')
    try {
      const response = await fetch(`/api/production-jobs/${jobId}/schedule`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) {
        setMessage(result.error ?? 'The schedule change was refused.')
        return false
      }
      await load()
      return true
    } catch {
      setMessage('The schedule change could not be sent.')
      return false
    } finally {
      setBusy(false)
    }
  }

  const addAssignment = async () => {
    if (!memberId || !start || !end) {
      setMessage('Choose a member and a start and end time.')
      return
    }
    const added = await send('POST', {
      action: 'add_assignment',
      member_user_id: memberId,
      role,
      scheduled_start: new Date(start).toISOString(),
      scheduled_end: new Date(end).toISOString(),
      notes: assignmentNotes,
    })
    if (added) {
      setStart('')
      setEnd('')
      setAssignmentNotes('')
      setMessage('Assignment added. The handoff snapshot did not change.')
    }
  }

  const addMaterial = async () => {
    if (!description.trim() || !unit.trim() || !quantity) {
      setMessage('Description, quantity, and unit are required.')
      return
    }
    const added = await send('POST', {
      action: 'add_material',
      line_item_id: lineItemId || null,
      description,
      quantity: Number(quantity),
      unit,
      vendor,
      needed_by: neededBy || null,
      notes: materialNotes,
    })
    if (added) {
      setDescription('')
      setQuantity('')
      setUnit('')
      setVendor('')
      setNeededBy('')
      setLineItemId('')
      setMaterialNotes('')
      setMessage('Material line added. This is a planning row, not a purchase order.')
    }
  }

  if (!data) {
    return (
      <main className="mx-auto max-w-4xl space-y-4 p-6">
        <Link href="/jobs" className="text-xs text-cyan-300">← Production jobs</Link>
        {message ? (
          <p role="alert" className="rounded border border-red-500 p-3 text-sm text-red-200">{message}</p>
        ) : (
          <p className="text-sm text-slate-400">Loading schedule…</p>
        )}
      </main>
    )
  }

  const { job, assignments, materials, members, readiness, can_edit: canEdit } = data
  const activeAssignments = assignments.filter((row) => row.status !== 'cancelled')
  const activeMaterials = materials.filter((row) => row.status !== 'cancelled')

  return (
    <main className="mx-auto max-w-4xl space-y-4 p-6">
      <header className="flex flex-wrap items-center gap-2">
        <Link href="/jobs" className="text-xs text-cyan-300">← Production jobs</Link>
        <span className="ml-auto rounded bg-emerald-400/15 px-2 py-0.5 text-xs font-semibold text-emerald-200">{describeProductionJobStatus(job.status)}</span>
      </header>

      <section className="rounded-xl border border-white/10 bg-slate-900 p-5">
        <h1 className="font-mono text-sm text-cyan-200">{job.job_number}</h1>
        <p className="mt-1 text-lg font-semibold">{job.customer_name}</p>
        <p className="text-sm text-slate-400">{job.property_address}</p>
        <dl className="mt-3 grid gap-1 text-sm text-slate-300 sm:grid-cols-2">
          <div className="flex justify-between gap-3"><dt className="text-slate-400">Accepted total</dt><dd>{money(job.accepted_total)}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-slate-400">Accepted at</dt><dd>{new Date(job.accepted_at).toLocaleString()}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-slate-400">Approved scope</dt><dd>{job.scope_item_count} line{job.scope_item_count === 1 ? '' : 's'}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-slate-400">Editing</dt><dd>{canEdit ? 'Owner/admin' : 'Read only'}</dd></div>
        </dl>
      </section>

      {message && <p role="alert" className="rounded border border-amber-500/60 p-3 text-sm text-amber-100">{message}</p>}

      <section className="rounded-xl border border-white/10 bg-slate-900 p-5">
        <h2 className="font-semibold">Planning readiness</h2>
        <ul className="mt-2 grid gap-1 text-sm text-slate-300 sm:grid-cols-2">
          <li>Crew scheduled: <span className={readiness.crew_scheduled ? 'text-emerald-300' : 'text-slate-400'}>{readiness.crew_scheduled ? 'yes' : 'no'}</span></li>
          <li>Crew lead assigned: <span className={readiness.crew_lead_assigned ? 'text-emerald-300' : 'text-slate-400'}>{readiness.crew_lead_assigned ? 'yes' : 'no'}</span></li>
          <li>Materials needed: {readiness.materials_needed}</li>
          <li>Materials ordered: {readiness.materials_ordered}</li>
          <li>Materials delivered: {readiness.materials_delivered_count} of {readiness.materials_total}</li>
        </ul>
        <p className="mt-2 text-xs text-slate-500">
          These are planning signals only. They do not close the prebuild readiness gate, change the handoff, or promise a schedule.
        </p>
      </section>

      <section className="rounded-xl border border-white/10 bg-slate-900 p-5">
        <h2 className="font-semibold">Crew assignments</h2>
        {activeAssignments.length === 0 ? (
          <p className="mt-2 text-sm text-slate-400">No active assignment.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {activeAssignments.map((row) => (
              <li key={row.id} className="rounded border border-white/10 bg-black/20 p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold">{describeAssignmentRole(row.role)}</span>
                  <span className="text-xs text-slate-400">{describeAssignmentStatus(row.status)}</span>
                </div>
                <p className="text-xs text-slate-400">
                  {new Date(row.scheduled_start).toLocaleString()} – {new Date(row.scheduled_end).toLocaleString()}
                </p>
                <p className="font-mono text-xs text-slate-500">{row.member_user_id}</p>
                {row.notes && <p className="mt-1 text-xs text-slate-300">{row.notes}</p>}
                {canEdit && nextAssignmentStatuses(row.status).length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {nextAssignmentStatuses(row.status).map((status) => (
                      <button
                        key={status}
                        disabled={busy}
                        onClick={() => void send('PATCH', { action: 'set_assignment_status', assignment_id: row.id, status })}
                        className="rounded border border-cyan-500/60 px-2 py-1 text-xs text-cyan-200 hover:bg-cyan-500/10 disabled:opacity-60"
                      >
                        {describeAssignmentStatus(status)}
                      </button>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        {canEdit && (
          <div className="mt-4 space-y-2 border-t border-white/10 pt-3">
            <h3 className="text-sm font-semibold">Add assignment</h3>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="text-xs text-slate-300">Member
                <select value={memberId} onChange={(event) => setMemberId(event.target.value)} className="mt-1 w-full rounded border border-white/15 bg-black/25 p-2 text-sm">
                  <option value="">Choose a member</option>
                  {members.map((member) => (
                    <option key={member.user_id} value={member.user_id}>{member.role} · {member.user_id.slice(0, 8)}</option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-slate-300">Role
                <select value={role} onChange={(event) => setRole(event.target.value)} className="mt-1 w-full rounded border border-white/15 bg-black/25 p-2 text-sm">
                  {ASSIGNMENT_ROLES.map((value) => <option key={value} value={value}>{describeAssignmentRole(value)}</option>)}
                </select>
              </label>
              <label className="text-xs text-slate-300">Start
                <input type="datetime-local" value={start} onChange={(event) => setStart(event.target.value)} className="mt-1 w-full rounded border border-white/15 bg-black/25 p-2 text-sm" />
              </label>
              <label className="text-xs text-slate-300">End
                <input type="datetime-local" value={end} onChange={(event) => setEnd(event.target.value)} className="mt-1 w-full rounded border border-white/15 bg-black/25 p-2 text-sm" />
              </label>
            </div>
            <label className="block text-xs text-slate-300">Notes
              <input value={assignmentNotes} maxLength={500} onChange={(event) => setAssignmentNotes(event.target.value)} className="mt-1 w-full rounded border border-white/15 bg-black/25 p-2 text-sm" />
            </label>
            <button disabled={busy} onClick={() => void addAssignment()} className="rounded bg-cyan-600 px-3 py-2 text-sm font-semibold hover:bg-cyan-500 disabled:opacity-60">Add assignment</button>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-white/10 bg-slate-900 p-5">
        <h2 className="font-semibold">Materials</h2>
        {activeMaterials.length === 0 ? (
          <p className="mt-2 text-sm text-slate-400">No material lines.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {activeMaterials.map((row) => (
              <li key={row.id} className="rounded border border-white/10 bg-black/20 p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold">{row.description}</span>
                  <span className="text-xs text-slate-400">{describeMaterialStatus(row.status)}</span>
                </div>
                <p className="text-xs text-slate-400">
                  {row.quantity} {row.unit}
                  {row.vendor ? ` · ${row.vendor}` : ''}
                  {row.needed_by ? ` · needed by ${row.needed_by}` : ''}
                </p>
                {row.notes && <p className="mt-1 text-xs text-slate-300">{row.notes}</p>}
                {canEdit && nextMaterialStatuses(row.status).length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {nextMaterialStatuses(row.status).map((status) => (
                      <button
                        key={status}
                        disabled={busy}
                        onClick={() => void send('PATCH', { action: 'set_material_status', material_id: row.id, status })}
                        className="rounded border border-cyan-500/60 px-2 py-1 text-xs text-cyan-200 hover:bg-cyan-500/10 disabled:opacity-60"
                      >
                        {describeMaterialStatus(status)}
                      </button>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        {canEdit && (
          <div className="mt-4 space-y-2 border-t border-white/10 pt-3">
            <h3 className="text-sm font-semibold">Add material line</h3>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="text-xs text-slate-300">Scope line (optional)
                <select value={lineItemId} onChange={(event) => setLineItemId(event.target.value)} className="mt-1 w-full rounded border border-white/15 bg-black/25 p-2 text-sm">
                  <option value="">Not linked</option>
                  {job.approved_scope.map((line) => (
                    <option key={line.line_item_id} value={line.line_item_id}>{line.item_code} · {line.description}</option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-slate-300">Description
                <input value={description} maxLength={300} onChange={(event) => setDescription(event.target.value)} className="mt-1 w-full rounded border border-white/15 bg-black/25 p-2 text-sm" />
              </label>
              <label className="text-xs text-slate-300">Quantity
                <input type="number" min="0" step="0.001" value={quantity} onChange={(event) => setQuantity(event.target.value)} className="mt-1 w-full rounded border border-white/15 bg-black/25 p-2 text-sm" />
              </label>
              <label className="text-xs text-slate-300">Unit
                <input value={unit} maxLength={16} onChange={(event) => setUnit(event.target.value)} className="mt-1 w-full rounded border border-white/15 bg-black/25 p-2 text-sm" />
              </label>
              <label className="text-xs text-slate-300">Vendor
                <input value={vendor} maxLength={120} onChange={(event) => setVendor(event.target.value)} className="mt-1 w-full rounded border border-white/15 bg-black/25 p-2 text-sm" />
              </label>
              <label className="text-xs text-slate-300">Needed by
                <input type="date" value={neededBy} onChange={(event) => setNeededBy(event.target.value)} className="mt-1 w-full rounded border border-white/15 bg-black/25 p-2 text-sm" />
              </label>
            </div>
            <label className="block text-xs text-slate-300">Notes
              <input value={materialNotes} maxLength={500} onChange={(event) => setMaterialNotes(event.target.value)} className="mt-1 w-full rounded border border-white/15 bg-black/25 p-2 text-sm" />
            </label>
            <button disabled={busy} onClick={() => void addMaterial()} className="rounded bg-cyan-600 px-3 py-2 text-sm font-semibold hover:bg-cyan-500 disabled:opacity-60">Add material line</button>
          </div>
        )}
      </section>

      <p className="text-xs text-slate-500">
        Schedule rows are operational. They never change the accepted customer, amount, scope, or warranty, and nothing here orders material or promises a crew.
      </p>
    </main>
  )
}
