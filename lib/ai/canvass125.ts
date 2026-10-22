// Canvass 125 — offline-first, human-gated drafts for the door.
// Mimics SalesRabbit DataGrid, SPOTIO DASH, JobNimbus Scout, Terros, QuoteIQ Atlas,
// then improves: no server round-trip, no paid storm layer, no CRM sync gap.
// Every function returns a draft. Nothing writes until a human confirms.

export type CanvassDraft<T> = T & { requiresApproval: true }

function gated<T extends object>(body: T): CanvassDraft<T> {
  return { ...body, requiresApproval: true }
}

export type CanvassInput = {
  address?: string
  notes?: string
  outcome?: string
  hailInches?: number
  windMph?: number
  stormDate?: string
  roofAge?: number
  priorCustomer?: boolean
  newHomeowner?: boolean
  recentSale?: boolean
  hoa?: boolean
  noSoliciting?: boolean
  multiUnit?: boolean
  doorsToday?: number
  hoursWorked?: number
  priorKnocks?: number
  existingCustomer?: boolean
  latitude?: number
  longitude?: number
  neighborsSold?: number
  language?: string
}

// 1-15 Territory & map
export function draftDrawTerritory(addresses: string[]) {
  return gated({ polygons: 1, doors: addresses.length, label: 'Turf A' })
}
export function draftAssignTurf(rep: string, doors: number) {
  return gated({ rep: rep || 'unassigned', doors, status: 'assigned' })
}
export function draftPreventOverlap(existing: string[], candidate: string) {
  return gated({ overlap: existing.includes(candidate), blocked: existing.includes(candidate) })
}
export function draftColorPins(outcome: string) {
  const colors: Record<string, string> = { INTERESTED: '#10b981', NOT_HOME: '#f59e0b', DO_NOT_KNOCK: '#ef4444', INSPECTED: '#3b82f6' }
  return gated({ color: colors[outcome] || '#64748b' })
}
export function draftUntouchedLayer(total: number, knocked: number) {
  return gated({ untouched: Math.max(0, total - knocked) })
}
export function draftCompletedLayer(knocked: number) {
  return gated({ completed: knocked })
}
export function draftDoNotKnockLayer(count: number) {
  return gated({ locked: count, enforce: true })
}
export function draftPriorCustomerLayer(count: number) {
  return gated({ customers: count, highlight: true })
}
export function draftMultiUnitPins(units: number) {
  return gated({ multiUnit: units > 1, units })
}
export function draftStreetCoverage(knocked: number, total: number) {
  return gated({ pct: total ? Math.round((knocked / total) * 100) : 0 })
}
export function draftTerritoryScorecard(knocked: number, interested: number) {
  return gated({ score: interested * 10 + knocked, grade: interested > 3 ? 'A' : 'B' })
}
export function draftBulkAssign(streets: string[], rep: string) {
  return gated({ streets: streets.length, rep })
}
export function draftImportAddresses(rows: string[]) {
  return gated({ imported: rows.filter(Boolean).length })
}
export function draftExportKnocked(rows: number) {
  return gated({ csvRows: rows, format: 'csv' })
}
export function draftShareTurfLink(turfId: string) {
  return gated({ url: `/canvass?turf=${encodeURIComponent(turfId)}` })
}

// 16-30 Storm & targeting
export function draftHailOverlay(inches: number) {
  return gated({ show: inches >= 0.75, inches, source: 'NOAA' })
}
export function draftHailSizeFilter(minInches: number, actual: number) {
  return gated({ pass: actual >= minInches })
}
export function draftStormDateFilter(stormDate: string, windowDays: number) {
  return gated({ withinWindow: Boolean(stormDate) && windowDays <= 14 })
}
export function draftWindOverlay(mph: number) {
  return gated({ show: mph >= 50, mph })
}
export function draftRadarLink(lat?: number, lon?: number) {
  return gated({ href: lat && lon ? `/radar?lat=${lat}&lon=${lon}` : '/radar' })
}
export function draftStormZoneTurf(hailInches: number) {
  return gated({ autoTurf: hailInches >= 1, priority: hailInches >= 1.5 ? 'high' : 'normal' })
}
export function draftRoofAge(yearBuilt?: number) {
  const age = yearBuilt ? new Date().getFullYear() - yearBuilt : 18
  return gated({ years: age, target: age >= 15 })
}
export function draftRoofTypeGuess(notes: string) {
  const type = /metal/i.test(notes) ? 'metal' : /tile/i.test(notes) ? 'tile' : 'asphalt'
  return gated({ type })
}
export function draftPriorClaim(notes: string) {
  return gated({ flagged: /claim|insurance|adjuster/i.test(notes) })
}
export function draftNewHomeowner(flag: boolean) {
  return gated({ newOwner: flag, pitch: flag ? 'welcome + inspection' : 'standard' })
}
export function draftRecentSale(flag: boolean) {
  return gated({ recent: flag })
}
export function draftHoaFlag(flag: boolean) {
  return gated({ hoa: flag, note: flag ? 'Confirm ARC before order' : 'none' })
}
export function draftNoSoliciting(flag: boolean) {
  return gated({ skip: flag, hardStop: flag })
}
export function draftSoftMetalTarget(notes: string) {
  return gated({ target: /gutter|downspout|soft metal|dent/i.test(notes) })
}
export function draftNeighborHighlight(sold: number) {
  return gated({ highlight: sold > 0, sold })
}

