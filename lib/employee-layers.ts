export const EMPLOYEE_LAYERS = [
  {
    id: 'owner',
    label: 'Owner',
    summary: 'System of record. Settings, money, team, YOLO MODE, and the 2-part authorization.',
    ai: 'Full process agent. Stops for approval unless YOLO MODE is on.',
    access: 'Desktop + inspector app',
    sees: 'Everything',
  },
  {
    id: 'operations',
    label: 'Operations',
    summary: 'Runs the office. Pipeline, scheduling, estimates, and invites. No owner settings.',
    ai: 'Ops agent drafts follow-ups and schedules. Cannot change settings or run YOLO.',
    access: 'Desktop',
    sees: 'All jobs',
  },
  {
    id: 'inspector',
    label: 'Inspector',
    summary: 'Field inspection console. Photos, measurements, notes, and the desktop bridge.',
    ai: 'Page agent fills the inspection. Measurement gospel and photo review stay human-approved.',
    access: 'Inspector app + desktop bridge',
    sees: 'Assigned inspections',
  },
  {
    id: 'closer',
    label: 'Closer',
    summary: 'Leads, estimates, and e-sign. No settings and no owner money controls.',
    ai: 'Estimate agent drafts the packet. The closer approves before it is sent.',
    access: 'Desktop',
    sees: 'Assigned leads and estimates',
  },
  {
    id: 'canvasser',
    label: 'Canvasser',
    summary: 'Door knocking and lead capture only. No YOLO. No settings. No pricing.',
    ai: 'Capture agent writes the knock. It cannot price, change settings, or skip approval.',
    access: 'Canvass tools',
    sees: 'Own knocks and leads',
  },
  {
    id: 'production',
    label: 'Production',
    summary: 'Assigned work only. Schedule, photos, checklists. No contact list, pricing, or settings.',
    ai: 'Checklist agent confirms the work order. It cannot see money or other jobs.',
    access: 'Assigned work',
    sees: 'Assigned work orders',
  },
] as const

export type EmployeeLayer = (typeof EMPLOYEE_LAYERS)[number]['id']

export const INVITE_LAYERS = EMPLOYEE_LAYERS.filter((layer) => layer.id !== 'owner')

export function layerToWorkspaceRole(layer: EmployeeLayer): 'admin' | 'member' {
  return layer === 'operations' ? 'admin' : 'member'
}
