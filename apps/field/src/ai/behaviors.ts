import * as SecureStore from 'expo-secure-store'

const YOLO_KEY = 'roofos.yolo.v1'
const QUEUE_KEY = 'roofos.queues.v1'

export type YoloFlags = {
  unlocked: boolean
  freeEstimate: boolean
  freePrefill: boolean
  freeCustomerText: boolean
  freeMaterialOrder: boolean
  freeAll: boolean
}

const DEFAULTS: YoloFlags = {
  unlocked: false,
  freeEstimate: false,
  freePrefill: false,
  freeCustomerText: false,
  freeMaterialOrder: false,
  freeAll: false,
}

export async function loadYolo(): Promise<YoloFlags> {
  try {
    const raw = await SecureStore.getItemAsync(YOLO_KEY)
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS
  } catch {
    return DEFAULTS
  }
}

export function canApply(flags: YoloFlags, kind: keyof YoloFlags): boolean {
  if (!flags.unlocked) return false
  if (flags.freeAll) return true
  return !!flags[kind]
}

export type QueuedItem = {
  id: string
  kind: 'estimate' | 'material-order' | 'customer-text' | 'desktop-approval' | 'work-order' | 'portal' | 'esign' | 'financing'
  payload: unknown
  createdAt: string
  status: 'queued' | 'applied'
}

async function loadQueue(): Promise<QueuedItem[]> {
  try {
    const raw = await SecureStore.getItemAsync(QUEUE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

async function saveQueue(items: QueuedItem[]) {
  await SecureStore.setItemAsync(QUEUE_KEY, JSON.stringify(items.slice(-200)))
}

export async function enqueue(kind: QueuedItem['kind'], payload: unknown): Promise<QueuedItem> {
  const item: QueuedItem = {
    id: `${kind}-${Date.now()}`,
    kind,
    payload,
    createdAt: new Date().toISOString(),
    status: 'queued',
  }
  const all = await loadQueue()
  all.push(item)
  await saveQueue(all)
  return item
}

export async function listQueue(): Promise<QueuedItem[]> {
  return loadQueue()
}

export async function applyEstimateDraft(items: unknown[], flags: YoloFlags) {
  if (canApply(flags, 'freeEstimate') || canApply(flags, 'freePrefill')) {
    return enqueue('estimate', { items, applied: true })
  }
  return enqueue('desktop-approval', { items, applied: false })
}

export async function applyMaterialOrder(lines: string[], flags: YoloFlags) {
  if (canApply(flags, 'freeMaterialOrder')) {
    return enqueue('material-order', { lines, applied: true })
  }
  return enqueue('material-order', { lines, applied: false })
}

export async function applyCustomerText(text: string, flags: YoloFlags) {
  if (canApply(flags, 'freeCustomerText')) {
    return enqueue('customer-text', { text, applied: true })
  }
  return enqueue('customer-text', { text, applied: false })
}

export async function applyWorkOrder(tasks: string[]) {
  return enqueue('work-order', { tasks })
}

export async function applyPortal(summary: string) {
  return enqueue('portal', { summary })
}

export async function applyESign(ready: boolean) {
  return enqueue('esign', { ready })
}

export async function applyFinancing(offer: string) {
  return enqueue('financing', { offer })
}
