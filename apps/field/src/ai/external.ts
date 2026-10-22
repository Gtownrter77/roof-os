import { loadYolo, enqueue, type YoloFlags, type QueuedItem } from './behaviors'

const BASE = process.env.EXPO_PUBLIC_WEB_URL || ''

async function post(path: string, payload: unknown) {
  if (!BASE) return { offline: true }
  try {
    const res = await fetch(`${BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    return await res.json()
  } catch {
    return { offline: true }
  }
}

export async function sendCustomerText(to: string, text: string, flags: YoloFlags): Promise<QueuedItem> {
  const local = await enqueue('customer-text', { to, text, applied: flags.unlocked && (flags.freeCustomerText || flags.freeAll) })
  const remote = await post('/api/field/sms', { to, text })
  return { ...local, payload: { ...(local.payload as object), remote } }
}

export async function sendMaterialOrder(supplier: string, lines: string[], flags: YoloFlags): Promise<QueuedItem> {
  const local = await enqueue('material-order', { supplier, lines, applied: flags.unlocked && (flags.freeMaterialOrder || flags.freeAll) })
  const remote = await post('/api/field/material-order', { supplier, lines })
  return { ...local, payload: { ...(local.payload as object), remote } }
}

export async function sendESign(ready: boolean, total: number): Promise<QueuedItem> {
  const local = await enqueue('esign', { ready, total })
  const remote = await post('/api/field/esign', { ready, total })
  return { ...local, payload: { ...(local.payload as object), remote } }
}
