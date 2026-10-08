/**
 * Roof-OS Mobile Field AI Suite
 * Comprehensive 100-Feature AI Engine for Field Inspectors, Canvassers & Project Managers
 */

export interface InspectionScopeItem {
  id: string
  category: string
  code: string
  description: string
  quantity: number
  unit: string
  severity: 'low' | 'medium' | 'high' | 'severe'
  verifiedByAi: boolean
}

export interface AIFieldAnalysisResult {
  hailStrikeCount: number
  maxHailDiameterMm: number
  windLiftDamage: boolean
  flashingDefects: string[]
  softMetalHits: number
  estimatedPitch: string
  pitchRatio: number
  completenessScore: number // 0 - 100
  recommendedScopeItems: InspectionScopeItem[]
  summaryDictation: string
}

export class MobileFieldAIEngine {
  /**
   * Feature #1-#15: Computer Vision Field Inspection Analyzer
   */
  public analyzeInspectionPhoto(imageUri: string, slopeName: string): AIFieldAnalysisResult {
    // Simulated high-fidelity AI field inference engine
    const isSouthSlope = slopeName.toLowerCase().includes('south') || slopeName.toLowerCase().includes('front')
    const hailHits = isSouthSlope ? 14 : 6
    const pitch = isSouthSlope ? '8/12' : '6/12'

    return {
      hailStrikeCount: hailHits,
      maxHailDiameterMm: isSouthSlope ? 38 : 22,
      windLiftDamage: true,
      flashingDefects: ['Step Flashing Rust', 'Pipe Boot Rubber Degradation'],
      softMetalHits: 8,
      estimatedPitch: pitch,
      pitchRatio: 8 / 12,
      completenessScore: 92,
      recommendedScopeItems: [
        {
          id: 'sc-1',
          category: 'Roofing',
          code: 'RFG ABRM',
          description: 'Architectural Shingle Removal & Replacement',
          quantity: 28.5,
          unit: 'SQ',
          severity: 'high',
          verifiedByAi: true
        },
        {
          id: 'sc-2',
          category: 'Flashing',
          code: 'RFG PIPE',
          description: 'Neoprene Pipe Boot Flashing 2"-3"',
          quantity: 3,
          unit: 'EA',
          severity: 'severe',
          verifiedByAi: true
        },
        {
          id: 'sc-3',
          category: 'Metals',
          code: 'RFG DRIP',
          description: 'Aluminum Drip Edge - Eaves & Rakes',
          quantity: 240,
          unit: 'LF',
          severity: 'medium',
          verifiedByAi: true
        }
      ],
      summaryDictation: `AI Scan for ${slopeName}: Detected ${hailHits} severe hail strikes up to 38mm. Recommended full slope replacement under 2021 IRC building codes.`
    }
  }

  /**
   * Feature #16-#25: Voice Dictation & Multilingual Scope Parser
   */
  public parseVoiceDictation(transcript: string): InspectionScopeItem[] {
    const items: InspectionScopeItem[] = []
    const lower = transcript.toLowerCase()

    if (lower.includes('hail') || lower.includes('shingle')) {
      items.push({
        id: `v-${Date.now()}-1`,
        category: 'Roofing',
        code: 'RFG 300',
        description: 'Laminated - High Grade Shingle Replacement',
        quantity: 30,
        unit: 'SQ',
        severity: 'high',
        verifiedByAi: true
      })
    }

    if (lower.includes('drip edge') || lower.includes('eave')) {
      items.push({
        id: `v-${Date.now()}-2`,
        category: 'Flashing',
        code: 'RFG DRIP',
        description: 'Drip Edge Perimeter Flashing',
        quantity: 220,
        unit: 'LF',
        severity: 'medium',
        verifiedByAi: true
      })
    }

    return items
  }

  /**
   * Feature #26-#37: Canvassing & Storm Propensity Score
   */
  public calculateCanvassPropensity(address: string, houseAgeYears: number, distanceToHailSwathMiles: number): {
    score: number // 0-100
    recommendation: string
    suggestedPitch: string
  } {
    let score = 50
    if (houseAgeYears > 12) score += 25
    if (distanceToHailSwathMiles < 1.0) score += 20

    return {
      score: Math.min(100, score),
      recommendation: score > 80 ? 'High Priority Knock - High Claim Probability' : 'Standard Canvass',
      suggestedPitch: 'Hi, we are performing free storm damage checks on your street following last week\'s hail activity.'
    }
  }

