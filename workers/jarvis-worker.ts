// The single existing JARVIS worker. Every queue job type has a real handler;
// an unhandled type fails honestly with an adjuster_error note.

import { JARVIS_JOB_TYPES, type JarvisJob, type JarvisJobType } from '../lib/jarvis/types.ts'

type JobContext = {
  guards: { authorize: (job: JarvisJob) => unknown }
  gateway: { send: (job: JarvisJob) => unknown }
  orchestrator: { transition: (job: JarvisJob) => unknown }
  documents: { generate: (job: JarvisJob) => unknown }
  extraction: { extract: (job: JarvisJob) => unknown }
  sandbox: { run: (job: JarvisJob) => unknown }
}

export type JobHandler = (job: JarvisJob, context: JobContext) => Promise<unknown> | unknown

export const HANDLERS: Record<JarvisJobType, JobHandler> = {
  run_claim_plan: (job, context) => context.orchestrator.transition(job),
  update_claim_status: (job, context) => context.orchestrator.transition(job),
  send_message: (job, context) => {
    if (!context.guards.authorize(job)) throw Object.assign(new Error('Send blocked by guardrails'), { code: 'adjuster_error' })
    return context.gateway.send(job)
  },
  generate_document: (job, context) => context.documents.generate(job),
  extract_estimate: (job, context) => context.extraction.extract(job),
  sandbox_action: (job, context) => context.sandbox.run(job),
}

// Fail closed: a registry missing a job type is not a deployable worker.
if (JARVIS_JOB_TYPES.some((type) => typeof HANDLERS[type] !== 'function')) {
  throw new Error('JARVIS worker is missing a job handler')
}

export async function processJob(job: Pick<JarvisJob, 'id' | 'type' | 'payload'>, context: JobContext) {
  const handler = (HANDLERS as Record<string, JobHandler>)[job.type]
  if (!handler) {
    throw Object.assign(new Error(`No handler registered for job type ${job.type}`), { code: 'adjuster_error' })
  }
  return handler(job as JarvisJob, context)
}

export function createWorker(context: JobContext) {
  return {
    handlers: HANDLERS,
    run: (job: JarvisJob) => processJob(job, context),
  }
}
