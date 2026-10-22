export type ObjectionType =
  | 'NO_DAMAGE'
  | 'NEW_ROOF'
  | 'HAVE_ADJUSTER'
  | 'NO_TIME'
  | 'SEND_EMAIL'
  | 'SPOUSE'
  | 'RATES_GO_UP'

export type CanvassAdvice = {
  openerScript: string
  objectionResponse?: string
  collateralChecklist: string[]
  goldenReportRuleNote: string
}

export function getCanvassAdvice(input: {
  address: string
  stormDate?: string
  objection?: ObjectionType
}): CanvassAdvice {
  const location = input.address.trim() || 'the area'
  const stormText = input.stormDate ? `following the ${input.stormDate} storm` : 'about roof inspections and documentation'

  const advice: CanvassAdvice = {
    openerScript: `Hi! My name is [Name] with [Company]. We are speaking with homeowners in ${location} ${stormText}. Would you like information about scheduling a roof inspection? We can explain the scope and any cost before starting.`,
    collateralChecklist: [
      'Downspouts & Gutter Metal Indentations',
      'Window Screen Mesh Tears & Vinyl Bead Denting',
      'Garage Door Metal Panel Dents',
      'AC Condenser Unit Fin Crushing',
      'Mailbox & Outdoor Light Fixture Spatter',
    ],
    goldenReportRuleNote: 'Golden Report Rule: Every observation must be grounded in an uploaded photo with plain alt text and confirmed by a technician. Never quote prices or guarantee carrier approvals at the door.',
  }

  if (input.objection) {
    switch (input.objection) {
      case 'NO_DAMAGE':
        advice.objectionResponse = 'I understand. I cannot determine roof condition from the street. If you are interested, we can explain the scope of an inspection and document only what is actually observed.'
        break
      case 'NEW_ROOF':
        advice.objectionResponse = 'That makes sense. A newer roof can still benefit from periodic checks, but I cannot determine damage without an inspection. We can explain the inspection scope before you decide.'
        break
      case 'HAVE_ADJUSTER':
        advice.objectionResponse = 'That is fine. You can wait for the adjuster or ask your insurer what documentation they need. If you want an independent inspection, we can explain its scope and cost before you decide.'
        break
      case 'NO_TIME':
        advice.objectionResponse = 'No problem. If you would like, we can arrange a time that works for you. We will not inspect or photograph your property without permission.'
        break
      case 'SEND_EMAIL':
        advice.objectionResponse = 'Certainly. If you choose to share your contact details, we can explain what information we can provide and any fees before arranging a visit.'
        break
      case 'SPOUSE':
        advice.objectionResponse = 'Of course. Take the time you need. If you would like, we can arrange a time when both of you can be present.'
        break
      case 'RATES_GO_UP':
        advice.objectionResponse = 'I cannot predict whether a claim will affect your premium. Rates and claim handling vary by insurer, policy, and circumstances. Check with your insurer before deciding whether to file.'
        break
    }
  }

  return advice
}