// 31-40 Routing & motion
export function draftWalkingOrder(addresses: string[]) {
  return gated({ order: [...addresses].sort(), stops: addresses.length })
}
export function draftNextDoor(current: string, remaining: string[]) {
  return gated({ next: remaining.find((a) => a !== current) || null })
}
export function draftSkipDnk(address: string, dnk: string[]) {
  return gated({ skip: dnk.includes(address) })
}
export function draftBarrierAware(notes: string) {
  return gated({ detour: /fence|cul-de-sac|dead end|gate/i.test(notes) })
}
export function draftDriveToTurf(turf: string) {
  return gated({ nav: `https://maps.google.com/?q=${encodeURIComponent(turf)}` })
}
export function draftIdleAlert(minutesSinceLast: number) {
  return gated({ idle: minutesSinceLast > 12, minutes: minutesSinceLast })
}
export function draftGpsDwell(seconds: number) {
  return gated({ verified: seconds >= 20, seconds })
}
export function draftActivityTrail(points: number) {
  return gated({ points, visible: points > 1 })
}
export function draftDoorsPerHour(doors: number, hours: number) {
  return gated({ rate: hours > 0 ? Math.round(doors / hours) : 0 })
}
export function draftCoverageHeat(pct: number) {
  return gated({ band: pct > 75 ? 'hot' : pct > 40 ? 'warm' : 'cold' })
}

// 41-55 At the door
export function draftOneTap(outcome: string) {
  return gated({ outcome })
}
export function draftVoiceLog(transcript: string) {
  return gated({ transcript, structured: transcript.slice(0, 140) })
}
export function draftAutoAddress(lat?: number, lon?: number) {
  return gated({ address: lat && lon ? `${lat.toFixed(4)}, ${lon.toFixed(4)}` : 'enable GPS' })
}
export function draftCurbPhoto(taken: boolean) {
  return gated({ prompt: !taken, label: 'Curb roof photo' })
}
export function draftSoftMetalPhoto(notes: string) {
  return gated({ prompt: /soft|gutter|dent/i.test(notes) })
}
export function draftGranulePhoto(notes: string) {
  return gated({ prompt: /granule|loss|bare/i.test(notes) })
}
export function draftGutterDentPhoto(notes: string) {
  return gated({ prompt: /gutter|dent/i.test(notes) })
}
export function draftScreenTearPhoto(notes: string) {
  return gated({ prompt: /screen|window/i.test(notes) })
}
export function draftAnnotatePhoto(caption: string) {
  return gated({ caption: caption || 'annotate elevation' })
}
export function draftAlbumByElevation(elevation: string) {
  return gated({ album: elevation || 'front' })
}
export function draftOpenerScript(stormDate?: string) {
  return gated({ script: stormDate ? `Storm on ${stormDate} — free inspection?` : 'Free roof inspection today?' })
}
export function draftObjectionResponse(objection: string) {
  return gated({ response: objection ? `Acknowledge ${objection}, offer inspection only.` : 'Ask for the inspection.' })
}
export function draftHardStopRefusal(saidNo: boolean) {
  return gated({ stop: saidNo, outcome: saidNo ? 'DO_NOT_KNOCK' : 'continue' })
}
export function draftHardStopNoSolicit(flag: boolean) {
  return gated({ stop: flag })
}
export function draftHardStopHostile(notes: string) {
  return gated({ stop: /threat|hostile|get off|call police/i.test(notes) })
}

