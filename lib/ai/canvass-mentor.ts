export const CANVASS_OBJECTIONS = [
  { value: 'NO_DAMAGE', label: 'I don’t see any damage on my roof', category: 'Damage & condition' },
  { value: 'NEW_ROOF', label: 'My roof is relatively new', category: 'Damage & condition' },
  { value: 'ROOF_LOOKS_FINE', label: 'My roof looks fine from the ground', category: 'Damage & condition' },
  { value: 'NO_LEAK', label: 'There are no leaks', category: 'Damage & condition' },
  { value: 'NO_HAIL_HERE', label: 'I don’t think hail hit this neighborhood', category: 'Damage & condition' },
  { value: 'NO_VISIBLE_DAMAGE', label: 'I can’t see any damage', category: 'Damage & condition' },
  { value: 'METAL_ROOF', label: 'I have a metal roof', category: 'Damage & condition' },
  { value: 'FLAT_ROOF', label: 'I have a flat roof', category: 'Damage & condition' },
  { value: 'REPAIR_ONLY', label: 'I only want a small repair', category: 'Damage & condition' },
  { value: 'WAIT_FOR_DAMAGE', label: 'I’ll wait until there’s a problem', category: 'Damage & condition' },
  { value: 'HAVE_ADJUSTER', label: 'I already have an insurance adjuster coming out', category: 'Insurance & claims' },
  { value: 'ALREADY_FILED', label: 'I’ve already filed a claim', category: 'Insurance & claims' },
  { value: 'CLAIM_DENIED', label: 'My claim was denied', category: 'Insurance & claims' },
  { value: 'INSURER_NO_DAMAGE', label: 'My insurer says there’s no damage', category: 'Insurance & claims' },
  { value: 'INSURANCE_WONT_COVER', label: 'Insurance probably won’t cover it', category: 'Insurance & claims' },
  { value: 'RATES_GO_UP', label: 'Won’t my insurance rates go up if I file a claim?', category: 'Insurance & claims' },
  { value: 'DEDUCTIBLE_HIGH', label: 'My deductible is too high', category: 'Insurance & claims' },
  { value: 'CANT_AFFORD_DEDUCTIBLE', label: 'I can’t afford the deductible right now', category: 'Insurance & claims' },
  { value: 'NO_CLAIM', label: 'I don’t want to file an insurance claim', category: 'Insurance & claims' },
  { value: 'INSURER_CONTRACTOR', label: 'I’ll use the contractor my insurer recommends', category: 'Insurance & claims' },
  { value: 'NO_TIME', label: 'I don’t have time right now', category: 'Timing & interest' },
  { value: 'SEND_EMAIL', label: 'Just send me an email or leave a flyer', category: 'Timing & interest' },
  { value: 'SPOUSE', label: 'I need to talk to my spouse first', category: 'Timing & interest' },
  { value: 'THINK_ABOUT_IT', label: 'I need time to think about it', category: 'Timing & interest' },
  { value: 'CALL_LATER', label: 'Can you come back another time?', category: 'Timing & interest' },
  { value: 'NOT_INTERESTED', label: 'I’m not interested', category: 'Timing & interest' },
  { value: 'DONT_WANT_SALES', label: 'I don’t want a sales pitch', category: 'Timing & interest' },
  { value: 'BUSY_NOW', label: 'I’m busy / in the middle of something', category: 'Timing & interest' },
  { value: 'NOT_HOMEOWNER', label: 'I’m renting; I’m not the owner', category: 'Property & permission' },
  { value: 'LANDLORD_HANDLES', label: 'The landlord handles the roof', category: 'Property & permission' },
  { value: 'HOA_APPROVAL', label: 'I need HOA approval first', category: 'Property & permission' },
  { value: 'NO_PHOTOS', label: 'I don’t want photos taken of my property', category: 'Property & permission' },
  { value: 'NO_ROOF_ACCESS', label: 'I don’t want anyone on my roof', category: 'Property & permission' },
  { value: 'PRIVACY', label: 'I’m concerned about privacy', category: 'Property & permission' },
  { value: 'ALREADY_CONTRACTOR', label: 'I already have a roofing contractor', category: 'Trust & credentials' },
  { value: 'DONT_TRUST_ROOFERS', label: 'I don’t trust roofing companies', category: 'Trust & credentials' },
  { value: 'DOOR_TO_DOOR_SCAM', label: 'Door-to-door roofing sounds like a scam', category: 'Trust & credentials' },
  { value: 'LICENSE_INSURANCE', label: 'Are you licensed and insured?', category: 'Trust & credentials' },
  { value: 'REFERENCES', label: 'Can you provide references?', category: 'Trust & credentials' },
  { value: 'WRITTEN_QUOTE', label: 'I want a written estimate first', category: 'Cost & scope' },
  { value: 'TOO_EXPENSIVE', label: 'Roofing work is too expensive', category: 'Cost & scope' },
  { value: 'NO_UPFRONT_COST', label: 'Is the inspection really free?', category: 'Cost & scope' },
  { value: 'CASH_ONLY', label: 'I only want to pay cash', category: 'Cost & scope' },
  { value: 'SECOND_OPINION', label: 'I want a second opinion', category: 'Cost & scope' },
  { value: 'GUARANTEE_COVERAGE', label: 'Can you guarantee insurance will pay?', category: 'Cost & scope' },
  { value: 'WAIVE_DEDUCTIBLE', label: 'Can you waive my deductible?', category: 'Cost & scope' },
  { value: 'WARRANTY', label: 'What warranty do you provide?', category: 'Cost & scope' },
  { value: 'OTHER_INSPECTION', label: 'Another roofer already inspected it', category: 'Cost & scope' },
  { value: 'COMMERCIAL_PROPERTY', label: 'This is a commercial property', category: 'Property & permission' },
  { value: 'DO_NOT_SOLICIT', label: 'I have a no-soliciting sign / please leave', category: 'Timing & interest' },
] as const

