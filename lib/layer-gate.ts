import type { EmployeeLayer } from './employee-layers'

export const LAYER_CAN = {
  owner: ['settings', 'yolo', 'money', 'all-jobs', 'invite', 'estimate', 'inspection', 'knock', 'production'],
  operations: ['money', 'all-jobs', 'invite', 'estimate', 'inspection'],
  inspector: ['inspection'],
  closer: ['estimate'],
  canvasser: ['knock'],
  production: ['production'],
} as const

export type LayerAction = (typeof LAYER_CAN)[EmployeeLayer][number]

export function layerAllows(layer: EmployeeLayer | null | undefined, action: LayerAction) {
  if (!layer) return false
  return (LAYER_CAN[layer] as readonly string[]).includes(action)
}

export function agentRefusal(layer: EmployeeLayer | null | undefined, instruction: string) {
  const text = instruction.toLowerCase()
  if (!layer || layer === 'canvasser') {
    if (/\b(price|estimate|quote|settings|yolo)\b/.test(text)) {
      return 'Canvassers can capture the knock only. Pricing and settings are closed.'
    }
  }
  if (layer !== 'owner' && /\b(settings|yolo|authorize)\b/.test(text)) {
    return 'Only the owner can change settings.'
  }
  if (layer === 'production' && /\b(price|money|other job|contact list)\b/.test(text)) {
    return 'Production can confirm the assigned work order only.'
  }
  return null
}
