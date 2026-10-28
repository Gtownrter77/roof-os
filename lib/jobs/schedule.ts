// Production job schedule helpers.
//
// Pure labels, transitions and counters for the crew/material schedule. The
// database owns the records and enforces the rules (migration 067). Nothing
// here derives a price, a readiness gate, or a warranty.

export type AssignmentRole = 'crew_lead' | 'crew' | 'material_runner'
export type AssignmentStatus = 'scheduled' | 'confirmed' | 'cancelled'
export type MaterialStatus = 'needed' | 'ordered' | 'delivered' | 'cancelled'

export const ASSIGNMENT_ROLES: AssignmentRole[] = ['crew_lead', 'crew', 'material_runner']
export const ASSIGNMENT_STATUSES: AssignmentStatus[] = ['scheduled', 'confirmed', 'cancelled']
export const MATERIAL_STATUSES: MaterialStatus[] = ['needed', 'ordered', 'delivered', 'cancelled']

export const ASSIGNMENT_TRANSITIONS: Record<AssignmentStatus, AssignmentStatus[]> = {
  scheduled: ['confirmed', 'cancelled'],
  confirmed: ['cancelled'],
  cancelled: [],
}

export const MATERIAL_TRANSITIONS: Record<MaterialStatus, MaterialStatus[]> = {
  needed: ['ordered', 'cancelled'],
  ordered: ['delivered', 'cancelled'],
  delivered: [],
  cancelled: [],
}

const ASSIGNMENT_LABELS: Record<AssignmentStatus, string> = {
  scheduled: 'Scheduled',
  confirmed: 'Confirmed',
  cancelled: 'Cancelled',
}

const MATERIAL_LABELS: Record<MaterialStatus, string> = {
  needed: 'Needed',
  ordered: 'Ordered',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
}

const ROLE_LABELS: Record<AssignmentRole, string> = {
  crew_lead: 'Crew lead',
  crew: 'Crew',
  material_runner: 'Material runner',
}

export function describeAssignmentStatus(status: string): string {
  return ASSIGNMENT_LABELS[status as AssignmentStatus] ?? 'Unknown status'
}

export function describeMaterialStatus(status: string): string {
  return MATERIAL_LABELS[status as MaterialStatus] ?? 'Unknown status'
}

export function describeAssignmentRole(role: string): string {
  return ROLE_LABELS[role as AssignmentRole] ?? 'Unknown role'
}

export function nextAssignmentStatuses(status: string): AssignmentStatus[] {
  return ASSIGNMENT_TRANSITIONS[status as AssignmentStatus] ?? []
}

export function nextMaterialStatuses(status: string): MaterialStatus[] {
  return MATERIAL_TRANSITIONS[status as MaterialStatus] ?? []
}

export function isValidScheduleWindow(start: string, end: string): boolean {
  const startTime = Date.parse(start)
  const endTime = Date.parse(end)
  return Number.isFinite(startTime) && Number.isFinite(endTime) && endTime > startTime
}

export interface ScheduleReadiness {
  assignments_total: number
  assignments_active: number
  crew_lead_assigned: boolean
  materials_total: number
  materials_needed: number
  materials_ordered: number
  materials_delivered_count: number
  /** Planning signals only. They do not close the Day 21 prebuild gate. */
  crew_scheduled: boolean
  materials_all_delivered: boolean
}

type AssignmentLike = { status?: string | null; role?: string | null }
type MaterialLike = { status?: string | null }

export function summarizeSchedule(
  assignments: AssignmentLike[],
  materials: MaterialLike[],
): ScheduleReadiness {
  const activeAssignments = assignments.filter((row) => row.status !== 'cancelled')
  const countedMaterials = materials.filter((row) => row.status !== 'cancelled')
  const delivered = countedMaterials.filter((row) => row.status === 'delivered').length
  return {
    assignments_total: assignments.length,
    assignments_active: activeAssignments.length,
    crew_lead_assigned: activeAssignments.some((row) => row.role === 'crew_lead'),
    materials_total: countedMaterials.length,
    materials_needed: countedMaterials.filter((row) => row.status === 'needed').length,
    materials_ordered: countedMaterials.filter((row) => row.status === 'ordered').length,
    materials_delivered_count: delivered,
    crew_scheduled: activeAssignments.length > 0,
    materials_all_delivered: countedMaterials.length > 0 && delivered === countedMaterials.length,
  }
}
