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
import { describeProductionJobStatus, nextProductionJobStatuses } from '../../../lib/jobs/production'
import {
  PUNCH_SEVERITIES,
  describePunchSeverity,
  describePunchStatus,
  canResolvePunchItem,
} from '../../../lib/jobs/qc'
import {
  PERMIT_STATUSES,
  WEATHER_DECISIONS,
  describePermitStatus,
  describeWeatherDecision,
} from '../../../lib/jobs/readiness'
import {
  CHANGE_ORDER_DECISIONS,
  describeAmountDelta,
  describeChangeOrderStatus,
  nextChangeOrderDecisions,
} from '../../../lib/jobs/fieldwork'
import {
  describeInvoiceStatus,
  nextInvoiceStatuses,
} from '../../../lib/jobs/invoicing'

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

type PrebuildCheck = { key: string; label: string; ready: boolean; detail: string }

type PrebuildPayload = {
  job: Job & { acceptance_id: string }
  deposit: { status: string; label: string; problem: string | null; receivedAmount: number; requestedAmount: number }
  record: {
    permit_status: string
    permit_reference: string
    permit_checked_at: string | null
    weather_decision: string
    weather_source: string
    weather_checked_at: string | null
  } | null
  readiness: {
    ready: boolean
    checks: PrebuildCheck[]
    blockers: string[]
    weather_age_hours: number | null
    note: string
  }
  can_edit: boolean
}

type FieldUpdate = {
  id: string
  work_date: string
  note: string
  percent_complete: number | null
  blockers: string
  created_by: string
  created_at: string
}

type ChangeOrder = {
  id: string
  requested_by: string
  description: string
  reason: string
  amount_delta: number | string
  status: string
  decided_by: string | null
  decided_at: string | null
  decision_note: string
  created_at: string
  updated_at: string
}

type ChangeOrderSummary = {
  requested_count: number
  approved_count: number
  declined_count: number
  approved_delta_total: number
  requested_delta_total: number
  has_pending: boolean
}

type UpdatesPayload = {
  updates: FieldUpdate[]
  note: string
}

type ChangeOrdersPayload = {
  change_orders: ChangeOrder[]
  summary: ChangeOrderSummary
  can_decide: boolean
  note: string
}

type PunchItem = {
  id: string
  severity: string
  location: string
  description: string
  status: string
  created_by: string
  created_at: string
  resolved_by: string | null
  resolved_at: string | null
  resolution_note: string
}

type PunchSummary = {
  total: number
  open_total: number
  open_critical: number
  open_major: number
  open_minor: number
  resolved_total: number
}

type PunchPayload = {
  punch_items: PunchItem[]
  summary: PunchSummary
  note: string
}

type Closeout = {
  id: string
  closed_by: string
  closed_at: string
  note: string
  open_critical_count: number
  open_total_count: number
  created_at: string
}

type CloseoutPayload = {
  closeout: Closeout | null
  gate: { can_close: boolean; open_critical: number; open_total: number; blockers: string[] }
  punch_summary: PunchSummary
  can_close: boolean
  note: string
}

type InvoiceLine = {
  kind: string
  description: string
  line_total: number | string
  item_code?: string
  change_order_id?: string
}

type ProductionInvoice = {
  id: string
  invoice_number: string
  status: string
  subtotal: number | string
  tax: number | string
  total: number | string
  deposit_credit: number | string
  balance_due: number | string
  change_order_total: number | string
  line_items: InvoiceLine[]
  issued_at: string | null
  voided_at: string | null
  void_reason: string
  created_at: string
}

type InvoicePreview = {
  subtotal: number
  tax: number
  total: number
  deposit_credit: number
  balance_due: number
  change_order_total: number
  scope_item_count: number
  reconciles: boolean
  blockers: string[]
}

type InvoicePayload = {
  invoices: ProductionInvoice[]
  draft_preview: InvoicePreview
  can_manage: boolean
  note: string
}

function money(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value)
}

