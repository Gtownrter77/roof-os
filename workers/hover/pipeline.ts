import { spawnSync } from 'node:child_process'
import type { InputManifest, StageResult } from '../../lib/hover/types.ts'

export const PIPELINE_STAGES = [
  'validate', 'reconstruct', 'scale', 'segment', 'measure', 'qa', 'render', 'report',
] as const
export type PipelineStage = typeof PIPELINE_STAGES[number]

export type PipelineContext = { stage: PipelineStage; attempt: number }

export type Adapter = {
  name: string
  version: string
  available: () => boolean
  run: (manifest: InputManifest, ctx: PipelineContext) => unknown | Promise<unknown>
}

export type PipelineResult = {
  ok: boolean
  stages: StageResult[]
  failedStage?: PipelineStage
}

export async function runPipeline(
  manifest: InputManifest,
  adapters: Partial<Record<PipelineStage, Adapter>>,
  options: { maxRetries?: number } = {},
): Promise<PipelineResult> {
  const maxRetries = options.maxRetries ?? 2
  const stages: StageResult[] = []

  for (const stage of PIPELINE_STAGES) {
    const adapter = adapters[stage]
    if (!adapter || !adapter.available()) {
      stages.push({
        stage, status: 'skipped', adapter: adapter?.name ?? 'none', output: null,
        error: `adapter ${adapter?.name ?? 'none'} not available for ${stage}`,
      })
      return { ok: false, failedStage: stage, stages }
    }

    let attempt = 0
    let lastError: unknown
    let output: unknown
    let succeeded = false
    while (attempt <= maxRetries) {
      try {
        output = await adapter.run(manifest, { stage, attempt: attempt + 1 })
        succeeded = true
        break
      } catch (error) {
        lastError = error
        attempt += 1
      }
    }
    if (!succeeded) {
      stages.push({
        stage, status: 'failed', adapter: adapter.name, output: null,
        error: lastError instanceof Error ? lastError.message : String(lastError),
      })
      return { ok: false, failedStage: stage, stages }
    }
    stages.push({ stage, status: 'ok', adapter: adapter.name, output })
  }
  return { ok: true, stages }
}

/** OSS CLI adapters are opt-in: they never fabricate geometry when a binary is absent. */
export function cliAdapter(name: string, version: string, binary: string, args: string[]): Adapter {
  return {
    name, version,
    available: () => spawnSync('sh', ['-c', `command -v ${binary}`], { encoding: 'utf8' }).status === 0,
    run: (manifest) => {
      const result = spawnSync(binary, [...args, manifest.manifestHash], { encoding: 'utf8' })
      if (result.status !== 0) {
        throw new Error(`${binary} exited ${result.status}: ${(result.stderr || '').slice(0, 300)}`)
      }
      return { binary, stdout: (result.stdout || '').slice(0, 10000) }
    },
  }
}
