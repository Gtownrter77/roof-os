import { NextResponse } from 'next/server'
import { PhotoPipelineEngine, CandidateAddress, EstimateConfig } from '../../../../lib/ai/photo-pipeline-engine'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { action } = body

    if (action === 'disambiguate') {
      const { photoUri } = body
      const candidates = await PhotoPipelineEngine.disambiguatePhotoAddress(photoUri || 'sample-roof-photo.jpg')
      return NextResponse.json({
        success: true,
        candidatesCount: candidates.length,
        candidates
      })
    }

    if (action === 'execute_trifork') {
      const {
        pipelineId,
        confirmedAddress,
        includeDetachedBuildings,
        profitMarginPercent,
        includeDumpster,
        dumpsterFee,
        laborRatePerSquare,
        materialTier
      } = body

      const estimateConfig: EstimateConfig = {
        profitMarginPercent: profitMarginPercent ?? 35,
        includeDumpster: includeDumpster ?? true,
        dumpsterFee: dumpsterFee ?? 550,
        laborRatePerSquare: laborRatePerSquare ?? 85,
        materialTier: materialTier ?? 'architectural'
      }

      const report = await PhotoPipelineEngine.executeTriForkPipeline({
        pipelineId: pipelineId || `pipe-${Date.now()}`,
        confirmedAddress: confirmedAddress as CandidateAddress,
        includeDetachedBuildings: !!includeDetachedBuildings,
        estimateConfig
      })

      return NextResponse.json({
        success: true,
        report
      })
    }

    if (action === 'authorize_and_send') {
      const { report, techUserId, customerEmail, customerPhone } = body

      const dispatchResult = await PhotoPipelineEngine.authorizeAndDispatchReport({
        report,
        techUserId: techUserId || 'tech-field-01',
        customerEmail: customerEmail || 'customer@example.com',
        customerPhone: customerPhone || '+15551234567'
      })

      return NextResponse.json({
        success: true,
        message: 'Report authorized and instantly delivered to customer via Email & SMS',
        dispatchResult
      })
    }

    return NextResponse.json({ error: 'Invalid pipeline action requested' }, { status: 400 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Pipeline execution failed' }, { status: 500 })
  }
}