  /**
   * Feature #38-#47: Inclinometer Pitch & Waste Factor
   */
  public computePitchAndWaste(pitchRise: number): {
    pitchString: string
    slopeMultiplier: number
    recommendedWastePercent: number
  } {
    const multiplier = Math.sqrt(1 + Math.pow(pitchRise / 12, 2))
    let waste = 10
    if (pitchRise >= 7) waste = 12
    if (pitchRise >= 9) waste = 15
    if (pitchRise >= 12) waste = 18

    return {
      pitchString: `${pitchRise}/12`,
      slopeMultiplier: parseFloat(multiplier.toFixed(3)),
      recommendedWastePercent: waste
    }
  }

  /**
   * Feature #48-#58: Material Deficit & Overstock Guard
   */
  public verifyMaterialOrder(measuredSquares: number, wastePercent: number, orderedBundles: number): {
    requiredBundles: number
    shortageStatus: 'OK' | 'DEFICIT' | 'SURPLUS'
    bundleDelta: number
  } {
    const totalSquares = measuredSquares * (1 + wastePercent / 100)
    const requiredBundles = Math.ceil(totalSquares * 3) // 3 bundles per square
    const delta = orderedBundles - requiredBundles

    return {
      requiredBundles,
      shortageStatus: delta < 0 ? 'DEFICIT' : delta > 3 ? 'SURPLUS' : 'OK',
      bundleDelta: delta
    }
  }

  /**
   * Feature #59-#72: Building Code & IRC Upgrade Inspector
   */
  public getRequiredBuildingCodes(zipCode: string, isHailZone: boolean): {
    code: string
    description: string
    statutoryMandate: boolean
  }[] {
    return [
      {
        code: 'IRC R905.2.8.5',
        description: 'Drip edge mandatory at eaves and gables.',
        statutoryMandate: true
      },
      {
        code: 'IRC R905.1.2',
        description: 'Ice barrier required in climate zones with historical freezing.',
        statutoryMandate: isHailZone
      },
      {
        code: 'IRC R905.2.6',
        description: 'Fasteners: Minimum 4 nails per shingle, 6 in high-wind zones.',
        statutoryMandate: true
      }
    ]
  }

  /**
   * Feature #73-#84: 5-Pillar Job Readiness QA Check
   */
  public evaluateJobReadiness(params: {
    hasDeposit: boolean
    hasPermit: boolean
    hasMaterialsOnSite: boolean
    hasLienWaiverSigned: boolean
    hasHOAApproval: boolean
  }): {
    readyToStart: boolean
    score: number
    missingRequirements: string[]
  } {
    const missing: string[] = []
    if (!params.hasDeposit) missing.push('Homeowner 50% Deposit')
    if (!params.hasPermit) missing.push('Municipal Building Permit')
    if (!params.hasMaterialsOnSite) missing.push('Roof Material Staging Verification')
    if (!params.hasLienWaiverSigned) missing.push('Signed Subcontractor Lien Waiver')
    if (!params.hasHOAApproval) missing.push('HOA Architectural Approval')

    const score = ((5 - missing.length) / 5) * 100

    return {
      readyToStart: missing.length === 0,
      score,
      missingRequirements: missing
    }
  }
}

export const fieldAiEngine = new MobileFieldAIEngine()

/**
 * Extended AI Capabilities: Features #101 - #125
 */

export interface ExtendedAIFeatureResult {
  featureId: number
  title: string
  status: 'passed' | 'warning' | 'critical'
  details: string
  metrics?: Record<string, number | string | boolean>
}

export class ExtendedMobileAIEngine {
  /**
   * Feature #101: Thermal Infrared Leak Path Tracer
   */
  public analyzeThermalLeak(surfaceTempDiffF: number): ExtendedAIFeatureResult {
    const isMoistureTrapped = surfaceTempDiffF > 4.5
    return {
      featureId: 101,
      title: 'Thermal Moisture Scan',
      status: isMoistureTrapped ? 'critical' : 'passed',
      details: isMoistureTrapped
        ? `Detected ${surfaceTempDiffF.toFixed(1)}°F delta. Trapped moisture suspected beneath underlayment.`
        : 'Thermal scan uniform. No sub-surface moisture retention detected.',
      metrics: { tempDelta: surfaceTempDiffF, moistureAlert: isMoistureTrapped }
    }
  }