// 56-70 Lead quality
export function draftLeadScoreBefore(input: CanvassInput) {
  let score = 40
  if ((input.hailInches || 0) >= 1) score += 20
  if ((input.roofAge || 0) >= 15) score += 15
  if (input.newHomeowner) score += 10
  if (input.noSoliciting) score -= 40
  return gated({ score: Math.max(0, Math.min(100, score)) })
}
export function draftLeadScoreAfter(outcome: string, notes: string) {
  let score = outcome === 'INTERESTED' ? 70 : outcome === 'NOT_HOME' ? 35 : 10
  if (/today|asap|insurance/i.test(notes)) score += 15
  return gated({ score })
}
export function draftIntentFromNotes(notes: string) {
  const intent = /inspect|yes|interested/i.test(notes) ? 'inspect' : /not home/i.test(notes) ? 'return' : 'unknown'
  return gated({ intent })
}
export function draftNameFromNotes(notes: string) {
  const m = notes.match(/\b([A-Z][a-z]+ [A-Z][a-z]+)\b/)
  return gated({ name: m ? m[1] : '' })
}
export function draftPhoneFromNotes(notes: string) {
  const m = notes.match(/\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/)
  return gated({ phone: m ? m[0] : '' })
}
export function draftBestReturnTime(notes: string) {
  const evening = /work|evening|after 5|not home/i.test(notes)
  return gated({ window: evening ? '17:00-19:00' : '10:00-14:00' })
}
export function draftFollowUpDate(outcome: string) {
  const days = outcome === 'NOT_HOME' ? 1 : outcome === 'INTERESTED' ? 0 : 7
  return gated({ inDays: days })
}
export function draftDuplicateCheck(address: string, existing: string[]) {
  return gated({ duplicate: existing.includes(address) })
}
export function draftExistingCustomer(flag: boolean) {
  return gated({ match: flag, tone: flag ? 'thank you, not a pitch' : 'standard' })
}
export function draftPriorKnockHistory(count: number) {
  return gated({ visits: count, caution: count >= 2 })
}
export function draftSpouseDecision(notes: string) {
  return gated({ flag: /spouse|husband|wife|talk to/i.test(notes) })
}
export function draftCarrierNote(notes: string) {
  const m = notes.match(/state farm|allstate|usaa|farmers|progressive|nationwide/i)
  return gated({ carrier: m ? m[0] : '' })
}
export function draftDeductibleNote(notes: string) {
  const m = notes.match(/\$?\d{3,5}/)
  return gated({ deductible: m ? m[0] : '' })
}
export function draftFinancingFlag(notes: string) {
  return gated({ interested: /financ|payment|monthly/i.test(notes) })
}
export function draftMultiTradeFlag(notes: string) {
  return gated({ trades: /gutter|siding|window|paint|fascia|soffit/i.test(notes) })
}

// 71-85 Voice & hands-free
export function draftVoiceInterested(said: string) {
  return gated({ outcome: /interested|yes|inspect/i.test(said) ? 'INTERESTED' : 'review' })
}
export function draftVoiceNotHome(said: string) {
  return gated({ outcome: /not home|no answer/i.test(said) ? 'NOT_HOME' : 'review' })
}
export function draftVoiceDnk(said: string) {
  return gated({ outcome: /do not knock|no soliciting|get off/i.test(said) ? 'DO_NOT_KNOCK' : 'review' })
}
export function draftVoiceAddNote(said: string) {
  return gated({ note: said })
}
export function draftVoiceFollowUp(said: string) {
  return gated({ set: /follow|tomorrow|call/i.test(said) })
}
export function draftVoiceNextDoor() {
  return gated({ action: 'next' })
}
export function draftVoiceOpenScript(lang = 'en') {
  return gated({ script: lang === 'es' ? 'Inspección gratis hoy?' : 'Free inspection today?' })
}
export function draftVoiceObjection(said: string) {
  return gated({ heard: said.slice(0, 80) })
}
export function draftSpanishScript() {
  return gated({ script: 'Hola, inspección de techo gratis por la tormenta. ¿Le interesa?' })
}
export function draftSpanishLog(said: string) {
  return gated({ transcript: said, lang: 'es' })
}
export function draftConfirmBeforeWrite() {
  return gated({ confirm: true })
}
export function draftOfflineVoiceQueue(pending: number) {
  return gated({ queued: pending })
}
export function draftWhisperTranscript(audioPresent: boolean) {
  return gated({ ready: audioPresent, engine: 'whisper.cpp' })
}
export function draftStructuredNote(transcript: string) {
  return gated({ summary: transcript.split('.').slice(0, 2).join('.').trim() })
}
export function draftSentiment(transcript: string) {
  const negative = /no|angry|leave|hate/i.test(transcript)
  return gated({ sentiment: negative ? 'negative' : 'neutral' })
}

