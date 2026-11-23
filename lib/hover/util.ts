import { createHash, randomUUID } from 'node:crypto'

export function hashBytes(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex')
}

export function hashText(text: string): string {
  return hashBytes(new TextEncoder().encode(text))
}

export function roundTo(value: number, digits = 2): number {
  if (!Number.isFinite(value)) throw new TypeError('roundTo requires a finite number')
  const factor = 10 ** digits
  return Math.round((value + Number.EPSILON) * factor) / factor
}

export function finite(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError('expected a finite number')
  }
  return value
}

export function uuid(): string {
  return randomUUID()
}

export function now(): string {
  return new Date().toISOString()
}

export function assertWorkspaceMatch(jobWorkspaceId: string, callerWorkspaceId: string): void {
  if (!jobWorkspaceId || jobWorkspaceId !== callerWorkspaceId) {
    throw new Error('workspace mismatch')
  }
}
