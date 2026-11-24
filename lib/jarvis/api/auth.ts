// Authentication for the single JARVIS worker. The daily cron dispatcher uses
// CRON_SECRET; direct/operator calls may use a dedicated worker secret. Both are
// deployment secrets and neither is inferred from a request body.

export type WorkerSecrets = { worker: string; cron: string }

export function isAuthorizedWorkerAuthHeader(header: string | null, secrets: WorkerSecrets): boolean {
  if (!header) return false
  const candidate = header.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : ''
  if (!candidate) return false
  return [secrets.worker, secrets.cron].some((secret) => secret.length > 0 && candidate === secret)
}