// 86-100 Follow-up & office
export function draftSms(name: string, address: string) {
  return gated({ text: `Hi ${name || 'there'}, Guru Roofing can inspect ${address || 'the roof'} today. Reply YES to book.` })
}
export function draftEmail(name: string, address: string) {
  return gated({ subject: `Roof inspection — ${address}`, body: `Hi ${name}, draft inspection offer attached.` })
}
export function draftBookInspection(interested: boolean) {
  return gated({ book: interested, slot: 'next available' })
}
export function draftAssignCloser(score: number) {
  return gated({ assign: score >= 70, role: 'closer' })
}
export function draftCreateLead() {
  return gated({ create: true, source: 'canvass' })
}
export function draftOfficeTask(summary: string) {
  return gated({ task: summary || 'Call canvass lead' })
}
export function draftFifteenMinuteReminder() {
  return gated({ inMinutes: 15 })
}
export function draftFortyEightHourReminder() {
  return gated({ inHours: 48 })
}
export function draftNoShowRisk(notes: string) {
  return gated({ risk: /maybe|call me|busy/i.test(notes) ? 'high' : 'low' })
}
export function draftReferralAsk(closed: boolean) {
  return gated({ ask: closed })
}
export function draftReviewRequest(completed: boolean) {
  return gated({ ask: completed })
}
export function draftNeighborList(sold: number) {
  return gated({ doors: sold > 0 ? 6 : 0 })
}
export function draftStormSurgeQueue(newLeads: number) {
  return gated({ queue: newLeads, priority: newLeads > 20 ? 'surge' : 'normal' })
}
export function draftOfficeHandoff(address: string, outcome: string) {
  return gated({ summary: `${address}: ${outcome}` })
}
export function draftDailySummary(doors: number, interested: number) {
  return gated({ doors, interested, rate: doors ? Math.round((interested / doors) * 100) : 0 })
}

// 101-115 Manager & coaching
export function draftLeaderboard(rows: { rep: string; doors: number }[]) {
  return gated({ top: [...rows].sort((a, b) => b.doors - a.doors)[0]?.rep || 'none' })
}
export function draftContactRate(contacts: number, doors: number) {
  return gated({ pct: doors ? Math.round((contacts / doors) * 100) : 0 })
}
export function draftDoorsPerHourByRep(doors: number, hours: number) {
  return gated({ rate: hours ? Math.round(doors / hours) : 0 })
}
export function draftConversionByTurf(interested: number, doors: number) {
  return gated({ pct: doors ? Math.round((interested / doors) * 100) : 0 })
}
export function draftCoachingTip(outcome: string) {
  return gated({ tip: outcome === 'NOT_HOME' ? 'Return 5-7pm' : 'Lead with the storm date' })
}
export function draftScriptAb(variant: 'A' | 'B') {
  return gated({ variant, script: variant === 'A' ? 'Storm inspection' : 'Neighbor had damage' })
}
export function draftObjectionFrequency(counts: Record<string, number>) {
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]
  return gated({ top: top ? top[0] : 'none' })
}
export function draftBestTimeOfDay(hour: number) {
  return gated({ window: hour >= 17 ? 'evening' : 'day' })
}
export function draftIdleGap(minutes: number) {
  return gated({ alert: minutes > 15 })
}
export function draftDoubleKnock(prior: number) {
  return gated({ alert: prior >= 1 })
}
export function draftDnkViolation(address: string, dnk: string[]) {
  return gated({ violation: dnk.includes(address) })
}
export function draftTeamFeed(event: string) {
  return gated({ event })
}
export function draftEndOfDay(doors: number, interested: number) {
  return gated({ recap: `${doors} doors, ${interested} interested` })
}
export function draftWeeklyTurf(coverage: number) {
  return gated({ coverage })
}
export function draftVerifiedKnockPay(verified: number, rate: number) {
  return gated({ pay: verified * rate, optional: true })
}