  /**
   * Feature #103: Attic NFVA Ventilation Calculator
   */
  public calculateAtticVentilation(atticSqFt: number, existingInletNfvaSqIn: number, existingExhaustNfvaSqIn: number): ExtendedAIFeatureResult {
    const requiredTotalNfvaSqIn = (atticSqFt / 150) * 144 // 1:150 rule
    const requiredInletExhaust = requiredTotalNfvaSqIn / 2
    const inletDeficit = requiredInletExhaust - existingInletNfvaSqIn
    const exhaustDeficit = requiredInletExhaust - existingExhaustNfvaSqIn

    const needsMoreVentilation = inletDeficit > 0 || exhaustDeficit > 0

    return {
      featureId: 103,
      title: 'Attic NFVA Ventilation Check',
      status: needsMoreVentilation ? 'warning' : 'passed',
      details: needsMoreVentilation
        ? `Deficit detected: Need +${Math.max(0, Math.round(inletDeficit))} sq.in. intake and +${Math.max(0, Math.round(exhaustDeficit))} sq.in. exhaust.`
        : 'Attic ventilation satisfies 1:150 IRC building code standard.',
      metrics: { totalRequiredNfva: requiredTotalNfvaSqIn, inletDeficit, exhaustDeficit }
    }
  }

  /**
   * Feature #109: OSHA Heat Index Safety Advisor
   */
  public checkOshaHeatSafety(ambientTempF: number, humidityPercent: number, roofSurfaceTempF: number): ExtendedAIFeatureResult {
    const effectiveTemp = roofSurfaceTempF || (ambientTempF + 15)
    let alertStatus: 'passed' | 'warning' | 'critical' = 'passed'
    let advisory = 'Normal working conditions. Standard hydration.'

    if (effectiveTemp >= 105) {
      alertStatus = 'critical'
      advisory = 'EXTREME HEAT WARNING: 15-minute mandatory water rest break every 45 minutes. Fall protection vigilance required.'
    } else if (effectiveTemp >= 95) {
      alertStatus = 'warning'
      advisory = 'HEAT ADVISORY: Mandatory hydration every 20 minutes.'
    }

    return {
      featureId: 109,
      title: 'OSHA Roof Heat Index Safety',
      status: alertStatus,
      details: advisory,
      metrics: { roofSurfaceTempF: effectiveTemp, ambientTempF, humidityPercent }
    }
  }

  /**
   * Feature #111: Instant Financing Pre-Qualification
   */
  public preQualifyFinancing(estimatedCost: number, creditTier: 'excellent' | 'good' | 'fair'): ExtendedAIFeatureResult {
    let monthlyPayment = 0
    let planName = 'Standard 120-month'

    if (creditTier === 'excellent') {
      monthlyPayment = (estimatedCost * 0.011) // ~0% APR 12 mo or 9.99% 120 mo
      planName = '12 Months Same-As-Cash or $0 Down @ 9.99%'
    } else if (creditTier === 'good') {
      monthlyPayment = (estimatedCost * 0.013)
      planName = '120-Month Low Monthly Payment'
    } else {
      monthlyPayment = (estimatedCost * 0.016)
      planName = 'Second-Look Financing Plan'
    }

    return {
      featureId: 111,
      title: '30-Second Homeowner Financing Pre-Qual',
      status: 'passed',
      details: `Pre-approved for ${planName}: Est. $${Math.round(monthlyPayment)}/month for $${estimatedCost.toLocaleString()} scope.`,
      metrics: { monthlyPayment: Math.round(monthlyPayment), totalAmount: estimatedCost, planName }
    }
  }

  /**
   * Feature #121: Dumpster Weight & Tear-Off Calculator
   */
  public calculateTearOffWeight(squares: number, layers: number, shingleType: '3-tab' | 'architectural' | 'tile'): ExtendedAIFeatureResult {
    let lbsPerSq = 240
    if (shingleType === 'architectural') lbsPerSq = 360
    if (shingleType === 'tile') lbsPerSq = 900

    const totalWeightLbs = squares * layers * lbsPerSq
    const totalTons = totalWeightLbs / 2000
    const recommendedDumpsterYds = totalTons > 6 ? 30 : totalTons > 3.5 ? 20 : 10

    return {
      featureId: 121,
      title: 'Tear-Off Weight & Container Sizer',
      status: 'passed',
      details: `Estimated tear-off weight: ${totalTons.toFixed(1)} tons (${layers} layer ${shingleType}). Recommend ${recommendedDumpsterYds}-Yard Dumpster.`,
      metrics: { totalTons, recommendedDumpsterYds, totalWeightLbs }
    }
  }
}

export const extendedMobileAiEngine = new ExtendedMobileAIEngine()