export type ObjectionType = (typeof CANVASS_OBJECTIONS)[number]['value']

export type CanvassAdvice = {
  openerScript: string
  objectionResponse?: string
  collateralChecklist: string[]
  goldenReportRuleNote: string
}

const objectionResponses: Record<ObjectionType, string> = {
  NO_DAMAGE: 'I understand. I cannot determine roof condition from the street. If you are interested, we can explain the scope of an inspection and document only what is actually observed.',
  NEW_ROOF: 'That makes sense. A newer roof can still benefit from periodic checks, but I cannot determine damage without an inspection. We can explain the inspection scope before you decide.',
  ROOF_LOOKS_FINE: 'That is good to hear. Some conditions are not visible from the ground, but there is no need to inspect unless you want to. I can leave our information for you to review.',
  NO_LEAK: 'No leak is a good sign, though not every roof issue causes an immediate leak. We cannot assume there is damage; an inspection is entirely your choice.',
  NO_HAIL_HERE: 'That may be the case. We should rely on reliable local weather information and actual property evidence, not assumptions. I can share the information we have if you want it.',
  NO_VISIBLE_DAMAGE: 'I understand. I cannot confirm damage from the sidewalk. If you choose an inspection, we will document what is actually found and share it with you.',
  METAL_ROOF: 'Thanks for letting me know. Metal roofs have different inspection considerations. We can explain whether our team handles your roof type before scheduling anything.',
  FLAT_ROOF: 'Thanks for letting me know. Flat and low-slope roofs require the right experience. We can confirm our qualifications for that roof type before you decide whether to proceed.',
  REPAIR_ONLY: 'That may be all that is needed. We should inspect and document the condition before recommending repair or replacement; we will explain the findings and options.',
  WAIT_FOR_DAMAGE: 'That is your choice. Waiting can be reasonable, though you may want to keep an eye out for changes. I can leave our contact information in case you want help later.',
  HAVE_ADJUSTER: 'That is fine. You can wait for the adjuster. If you later want an independent inspection, we can document our observations and coordinate respectfully with your process.',
  ALREADY_FILED: 'Understood. You can continue working with your insurer. If you want help documenting roof conditions, we can explain our process without promising a claim outcome.',
  CLAIM_DENIED: 'I’m sorry that happened. We cannot promise an appeal will succeed. If you want, we can review the inspection evidence with your permission and provide a factual written assessment for you to discuss with your insurer.',
  INSURER_NO_DAMAGE: 'Your insurer’s assessment matters. We should not contradict it without evidence. If you request a separate inspection, we can document specific observations and let you decide whether to share them.',
  INSURANCE_WONT_COVER: 'Coverage depends on your policy, the cause of loss, exclusions, and the insurer’s review. We cannot predict or guarantee coverage. Your insurer can explain your policy before you decide.',
  RATES_GO_UP: 'I cannot predict whether a claim will affect your premium. Rates and claim handling vary by insurer, policy, and circumstances. Check with your insurer before deciding whether to file.',
  DEDUCTIBLE_HIGH: 'That is important to consider. We cannot waive or misrepresent your deductible. You can review your policy and budget before deciding whether to pursue any work.',
  CANT_AFFORD_DEDUCTIBLE: 'I understand. Please do not commit to work you cannot afford. We can explain the written scope and payment terms, and you can take time to consider your options.',
  NO_CLAIM: 'That is completely your decision. An inspection does not require you to file a claim. We can explain any inspection cost and document findings only if you want us to.',
  INSURER_CONTRACTOR: 'You can choose the contractor you trust and should review any insurer program terms carefully. We can provide our credentials and a written scope for comparison if helpful.',
  NO_TIME: 'No problem. I can leave our information or, if you prefer, arrange a time that works for you. We will not inspect or photograph your property without permission.',
  SEND_EMAIL: 'Certainly. If you choose to share your contact details, we can send our company information and explain any fees before arranging a visit.',
  SPOUSE: 'Of course. Take the time you need. If you would like, we can arrange a time when everyone involved in the decision can be present.',
  THINK_ABOUT_IT: 'Absolutely. You do not need to decide now. I can leave our contact information and a written explanation so you can review it on your own time.',
  CALL_LATER: 'Certainly. What day or time would you prefer? I will only record a follow-up if you want one.',
  NOT_INTERESTED: 'Understood. Thank you for your time. I will not pressure you or keep you here.',
  DONT_WANT_SALES: 'I understand. I can give you our contact information and leave you in peace. There is no obligation to schedule anything.',
  BUSY_NOW: 'I understand. I will keep this brief and let you get back to what you were doing. Would you prefer a flyer, or should I leave you alone?',
  NOT_HOMEOWNER: 'Thanks for clarifying. We should speak with the property owner or manager only if you are comfortable sharing the appropriate contact route. I will not ask you to authorize work you cannot approve.',
  LANDLORD_HANDLES: 'Understood. The owner or property manager should decide whether to arrange an inspection. I can leave company details for you to pass along if you wish.',
  HOA_APPROVAL: 'That makes sense. Review your HOA requirements first. We can provide product details and a written scope for your review if you request them.',
  NO_PHOTOS: 'Understood. We will not take photos of your property without your permission. If documentation is not welcome, we will stop here.',
  NO_ROOF_ACCESS: 'That is completely fine. We will not access the roof without clear permission and appropriate safety procedures. We can explain other options, or leave it there.',
  PRIVACY: 'That is a fair concern. We can explain what information we collect, why we collect it, and how it is handled before you decide. You do not have to provide information.',
  ALREADY_CONTRACTOR: 'Good—you already have someone to call. If you want a second opinion, we can provide our credentials and a separate written assessment. There is no need to switch contractors.',
  DONT_TRUST_ROOFERS: 'I understand why you would be cautious. You can verify our business details, insurance, references, and written terms independently. Please do not rely on pressure or verbal promises.',
  DOOR_TO_DOOR_SCAM: 'It is sensible to be cautious. Here is our company information so you can verify it independently. You do not need to share personal information or make a decision at the door.',
  LICENSE_INSURANCE: 'Absolutely. We can provide our current business and insurance documentation for you to verify before any work is considered.',
  REFERENCES: 'Yes, we can share available references with appropriate permission. You should contact them independently and review our written terms before deciding.',
  WRITTEN_QUOTE: 'That is reasonable. Any proposal should be written, itemized, and clear about scope, exclusions, payment terms, and warranty. We will not ask you to rely on a verbal quote.',
  TOO_EXPENSIVE: 'Budget matters. We can explain the scope and itemized pricing, and distinguish essential work from optional work where appropriate. You are free to compare quotes and decline.',
  NO_UPFRONT_COST: 'I will explain any inspection or service charge before scheduling. We will not describe an inspection as free unless that is accurate and the terms are clear.',
  CASH_ONLY: 'We can explain the payment methods we actually accept and provide a receipt and written contract. Please choose a method that gives you a clear record of the transaction.',
  SECOND_OPINION: 'That is a good way to make an informed decision. We can provide a separate, evidence-based assessment and written scope for you to compare without pressure.',
  GUARANTEE_COVERAGE: 'No responsible contractor can guarantee an insurer will pay a claim. Coverage decisions belong to the insurer under your policy. We can only document observed conditions and explain our proposed work.',
  WAIVE_DEDUCTIBLE: 'We cannot waive, absorb, or misrepresent an insurance deductible. We will use a transparent written price and follow applicable law and policy requirements.',
  WARRANTY: 'We can provide the actual manufacturer and workmanship warranty terms in writing, including coverage limits, exclusions, duration, and any registration steps before you sign.',
  OTHER_INSPECTION: 'That is useful context. You can compare the written findings and photos. If you request another inspection, we will document our own observations independently and will not promise a particular conclusion.',
  COMMERCIAL_PROPERTY: 'Thanks for clarifying. Commercial roofs may require different access, safety, and documentation procedures. We can confirm our relevant experience and arrange a discussion with the appropriate property representative.',
  DO_NOT_SOLICIT: 'Understood. I will respect your request and leave now. I will not attempt another sales conversation at this property.',
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
    advice.objectionResponse = objectionResponses[input.objection]
  }

  return advice
}