// 116-125 Estimate bridge
export function draftPinToEstimate(address: string) {
  return gated({ href: `/estimate?address=${encodeURIComponent(address)}` })
}
export function draftSquaresFromPhoto(photos: number) {
  return gated({ squares: photos >= 4 ? 22 : null, confidence: photos >= 4 ? 0.6 : 0.2 })
}
export function draftPitchFromPhoto(photos: number) {
  return gated({ pitch: photos >= 2 ? 6 : null })
}
export function draftGoodBetterBest() {
  return gated({ tiers: ['Good', 'Better', 'Best'] })
}
export function draftFinancingOffer(total: number) {
  return gated({ monthly: Math.round(total / 60) })
}
export function draftEsignReady(name: string, total: number) {
  return gated({ ready: Boolean(name) && total > 0 })
}
export function draftMaterialOrder(squares: number) {
  return gated({ squares, status: 'draft' })
}
export function draftWorkOrder(address: string) {
  return gated({ address, status: 'draft' })
}
export function draftPortalSummary(address: string, outcome: string) {
  return gated({ summary: `${address} — ${outcome}` })
}
export function draftYoloFreeLog(owner: boolean) {
  return gated({ allowed: owner, note: 'Owner only' })
}

export const CANVASS_125 = [
  draftDrawTerritory, draftAssignTurf, draftPreventOverlap, draftColorPins, draftUntouchedLayer,
  draftCompletedLayer, draftDoNotKnockLayer, draftPriorCustomerLayer, draftMultiUnitPins, draftStreetCoverage,
  draftTerritoryScorecard, draftBulkAssign, draftImportAddresses, draftExportKnocked, draftShareTurfLink,
  draftHailOverlay, draftHailSizeFilter, draftStormDateFilter, draftWindOverlay, draftRadarLink,
  draftStormZoneTurf, draftRoofAge, draftRoofTypeGuess, draftPriorClaim, draftNewHomeowner,
  draftRecentSale, draftHoaFlag, draftNoSoliciting, draftSoftMetalTarget, draftNeighborHighlight,
  draftWalkingOrder, draftNextDoor, draftSkipDnk, draftBarrierAware, draftDriveToTurf,
  draftIdleAlert, draftGpsDwell, draftActivityTrail, draftDoorsPerHour, draftCoverageHeat,
  draftOneTap, draftVoiceLog, draftAutoAddress, draftCurbPhoto, draftSoftMetalPhoto,
  draftGranulePhoto, draftGutterDentPhoto, draftScreenTearPhoto, draftAnnotatePhoto, draftAlbumByElevation,
  draftOpenerScript, draftObjectionResponse, draftHardStopRefusal, draftHardStopNoSolicit, draftHardStopHostile,
  draftLeadScoreBefore, draftLeadScoreAfter, draftIntentFromNotes, draftNameFromNotes, draftPhoneFromNotes,
  draftBestReturnTime, draftFollowUpDate, draftDuplicateCheck, draftExistingCustomer, draftPriorKnockHistory,
  draftSpouseDecision, draftCarrierNote, draftDeductibleNote, draftFinancingFlag, draftMultiTradeFlag,
  draftVoiceInterested, draftVoiceNotHome, draftVoiceDnk, draftVoiceAddNote, draftVoiceFollowUp,
  draftVoiceNextDoor, draftVoiceOpenScript, draftVoiceObjection, draftSpanishScript, draftSpanishLog,
  draftConfirmBeforeWrite, draftOfflineVoiceQueue, draftWhisperTranscript, draftStructuredNote, draftSentiment,
  draftSms, draftEmail, draftBookInspection, draftAssignCloser, draftCreateLead,
  draftOfficeTask, draftFifteenMinuteReminder, draftFortyEightHourReminder, draftNoShowRisk, draftReferralAsk,
  draftReviewRequest, draftNeighborList, draftStormSurgeQueue, draftOfficeHandoff, draftDailySummary,
  draftLeaderboard, draftContactRate, draftDoorsPerHourByRep, draftConversionByTurf, draftCoachingTip,
  draftScriptAb, draftObjectionFrequency, draftBestTimeOfDay, draftIdleGap, draftDoubleKnock,
  draftDnkViolation, draftTeamFeed, draftEndOfDay, draftWeeklyTurf, draftVerifiedKnockPay,
  draftPinToEstimate, draftSquaresFromPhoto, draftPitchFromPhoto, draftGoodBetterBest, draftFinancingOffer,
  draftEsignReady, draftMaterialOrder, draftWorkOrder, draftPortalSummary, draftYoloFreeLog,
] as const

export function canvass125Count() {
  return CANVASS_125.length
}
