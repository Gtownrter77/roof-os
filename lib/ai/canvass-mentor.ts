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
  const stormText = input.stormDate ? `following the ${input.stormDate} severe hail storm` : 'doing complimentary roof inspections in the neighborhood'

  const advice: CanvassAdvice = {
    openerScript: `Hi! My name is [Name] with [Company]. We are inspecting roofs on ${input.address || 'your street'} ${stormText}. We're offering a free 5-minute digital photo report to check for soft-metal hail impacts.`,
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
        advice.objectionResponse = 'I completely understand! Hail damage often fractures the asphalt underlayment beneath shingles without causing immediate leaks. Our 5-minute photo inspection checks soft metals to confirm if your roof was affected.'
        break
      case 'NEW_ROOF':
        advice.objectionResponse = 'That’s great that it’s newer! Even architectural shingles can suffer granule loss and seal compromise from 1.25"+ hail. We take quick ground-level photos so you have a baseline record.'
        break
      case 'HAVE_ADJUSTER':
        advice.objectionResponse = 'That’s smart that you reached out to them! Having an independent contractor photo report ensures you have a detailed line-item record before the adjuster arrives on site.'
        break
      case 'NO_TIME':
        advice.objectionResponse = 'No problem at all! You don’t need to stay outside with me. I can take quick photos from the ground and text you the digital photo report in 5 minutes.'
        break
      case 'SEND_EMAIL':
        advice.objectionResponse = 'Absolutely! What is the best cell number or email to send the photo report link to once it’s ready?'
        break
      case 'SPOUSE':
        advice.objectionResponse = 'Makes total sense! I can prepare the digital photo report today and schedule a quick 5-minute review with both of you whenever it’s convenient.'
        break
      case 'RATES_GO_UP':
        advice.objectionResponse = 'That is a very common concern! Act-of-god storm claims are catastrophe events classified by ZIP code, so individual policyholders are not singled out for rate increases.'
        break
    }
  }

  return advice
}