export default function JobSchedulePage() {
  const params = useParams<{ id: string }>()
  const jobId = typeof params.id === 'string' ? params.id : ''
  const [data, setData] = useState<SchedulePayload | null>(null)
  const [prebuild, setPrebuild] = useState<PrebuildPayload | null>(null)
  const [updates, setUpdates] = useState<FieldUpdate[]>([])
  const [changeOrders, setChangeOrders] = useState<ChangeOrder[]>([])
  const [changeSummary, setChangeSummary] = useState<ChangeOrderSummary | null>(null)
  const [canDecide, setCanDecide] = useState(false)
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
  const [permitStatus, setPermitStatus] = useState('unknown')
  const [permitReference, setPermitReference] = useState('')
  const [weatherDecision, setWeatherDecision] = useState('unknown')
  const [weatherSource, setWeatherSource] = useState('')
  const [workDate, setWorkDate] = useState(new Date().toISOString().slice(0, 10))
  const [updateNote, setUpdateNote] = useState('')
  const [percentComplete, setPercentComplete] = useState('')
  const [updateBlockers, setUpdateBlockers] = useState('')
  const [coDescription, setCoDescription] = useState('')
  const [coReason, setCoReason] = useState('')
  const [coAmount, setCoAmount] = useState('')
  const [coNote, setCoNote] = useState('')
  const [punchItems, setPunchItems] = useState<PunchItem[]>([])
  const [closeout, setCloseout] = useState<CloseoutPayload | null>(null)
  const [punchSeverity, setPunchSeverity] = useState('minor')
  const [punchLocation, setPunchLocation] = useState('')
  const [punchDescription, setPunchDescription] = useState('')
  const [resolutionNote, setResolutionNote] = useState('')
  const [closeoutNote, setCloseoutNote] = useState('')
  const [invoices, setInvoices] = useState<ProductionInvoice[]>([])
  const [invoicePreview, setInvoicePreview] = useState<InvoicePreview | null>(null)
  const [canManageInvoices, setCanManageInvoices] = useState(false)
  const [invoiceVoidReason, setInvoiceVoidReason] = useState('')

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const [scheduleResponse, prebuildResponse, updatesResponse, changeOrderResponse, punchResponse, closeoutResponse, invoiceResponse] = await Promise.all([
        fetch(`/api/production-jobs/${jobId}/schedule`, { signal }),
        fetch(`/api/production-jobs/${jobId}/readiness`, { signal }),
        fetch(`/api/production-jobs/${jobId}/updates`, { signal }),
        fetch(`/api/production-jobs/${jobId}/change-orders`, { signal }),
        fetch(`/api/production-jobs/${jobId}/punch-items`, { signal }),
        fetch(`/api/production-jobs/${jobId}/closeout`, { signal }),
        fetch(`/api/production-jobs/${jobId}/invoices`, { signal }),
      ])
      const scheduleResult = await scheduleResponse.json().catch(() => ({}))
      const prebuildResult = await prebuildResponse.json().catch(() => ({}))
      const updatesResult = await updatesResponse.json().catch(() => ({}))
      const changeOrderResult = await changeOrderResponse.json().catch(() => ({}))
      const punchResult = await punchResponse.json().catch(() => ({}))
      const closeoutResult = await closeoutResponse.json().catch(() => ({}))
      const invoiceResult = await invoiceResponse.json().catch(() => ({}))
      if (signal?.aborted) return
      if (!scheduleResponse.ok) {
        setMessage(scheduleResult.error ?? 'Could not load the schedule.')
        return
      }
      if (!prebuildResponse.ok) {
        setMessage(prebuildResult.error ?? 'Could not load the prebuild readiness.')
        return
      }
      if (!updatesResponse.ok) {
        setMessage(updatesResult.error ?? 'Could not load the field updates.')
        return
      }
      if (!changeOrderResponse.ok) {
        setMessage(changeOrderResult.error ?? 'Could not load the change orders.')
        return
      }
      if (!punchResponse.ok) {
        setMessage(punchResult.error ?? 'Could not load the punch items.')
        return
      }
      if (!closeoutResponse.ok) {
        setMessage(closeoutResult.error ?? 'Could not load the closeout.')
        return
      }
      if (!invoiceResponse.ok) {
        setMessage(invoiceResult.error ?? 'Could not load the invoices.')
        return
      }
      setData(scheduleResult as SchedulePayload)
      setPrebuild(prebuildResult as PrebuildPayload)
      setUpdates((updatesResult as UpdatesPayload).updates ?? [])
      const changePayload = changeOrderResult as ChangeOrdersPayload
      setChangeOrders(changePayload.change_orders ?? [])
      setChangeSummary(changePayload.summary ?? null)
      setCanDecide(changePayload.can_decide === true)
      setPunchItems((punchResult as PunchPayload).punch_items ?? [])
      setCloseout(closeoutResult as CloseoutPayload)
      const invoicePayload = invoiceResult as InvoicePayload
      setInvoices(invoicePayload.invoices ?? [])
      setInvoicePreview(invoicePayload.draft_preview ?? null)
      setCanManageInvoices(invoicePayload.can_manage === true)
      const record = (prebuildResult as PrebuildPayload).record
      if (record) {
        setPermitStatus(record.permit_status)
        setPermitReference(record.permit_reference)
        setWeatherDecision(record.weather_decision)
        setWeatherSource(record.weather_source)
      }
    } catch {
      if (!signal?.aborted) setMessage('Could not load the job plan.')
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

  const sendReadiness = async (body: Record<string, unknown>) => {
    setBusy(true)
    setMessage('')
    try {
      const response = await fetch(`/api/production-jobs/${jobId}/readiness`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) {
        setMessage(result.error ?? 'The readiness decision was refused.')
        return false
      }
      await load()
      return true
    } catch {
      setMessage('The readiness decision could not be sent.')
      return false
    } finally {
      setBusy(false)
    }
  }

  const addFieldUpdate = async () => {
    if (!workDate || !updateNote.trim()) {
      setMessage('Choose a work date and write what happened.')
      return
    }
    setBusy(true)
    setMessage('')
    try {
      const response = await fetch(`/api/production-jobs/${jobId}/updates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          work_date: workDate,
          note: updateNote,
          percent_complete: percentComplete === '' ? null : Number(percentComplete),
          blockers: updateBlockers,
        }),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) {
        setMessage(result.error ?? 'The field update was refused.')
        return
      }
      setUpdateNote('')
      setPercentComplete('')
      setUpdateBlockers('')
      await load()
      setMessage('Field update recorded. It is append-only and did not change the handoff.')
    } catch {
      setMessage('The field update could not be sent.')
    } finally {
      setBusy(false)
    }
  }

  const requestChangeOrder = async () => {
    if (!coDescription.trim() || !coAmount) {
      setMessage('Describe the change and enter a nonzero amount.')
      return
    }
    setBusy(true)
    setMessage('')
    try {
      const response = await fetch(`/api/production-jobs/${jobId}/change-orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: coDescription,
          reason: coReason,
          amount_delta: Number(coAmount),
        }),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) {
        setMessage(result.error ?? 'The change order was refused.')
        return
      }
      setCoDescription('')
      setCoReason('')
      setCoAmount('')
      await load()
      setMessage('Change order requested. An owner or administrator must decide it.')
    } catch {
      setMessage('The change order could not be sent.')
    } finally {
      setBusy(false)
    }
  }

  const decideChangeOrder = async (changeOrderId: string, decision: 'approved' | 'declined') => {
    setBusy(true)
    setMessage('')
    try {
      const response = await fetch(`/api/production-jobs/${jobId}/change-orders`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'decide', change_order_id: changeOrderId, decision, decision_note: coNote }),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) {
        setMessage(result.error ?? 'The decision was refused.')
        return
      }
      setCoNote('')
      await load()
      setMessage('Decision recorded. The handoff snapshot did not change.')
    } catch {
      setMessage('The decision could not be sent.')
    } finally {
      setBusy(false)
    }
  }

  const addPunchItem = async () => {
    if (!punchDescription.trim()) {
      setMessage('Describe the defect.')
      return
    }
    setBusy(true)
    setMessage('')
    try {
      const response = await fetch(`/api/production-jobs/${jobId}/punch-items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ severity: punchSeverity, location: punchLocation, description: punchDescription }),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) {
        setMessage(result.error ?? 'The punch item was refused.')
        return
      }
      setPunchDescription('')
      setPunchLocation('')
      await load()
      setMessage('Punch item recorded. A critical item blocks closeout until it is resolved.')
    } catch {
      setMessage('The punch item could not be sent.')
    } finally {
      setBusy(false)
    }
  }

  const resolvePunchItem = async (punchItemId: string) => {
    setBusy(true)
    setMessage('')
    try {
      const response = await fetch(`/api/production-jobs/${jobId}/punch-items`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'resolve', punch_item_id: punchItemId, resolution_note: resolutionNote }),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) {
        setMessage(result.error ?? 'The resolution was refused.')
        return
      }
      setResolutionNote('')
      await load()
      setMessage('Punch item resolved. A resolved item is immutable.')
    } catch {
      setMessage('The resolution could not be sent.')
    } finally {
      setBusy(false)
    }
  }

  const recordCloseout = async () => {
    setBusy(true)
    setMessage('')
    try {
      const response = await fetch(`/api/production-jobs/${jobId}/closeout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: closeoutNote }),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) {
        setMessage(result.error ?? 'The closeout was refused.')
        return
      }
      setCloseoutNote('')
      await load()
      setMessage('Supervisor closeout recorded. Completing the job is a separate status move.')
    } catch {
      setMessage('The closeout could not be sent.')
    } finally {
      setBusy(false)
    }
  }

  const moveStatus = async (status: string) => {
    setBusy(true)
    setMessage('')
    try {
      const response = await fetch(`/api/production-jobs/${jobId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) {
        setMessage(result.error ?? 'The status move was refused.')
        return
      }
      await load()
      setMessage('Status updated. The handoff snapshot did not change.')
    } catch {
      setMessage('The status move could not be sent.')
    } finally {
      setBusy(false)
    }
  }

  const createInvoice = async () => {
    setBusy(true)
    setMessage('')
    try {
      const response = await fetch(`/api/production-jobs/${jobId}/invoices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) {
        setMessage(result.error ?? 'The invoice draft was refused.')
        return
      }
      await load()
      setMessage('Draft invoice created from the approved scope. Issuing is a separate owner decision.')
    } catch {
      setMessage('The invoice could not be created.')
    } finally {
      setBusy(false)
    }
  }

  const moveInvoice = async (invoiceId: string, action: 'issue' | 'void') => {
    setBusy(true)
    setMessage('')
    try {
      const response = await fetch(`/api/production-jobs/${jobId}/invoices`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, invoice_id: invoiceId, void_reason: invoiceVoidReason }),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) {
        setMessage(result.error ?? 'The invoice status move was refused.')
        return
      }
      setInvoiceVoidReason('')
      await load()
      setMessage(action === 'issue' ? 'Invoice issued. No payment was taken.' : 'Invoice voided.')
    } catch {
      setMessage('The invoice status move could not be sent.')
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
  const jobActive = job.status !== 'completed' && job.status !== 'cancelled'

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

      {prebuild && (
        <section className="rounded-xl border border-white/10 bg-slate-900 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold">Prebuild readiness</h2>
            <span className={`rounded px-2 py-0.5 text-xs font-semibold ${prebuild.readiness.ready ? 'bg-emerald-400/15 text-emerald-200' : 'bg-amber-400/15 text-amber-200'}`}>
              {prebuild.readiness.ready ? 'Checklist clear' : `${prebuild.readiness.blockers.length} blocker${prebuild.readiness.blockers.length === 1 ? '' : 's'}`}
            </span>
          </div>
          <ul className="mt-3 space-y-2">
            {prebuild.readiness.checks.map((check) => (
              <li key={check.key} className="rounded border border-white/10 bg-black/20 p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold">{check.label}</span>
                  <span className={check.ready ? 'text-emerald-300' : 'text-amber-300'}>{check.ready ? 'ready' : 'blocked'}</span>
                </div>
                <p className="text-xs text-slate-400">{check.detail}</p>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-slate-500">{prebuild.readiness.note}</p>

          {prebuild.can_edit && (
            <div className="mt-4 grid gap-4 border-t border-white/10 pt-3 sm:grid-cols-2">
              <div className="space-y-2">
                <h3 className="text-sm font-semibold">Permit decision</h3>
                <label className="block text-xs text-slate-300">Status
                  <select value={permitStatus} onChange={(event) => setPermitStatus(event.target.value)} className="mt-1 w-full rounded border border-white/15 bg-black/25 p-2 text-sm">
                    {PERMIT_STATUSES.map((value) => <option key={value} value={value}>{describePermitStatus(value)}</option>)}
                  </select>
                </label>
                <label className="block text-xs text-slate-300">Reference
                  <input value={permitReference} maxLength={120} onChange={(event) => setPermitReference(event.target.value)} className="mt-1 w-full rounded border border-white/15 bg-black/25 p-2 text-sm" />
                </label>
                <button
                  disabled={busy}
                  onClick={() => void sendReadiness({ action: 'set_permit', permit_status: permitStatus, permit_reference: permitReference })}
                  className="rounded bg-cyan-600 px-3 py-2 text-sm font-semibold hover:bg-cyan-500 disabled:opacity-60"
                >
                  Record permit decision
                </button>
                {prebuild.record?.permit_checked_at && (
                  <p className="text-xs text-slate-500">Checked {new Date(prebuild.record.permit_checked_at).toLocaleString()}</p>
                )}
              </div>
              <div className="space-y-2">
                <h3 className="text-sm font-semibold">Weather decision</h3>
                <label className="block text-xs text-slate-300">Decision
                  <select value={weatherDecision} onChange={(event) => setWeatherDecision(event.target.value)} className="mt-1 w-full rounded border border-white/15 bg-black/25 p-2 text-sm">
                    {WEATHER_DECISIONS.map((value) => <option key={value} value={value}>{describeWeatherDecision(value)}</option>)}
                  </select>
                </label>
                <label className="block text-xs text-slate-300">Source
                  <input value={weatherSource} maxLength={200} onChange={(event) => setWeatherSource(event.target.value)} className="mt-1 w-full rounded border border-white/15 bg-black/25 p-2 text-sm" />
                </label>
                <button
                  disabled={busy}
                  onClick={() => void sendReadiness({ action: 'set_weather', weather_decision: weatherDecision, weather_source: weatherSource })}
                  className="rounded bg-cyan-600 px-3 py-2 text-sm font-semibold hover:bg-cyan-500 disabled:opacity-60"
                >
                  Record weather decision
                </button>
                {prebuild.record?.weather_checked_at && (
                  <p className="text-xs text-slate-500">
                    Checked {new Date(prebuild.record.weather_checked_at).toLocaleString()}
                    {prebuild.readiness.weather_age_hours !== null ? ` · ${prebuild.readiness.weather_age_hours.toFixed(1)}h ago` : ''}
                  </p>
                )}
              </div>
            </div>
          )}
          <p className="mt-3 text-xs text-slate-500">
            A recorded decision is a human entry, not a live permit-office or weather-provider check. Clear weather is stale after 24 hours.
          </p>
        </section>
      )}

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

      <section className="rounded-xl border border-white/10 bg-slate-900 p-5">
        <h2 className="font-semibold">Field updates</h2>
        <p className="mt-1 text-xs text-slate-500">
          Append-only daily evidence. A correction is a new update, not an edit.
        </p>
        {updates.length === 0 ? (
          <p className="mt-2 text-sm text-slate-400">No field updates yet.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {updates.map((row) => (
              <li key={row.id} className="rounded border border-white/10 bg-black/20 p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold">{row.work_date}</span>
                  <span className="text-xs text-slate-400">
                    {row.percent_complete === null ? 'No percent reported' : `${row.percent_complete}% complete`}
                  </span>
                </div>
                <p className="mt-1 text-slate-200">{row.note}</p>
                {row.blockers && <p className="mt-1 text-xs text-amber-200">Blockers: {row.blockers}</p>}
                <p className="mt-1 text-xs text-slate-500">Recorded {new Date(row.created_at).toLocaleString()}</p>
              </li>
            ))}
          </ul>
        )}

        {jobActive && (
          <div className="mt-4 space-y-2 border-t border-white/10 pt-3">
            <h3 className="text-sm font-semibold">Add daily update</h3>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="text-xs text-slate-300">Work date
                <input type="date" value={workDate} max={new Date().toISOString().slice(0, 10)} onChange={(event) => setWorkDate(event.target.value)} className="mt-1 w-full rounded border border-white/15 bg-black/25 p-2 text-sm" />
              </label>
              <label className="text-xs text-slate-300">Percent complete (optional)
                <input type="number" min="0" max="100" step="1" value={percentComplete} onChange={(event) => setPercentComplete(event.target.value)} className="mt-1 w-full rounded border border-white/15 bg-black/25 p-2 text-sm" />
              </label>
            </div>
            <label className="block text-xs text-slate-300">What happened
              <textarea value={updateNote} maxLength={2000} onChange={(event) => setUpdateNote(event.target.value)} className="mt-1 h-20 w-full rounded border border-white/15 bg-black/25 p-2 text-sm" />
            </label>
            <label className="block text-xs text-slate-300">Blockers (optional)
              <input value={updateBlockers} maxLength={1000} onChange={(event) => setUpdateBlockers(event.target.value)} className="mt-1 w-full rounded border border-white/15 bg-black/25 p-2 text-sm" />
            </label>
            <button disabled={busy} onClick={() => void addFieldUpdate()} className="rounded bg-cyan-600 px-3 py-2 text-sm font-semibold hover:bg-cyan-500 disabled:opacity-60">Record field update</button>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-white/10 bg-slate-900 p-5">
        <h2 className="font-semibold">Change orders</h2>
        {changeSummary && (
          <p className="mt-1 text-xs text-slate-400">
            {changeSummary.approved_count} approved · {changeSummary.requested_count} awaiting review · approved delta{' '}
            <span className="font-mono text-slate-200">{describeAmountDelta(changeSummary.approved_delta_total)}</span>
            {changeSummary.has_pending ? ` · ${describeAmountDelta(changeSummary.requested_delta_total)} pending, not invoiced` : ''}
          </p>
        )}
        {changeOrders.length === 0 ? (
          <p className="mt-2 text-sm text-slate-400">No change orders. Field updates alone never change scope or price.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {changeOrders.map((row) => (
              <li key={row.id} className="rounded border border-white/10 bg-black/20 p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold">{row.description}</span>
                  <span className={row.status === 'approved' ? 'text-emerald-300' : row.status === 'declined' ? 'text-slate-400' : 'text-amber-300'}>
                    {describeChangeOrderStatus(row.status)}
                  </span>
                </div>
                <p className="font-mono text-xs text-slate-300">{describeAmountDelta(row.amount_delta)}</p>
                {row.reason && <p className="mt-1 text-xs text-slate-400">{row.reason}</p>}
                {row.decided_at && (
                  <p className="mt-1 text-xs text-slate-500">
                    Decided {new Date(row.decided_at).toLocaleString()}
                    {row.decision_note ? ` · ${row.decision_note}` : ''}
                  </p>
                )}
                {canDecide && jobActive && nextChangeOrderDecisions(row.status).length > 0 && (
                  <div className="mt-2 space-y-2">
                    <input value={coNote} maxLength={1000} onChange={(event) => setCoNote(event.target.value)} placeholder="Decision note (optional)" className="w-full rounded border border-white/15 bg-black/25 p-2 text-xs" />
                    <div className="flex flex-wrap gap-2">
                      {CHANGE_ORDER_DECISIONS.map((decision) => (
                        <button
                          key={decision}
                          disabled={busy}
                          onClick={() => void decideChangeOrder(row.id, decision)}
                          className="rounded border border-cyan-500/60 px-2 py-1 text-xs text-cyan-200 hover:bg-cyan-500/10 disabled:opacity-60"
                        >
                          {describeChangeOrderStatus(decision)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        {jobActive && (
          <div className="mt-4 space-y-2 border-t border-white/10 pt-3">
            <h3 className="text-sm font-semibold">Request a change order</h3>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="text-xs text-slate-300">Description
                <input value={coDescription} maxLength={1000} onChange={(event) => setCoDescription(event.target.value)} className="mt-1 w-full rounded border border-white/15 bg-black/25 p-2 text-sm" />
              </label>
              <label className="text-xs text-slate-300">Amount delta (negative is a credit)
                <input type="number" step="0.01" value={coAmount} onChange={(event) => setCoAmount(event.target.value)} className="mt-1 w-full rounded border border-white/15 bg-black/25 p-2 text-sm" />
              </label>
            </div>
            <label className="block text-xs text-slate-300">Reason (optional)
              <input value={coReason} maxLength={1000} onChange={(event) => setCoReason(event.target.value)} className="mt-1 w-full rounded border border-white/15 bg-black/25 p-2 text-sm" />
            </label>
            <button disabled={busy} onClick={() => void requestChangeOrder()} className="rounded bg-cyan-600 px-3 py-2 text-sm font-semibold hover:bg-cyan-500 disabled:opacity-60">Request change order</button>
          </div>
        )}
        <p className="mt-3 text-xs text-slate-500">
          Approval is an owner or administrator decision inside Roof OS. It is not a customer signature, a contract amendment sent to the customer, or a payment. An approved delta is a separate invoice input and never rewrites the accepted total or approved scope.
        </p>
      </section>

      <section className="rounded-xl border border-white/10 bg-slate-900 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">Invoice</h2>
          <span className="text-xs text-slate-400">{invoices.length === 0 ? 'No invoice yet' : `${invoices.length} record${invoices.length === 1 ? '' : 's'}`}</span>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          The database builds the invoice from the approved scope, the recorded tax, approved change orders, and the deposit received. It never accepts an amount from this page.
        </p>

        {invoicePreview && (
          <dl className="mt-3 grid gap-1 text-sm sm:grid-cols-2">
            <div className="flex justify-between rounded border border-white/10 bg-black/20 px-3 py-1">
              <dt className="text-slate-400">Approved scope</dt>
              <dd>{money(Number(invoicePreview.subtotal) - Number(invoicePreview.change_order_total))}</dd>
            </div>
            <div className="flex justify-between rounded border border-white/10 bg-black/20 px-3 py-1">
              <dt className="text-slate-400">Approved change orders</dt>
              <dd>{money(Number(invoicePreview.change_order_total))}</dd>
            </div>
            <div className="flex justify-between rounded border border-white/10 bg-black/20 px-3 py-1">
              <dt className="text-slate-400">Tax</dt>
              <dd>{money(Number(invoicePreview.tax))}</dd>
            </div>
            <div className="flex justify-between rounded border border-white/10 bg-black/20 px-3 py-1">
              <dt className="text-slate-400">Deposit credit</dt>
              <dd>-{money(Number(invoicePreview.deposit_credit))}</dd>
            </div>
            <div className="flex justify-between rounded border border-cyan-500/30 bg-cyan-400/5 px-3 py-1 font-semibold">
              <dt>Invoice total</dt>
              <dd>{money(Number(invoicePreview.total))}</dd>
            </div>
            <div className="flex justify-between rounded border border-emerald-500/30 bg-emerald-400/5 px-3 py-1 font-semibold">
              <dt>Balance after deposit</dt>
              <dd>{money(Number(invoicePreview.balance_due))}</dd>
            </div>
          </dl>
        )}

        {invoicePreview && !invoicePreview.reconciles && (
          <div className="mt-2 space-y-1">
            {invoicePreview.blockers.map((blocker) => (
              <p key={blocker} className="text-xs text-amber-200">{blocker}</p>
            ))}
          </div>
        )}

        {invoices.length > 0 && (
          <ul className="mt-3 space-y-2">
            {invoices.map((invoice) => (
              <li key={invoice.id} className="rounded border border-white/10 bg-black/20 p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold">{invoice.invoice_number}</span>
                  <span className={invoice.status === 'issued' ? 'text-cyan-300' : invoice.status === 'void' ? 'text-slate-500' : 'text-amber-300'}>
                    {describeInvoiceStatus(invoice.status)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  Subtotal {money(Number(invoice.subtotal))} · tax {money(Number(invoice.tax))} · total {money(Number(invoice.total))} · deposit {money(Number(invoice.deposit_credit))} · balance {money(Number(invoice.balance_due))}
                </p>
                {Number(invoice.change_order_total) !== 0 && (
                  <p className="text-xs text-slate-400">Includes approved change orders of {money(Number(invoice.change_order_total))}.</p>
                )}
                {invoice.issued_at && <p className="text-xs text-slate-500">Issued {new Date(invoice.issued_at).toLocaleString()}</p>}
                {invoice.voided_at && (
                  <p className="text-xs text-slate-500">Voided {new Date(invoice.voided_at).toLocaleString()}{invoice.void_reason ? ` · ${invoice.void_reason}` : ''}</p>
                )}
                {canManageInvoices && nextInvoiceStatuses(invoice.status).length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {nextInvoiceStatuses(invoice.status).map((status) => (
                      <button
                        key={status}
                        disabled={busy}
                        onClick={() => void moveInvoice(invoice.id, status === 'issued' ? 'issue' : 'void')}
                        className="rounded border border-cyan-500/60 px-2 py-1 text-xs text-cyan-200 hover:bg-cyan-500/10 disabled:opacity-60"
                      >
                        {status === 'issued' ? 'Issue invoice' : 'Void invoice'}
                      </button>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        {canManageInvoices && jobActive && !invoices.some((invoice) => invoice.status !== 'void') && (
          <div className="mt-3 space-y-2 border-t border-white/10 pt-3">
            <button disabled={busy || invoicePreview?.reconciles === false} onClick={() => void createInvoice()} className="rounded bg-cyan-600 px-3 py-2 text-sm font-semibold hover:bg-cyan-500 disabled:opacity-60">
              Create draft invoice
            </button>
            <label className="block text-xs text-slate-300">Void reason (used only when voiding)
              <input value={invoiceVoidReason} maxLength={1000} onChange={(event) => setInvoiceVoidReason(event.target.value)} className="mt-1 w-full rounded border border-white/15 bg-black/25 p-2 text-sm" />
            </label>
          </div>
        )}

        <p className="mt-3 text-xs text-slate-500">
          An invoice records what the customer accepted plus any approved change orders. It is not a payment, a receipt, a card charge, a carrier submission, or a promise that money was received.
        </p>
      </section>

      <section className="rounded-xl border border-white/10 bg-slate-900 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">QC punch list</h2>
          {closeout && (
            <span className={`rounded px-2 py-0.5 text-xs font-semibold ${closeout.gate.can_close ? 'bg-emerald-400/15 text-emerald-200' : 'bg-amber-400/15 text-amber-200'}`}>
              {closeout.gate.open_critical > 0 ? `${closeout.gate.open_critical} critical open` : 'No critical open'}
            </span>
          )}
        </div>
        <p className="mt-1 text-xs text-slate-500">
          A critical defect blocks the supervisor closeout and job completion. A resolved item is immutable; a correction is a new item.
        </p>
        {punchItems.length === 0 ? (
          <p className="mt-2 text-sm text-slate-400">No punch items recorded.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {punchItems.map((row) => (
              <li key={row.id} className="rounded border border-white/10 bg-black/20 p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold">{describePunchSeverity(row.severity)}</span>
                  <span className={row.status === 'resolved' ? 'text-emerald-300' : row.severity === 'critical' ? 'text-red-300' : 'text-amber-300'}>
                    {describePunchStatus(row.status)}
                  </span>
                </div>
                <p className="mt-1 text-slate-200">{row.description}</p>
                {row.location && <p className="text-xs text-slate-400">Location: {row.location}</p>}
                <p className="mt-1 text-xs text-slate-500">Recorded {new Date(row.created_at).toLocaleString()}</p>
                {row.resolved_at && (
                  <p className="text-xs text-slate-500">
                    Resolved {new Date(row.resolved_at).toLocaleString()}
                    {row.resolution_note ? ` · ${row.resolution_note}` : ''}
                  </p>
                )}
                {jobActive && canResolvePunchItem(row.status) && (
                  <div className="mt-2 space-y-2">
                    <input value={resolutionNote} maxLength={1000} onChange={(event) => setResolutionNote(event.target.value)} placeholder="Resolution note (optional)" className="w-full rounded border border-white/15 bg-black/25 p-2 text-xs" />
                    <button disabled={busy} onClick={() => void resolvePunchItem(row.id)} className="rounded border border-cyan-500/60 px-2 py-1 text-xs text-cyan-200 hover:bg-cyan-500/10 disabled:opacity-60">Resolve punch item</button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        {jobActive && (
          <div className="mt-4 space-y-2 border-t border-white/10 pt-3">
            <h3 className="text-sm font-semibold">Record a punch item</h3>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="text-xs text-slate-300">Severity
                <select value={punchSeverity} onChange={(event) => setPunchSeverity(event.target.value)} className="mt-1 w-full rounded border border-white/15 bg-black/25 p-2 text-sm">
                  {PUNCH_SEVERITIES.map((value) => <option key={value} value={value}>{describePunchSeverity(value)}</option>)}
                </select>
              </label>
              <label className="text-xs text-slate-300">Location (optional)
                <input value={punchLocation} maxLength={200} onChange={(event) => setPunchLocation(event.target.value)} className="mt-1 w-full rounded border border-white/15 bg-black/25 p-2 text-sm" />
              </label>
            </div>
            <label className="block text-xs text-slate-300">Defect
              <textarea value={punchDescription} maxLength={1000} onChange={(event) => setPunchDescription(event.target.value)} className="mt-1 h-16 w-full rounded border border-white/15 bg-black/25 p-2 text-sm" />
            </label>
            <button disabled={busy} onClick={() => void addPunchItem()} className="rounded bg-cyan-600 px-3 py-2 text-sm font-semibold hover:bg-cyan-500 disabled:opacity-60">Record punch item</button>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-white/10 bg-slate-900 p-5">
        <h2 className="font-semibold">Supervisor closeout</h2>
        {closeout?.closeout ? (
          <div className="mt-2 rounded border border-emerald-500/30 bg-emerald-400/5 p-3 text-sm">
            <p className="font-semibold text-emerald-200">Closeout recorded {new Date(closeout.closeout.closed_at).toLocaleString()}</p>
            <p className="mt-1 text-xs text-slate-300">
              Open critical at closeout: {closeout.closeout.open_critical_count} · open items at closeout: {closeout.closeout.open_total_count}
            </p>
            {closeout.closeout.note && <p className="mt-1 text-xs text-slate-300">{closeout.closeout.note}</p>}
          </div>
        ) : (
          <div className="mt-2 space-y-2">
            <p className="text-sm text-slate-300">
              {closeout
                ? `${closeout.gate.open_critical} critical open · ${closeout.gate.open_total} total open`
                : 'Closeout status unavailable.'}
            </p>
            {closeout?.gate.blockers.map((blocker) => (
              <p key={blocker} className="text-xs text-amber-200">{blocker}</p>
            ))}
            {closeout?.can_close ? (
              <div className="space-y-2 border-t border-white/10 pt-3">
                <label className="block text-xs text-slate-300">Closeout note (optional)
                  <input value={closeoutNote} maxLength={2000} onChange={(event) => setCloseoutNote(event.target.value)} className="mt-1 w-full rounded border border-white/15 bg-black/25 p-2 text-sm" />
                </label>
                <button disabled={busy} onClick={() => void recordCloseout()} className="rounded bg-cyan-600 px-3 py-2 text-sm font-semibold hover:bg-cyan-500 disabled:opacity-60">Record closeout</button>
              </div>
            ) : (
              <p className="text-xs text-slate-500">
                {jobActive
                  ? 'A workspace owner or administrator records the closeout while the job is in progress and no critical punch item is open.'
                  : 'A supervisor closeout is required before the job can be completed.'}
              </p>
            )}
          </div>
        )}

        {canEdit && jobActive && (
          <div className="mt-4 space-y-2 border-t border-white/10 pt-3">
            <h3 className="text-sm font-semibold">Move job status</h3>
            <div className="flex flex-wrap gap-2">
              {nextProductionJobStatuses(job.status).map((status) => (
                <button
                  key={status}
                  disabled={busy}
                  onClick={() => void moveStatus(status)}
                  className="rounded border border-cyan-500/60 px-2 py-1 text-xs text-cyan-200 hover:bg-cyan-500/10 disabled:opacity-60"
                >
                  {describeProductionJobStatus(status)}
                </button>
              ))}
            </div>
            {job.status === 'in_progress' && (
              <p className="text-xs text-slate-500">
                Completion is refused until a supervisor closeout exists and no critical punch item is open.
              </p>
            )}
          </div>
        )}
        <p className="mt-3 text-xs text-slate-500">
          A closeout is an internal supervisor record. It is not a warranty, an invoice, a final payment, a carrier submission, or a customer sign-off. Completion does not create a warranty.
        </p>
      </section>

      <p className="text-xs text-slate-500">
        Schedule rows are operational. They never change the accepted customer, amount, scope, or warranty, and nothing here orders material or promises a crew.
      </p>
    </main>
  )
}
