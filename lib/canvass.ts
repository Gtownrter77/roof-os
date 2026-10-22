/** Canvass is a field mode of Leads — not a separate CRM. */
export const CANVASS_LEAD_SOURCE = 'canvasser_door_knocking'

export type CanvassOutcome = 'INTERESTED' | 'NOT_HOME' | 'INSPECTED' | 'DO_NOT_KNOCK'

export function isCanvassSource(source: string | null | undefined): boolean {
  return (source || '').trim().toLowerCase() === CANVASS_LEAD_SOURCE
}

export function canvassOutcomeToLeadFields(outcome: CanvassOutcome): {
  status: string
  next_action: string | null
  lost_reason: string | null
  lost_reason_detail: string | null
  lost_at: string | null
} {
  switch (outcome) {
    case 'INTERESTED':
      return {
        status: 'new',
        next_action: 'Schedule field inspection',
        lost_reason: null,
        lost_reason_detail: null,
        lost_at: null,
      }
    case 'NOT_HOME':
      return {
        status: 'new',
        next_action: 'Return visit / follow up door hanger',
        lost_reason: null,
        lost_reason_detail: null,
        lost_at: null,
      }
    case 'INSPECTED':
      return {
        status: 'inspected',
        next_action: 'Upload photos and draft report',
        lost_reason: null,
        lost_reason_detail: null,
        lost_at: null,
      }
    case 'DO_NOT_KNOCK':
      return {
        status: 'lost',
        next_action: null,
        lost_reason: 'other',
        lost_reason_detail: 'Do not knock / no soliciting',
        lost_at: new Date().toISOString(),
      }
  }
}

export function normalizeAddress(address: string): string {
  return address.trim().replace(/\s+/g, ' ').toLowerCase()
}
