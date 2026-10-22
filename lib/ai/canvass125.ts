// Canvass 125 — detailed, human-gated drafts.
// Offline-first. No write until a human confirms.
// Each draft carries a reason, a next action, and the evidence it used.

export type CanvassDraft<T> = T & {
  requiresApproval: true
  id: string
  reason: string
  next: string
}

function gated<T extends object>(id: string, reason: string, next: string, body: T): CanvassDraft<T> {
  return { id, reason, next, ...body, requiresApproval: true }
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
  yearBuilt?: number
  photos?: number
}

function streetKey(address: string) {
  return address.replace(/^\d+\s*/, '').trim().toLowerCase()
}

// 1-15 Territory & map
export function draftDrawTerritory(addresses: string[]) {
  const streets = [...new Set(addresses.map(streetKey).filter(Boolean))]
  return gated('draw-territory', `${addresses.length} doors across ${streets.length} streets`, 'Assign a rep before anyone walks', {
    polygons: Math.max(1, Math.ceil(addresses.length / 40)),
    doors: addresses.length,
    streets,
    label: streets[0] ? `Turf ${streets[0]}` : 'Turf A',
  })
}
export function draftAssignTurf(rep: string, doors: number) {
  return gated('assign-turf', `${doors} doors need an owner`, 'Confirm the rep and the day', {
    rep: rep || 'unassigned',
    doors,
    load: doors > 60 ? 'heavy' : doors > 30 ? 'full' : 'light',
    status: rep ? 'assigned' : 'needs-rep',
  })
}
export function draftPreventOverlap(existing: string[], candidate: string) {
  const hit = existing.find((a) => a.toLowerCase() === candidate.toLowerCase())
  return gated('prevent-overlap', hit ? `${candidate} is already in a turf` : 'No overlap', hit ? 'Skip this door' : 'Safe to add', {
    overlap: Boolean(hit),
    blocked: Boolean(hit),
    matched: hit || null,
  })
}
export function draftColorPins(outcome: string) {
  const map: Record<string, { color: string; label: string }> = {
    INTERESTED: { color: '#10b981', label: 'Interested — book or inspect' },
    NOT_HOME: { color: '#f59e0b', label: 'Not home — return window' },
    DO_NOT_KNOCK: { color: '#ef4444', label: 'Do not knock — locked' },
    INSPECTED: { color: '#3b82f6', label: 'Inspected — in pipeline' },
  }
  const pin = map[outcome] || { color: '#64748b', label: 'Untouched' }
  return gated('color-pins', pin.label, 'Use the color on the map pin', pin)
}
export function draftUntouchedLayer(total: number, knocked: number) {
  const untouched = Math.max(0, total - knocked)
  return gated('untouched-layer', `${untouched} doors still open`, 'Keep the untouched layer on', { untouched, total, knocked })
}
export function draftCompletedLayer(knocked: number) {
  return gated('completed-layer', `${knocked} doors already worked`, 'Hide these from the walk list', { completed: knocked })
}
export function draftDoNotKnockLayer(count: number) {
  return gated('dnk-layer', `${count} locked doors`, 'Never route through a DNK', { locked: count, enforce: true })
}
export function draftPriorCustomerLayer(count: number) {
  return gated('prior-customer', `${count} prior customers in range`, 'Thank them, do not pitch', { customers: count, highlight: count > 0 })
}
export function draftMultiUnitPins(units: number) {
  return gated('multi-unit', units > 1 ? `${units} units at one pin` : 'Single family', 'Log each unit separately', {
    multiUnit: units > 1,
    units,
    note: units > 1 ? 'Ask for the manager or the unit list' : 'Standard door',
  })
}
export function draftStreetCoverage(knocked: number, total: number) {
  const pct = total ? Math.round((knocked / total) * 100) : 0
  return gated('street-coverage', `${pct}% of the street is worked`, pct < 80 ? 'Finish the street before moving' : 'Street is covered', { pct, knocked, total })
}
export function draftTerritoryScorecard(knocked: number, interested: number) {
  const score = interested * 10 + knocked
  return gated('territory-score', `${interested} interested from ${knocked} doors`, 'Compare turfs before reassigning', {
    score,
    grade: interested >= 5 ? 'A' : interested >= 2 ? 'B' : 'C',
    interested,
    knocked,
  })
}
export function draftBulkAssign(streets: string[], rep: string) {
  return gated('bulk-assign', `${streets.length} streets to ${rep || 'unassigned'}`, 'Confirm before the day starts', { streets, rep, count: streets.length })
}
export function draftImportAddresses(rows: string[]) {
  const clean = rows.map((r) => r.trim()).filter(Boolean)
  return gated('import-addresses', `${clean.length} addresses ready`, 'Dedupe before assigning', { imported: clean.length, sample: clean.slice(0, 3) })
}
export function draftExportKnocked(rows: number) {
  return gated('export-knocked', `${rows} knocks ready to export`, 'Download after the day, not during', { csvRows: rows, format: 'csv', columns: ['address', 'outcome', 'notes', 'score'] })
}
export function draftShareTurfLink(turfId: string) {
  return gated('share-turf', `Link for ${turfId}`, 'Send only to the assigned rep', { url: `/canvass?turf=${encodeURIComponent(turfId)}` })
}

// 16-30 Storm & targeting
export function draftHailOverlay(inches: number) {
  return gated('hail-overlay', inches >= 0.75 ? `${inches}" hail — show the layer` : 'Below hail threshold', 'Knock hail streets first', {
    show: inches >= 0.75,
    inches,
    source: 'NOAA',
    band: inches >= 1.5 ? 'severe' : inches >= 0.75 ? 'damaging' : 'none',
  })
}
export function draftHailSizeFilter(minInches: number, actual: number) {
  return gated('hail-filter', actual >= minInches ? `${actual}" meets the ${minInches}" floor` : 'Below filter', 'Keep or drop the street', { pass: actual >= minInches, minInches, actual })
}
export function draftStormDateFilter(stormDate: string, windowDays: number) {
  const fresh = Boolean(stormDate) && windowDays <= 14
  return gated('storm-date', fresh ? `Storm ${stormDate} is inside ${windowDays} days` : 'Storm is stale', fresh ? 'Lead with the date' : 'Use a general opener', { withinWindow: fresh, stormDate, windowDays })
}
export function draftWindOverlay(mph: number) {
  return gated('wind-overlay', mph >= 50 ? `${mph} mph wind` : 'Wind below threshold', 'Mention lifted shingles if wind was high', { show: mph >= 50, mph })
}
export function draftRadarLink(lat?: number, lon?: number) {
  return gated('radar-link', 'Open the radar cinema for this pin', 'Show the homeowner the loop', {
    href: lat && lon ? `/radar?lat=${lat}&lon=${lon}` : '/radar',
  })
}
export function draftStormZoneTurf(hailInches: number) {
  return gated('storm-turf', hailInches >= 1 ? 'Auto-turf this storm zone' : 'Not a storm priority', 'Assign storm streets first', {
    autoTurf: hailInches >= 1,
    priority: hailInches >= 1.5 ? 'high' : hailInches >= 1 ? 'normal' : 'low',
    hailInches,
  })
}
export function draftRoofAge(yearBuilt?: number) {
  const age = yearBuilt ? new Date().getFullYear() - yearBuilt : 18
  return gated('roof-age', age >= 15 ? `${age} years — target` : `${age} years — newer`, age >= 15 ? 'Offer the inspection' : 'Only knock if storm hit', { years: age, target: age >= 15, yearBuilt: yearBuilt || null })
}
export function draftRoofTypeGuess(notes: string) {
  const type = /metal/i.test(notes) ? 'metal' : /tile|concrete/i.test(notes) ? 'tile' : /tpo|epdm|flat/i.test(notes) ? 'flat' : 'asphalt'
  return gated('roof-type', `Guessed ${type} from notes`, 'Confirm on the curb photo', { type, evidence: notes.slice(0, 80) })
}
export function draftPriorClaim(notes: string) {
  const flagged = /claim|insurance|adjuster|deductible/i.test(notes)
  return gated('prior-claim', flagged ? 'Prior claim language in the notes' : 'No claim signal', flagged ? 'Ask who the carrier is' : 'Standard opener', { flagged })
}
export function draftNewHomeowner(flag: boolean) {
  return gated('new-homeowner', flag ? 'New owner — welcome pitch' : 'Not a new owner', flag ? 'Lead with the free inspection' : 'Standard', {
    newOwner: flag,
    pitch: flag ? 'Welcome to the neighborhood. Free storm inspection today?' : 'Free storm inspection today?',
  })
}
export function draftRecentSale(flag: boolean) {
  return gated('recent-sale', flag ? 'Recent sale on this address' : 'No recent sale', flag ? 'Treat as new owner' : 'Standard', { recent: flag })
}
export function draftHoaFlag(flag: boolean) {
  return gated('hoa', flag ? 'HOA — ARC before any order' : 'No HOA flag', flag ? 'Note the HOA on the estimate' : 'None', { hoa: flag, note: flag ? 'Confirm ARC before order' : 'none' })
}
export function draftNoSoliciting(flag: boolean) {
  return gated('no-soliciting', flag ? 'No-soliciting — hard stop' : 'No sign noted', flag ? 'Leave. Do not knock.' : 'Proceed', { skip: flag, hardStop: flag })
}
export function draftSoftMetalTarget(notes: string) {
  const target = /gutter|downspout|soft metal|dent|fascia/i.test(notes)
  return gated('soft-metal', target ? 'Soft-metal evidence mentioned' : 'No soft-metal signal', target ? 'Photograph gutters and downspouts' : 'Skip', { target })
}
export function draftNeighborHighlight(sold: number) {
  return gated('neighbor-sold', sold > 0 ? `${sold} neighbors already sold` : 'No neighbor sales', sold > 0 ? 'Use the neighbor opener' : 'Standard opener', { highlight: sold > 0, sold })
}

// 31-40 Routing & motion
export function draftWalkingOrder(addresses: string[]) {
  const order = [...addresses].sort((a, b) => streetKey(a).localeCompare(streetKey(b)) || a.localeCompare(b))
  return gated('walking-order', `${order.length} stops, street-sorted`, 'Walk this order. Skip DNK.', { order, stops: order.length })
}
export function draftNextDoor(current: string, remaining: string[]) {
  const next = remaining.find((a) => a && a !== current) || null
  return gated('next-door', next ? `Next is ${next}` : 'No next door queued', next ? 'Walk there' : 'Pick a new street', { next, remaining: remaining.length })
}
export function draftSkipDnk(address: string, dnk: string[]) {
  const skip = dnk.some((d) => d.toLowerCase() === address.toLowerCase())
  return gated('skip-dnk', skip ? `${address} is do-not-knock` : 'Clear', skip ? 'Skip and log nothing new' : 'Knock', { skip })
}
export function draftBarrierAware(notes: string) {
  const detour = /fence|cul-de-sac|dead end|gate|no outlet/i.test(notes)
  return gated('barrier', detour ? 'Barrier in the notes' : 'Clear path', detour ? 'Route around' : 'Stay on the street order', { detour })
}
export function draftDriveToTurf(turf: string) {
  return gated('drive-to-turf', `Nav to ${turf}`, 'Open maps, then start the walk', { nav: `https://maps.google.com/?q=${encodeURIComponent(turf)}` })
}
export function draftIdleAlert(minutesSinceLast: number) {
  return gated('idle-alert', minutesSinceLast > 12 ? `${minutesSinceLast} min since last knock` : 'Active', minutesSinceLast > 12 ? 'Nudge the rep' : 'None', { idle: minutesSinceLast > 12, minutes: minutesSinceLast })
}
export function draftGpsDwell(seconds: number) {
  return gated('gps-dwell', seconds >= 20 ? `${seconds}s on the pin — verified` : 'Too short to verify', seconds >= 20 ? 'Count the knock' : 'Stay on the door', { verified: seconds >= 20, seconds })
}
export function draftActivityTrail(points: number) {
  return gated('activity-trail', `${points} GPS points today`, 'Show the trail to the manager', { points, visible: points > 1 })
}
export function draftDoorsPerHour(doors: number, hours: number) {
  const rate = hours > 0 ? Math.round(doors / hours) : 0
  return gated('doors-per-hour', `${rate} doors/hour`, rate < 8 ? 'Tighten the route' : 'On pace', { rate, doors, hours })
}
export function draftCoverageHeat(pct: number) {
  const band = pct > 75 ? 'hot' : pct > 40 ? 'warm' : 'cold'
  return gated('coverage-heat', `${pct}% — ${band}`, band === 'cold' ? 'Stay on this turf' : 'Can expand', { band, pct })
}

// 41-55 At the door
export function draftOneTap(outcome: string) {
  return gated('one-tap', `Outcome ${outcome}`, 'Confirm, then save', { outcome })
}
export function draftVoiceLog(transcript: string) {
  return gated('voice-log', 'Transcript ready', 'Confirm before it becomes a note', { transcript, structured: transcript.slice(0, 180) })
}
export function draftAutoAddress(lat?: number, lon?: number) {
  return gated('auto-address', lat && lon ? 'GPS fix available' : 'No GPS', lat && lon ? 'Confirm the address' : 'Type it', {
    address: lat && lon ? `${lat.toFixed(5)}, ${lon.toFixed(5)}` : 'enable GPS',
  })
}
export function draftCurbPhoto(taken: boolean) {
  return gated('curb-photo', taken ? 'Curb photo already taken' : 'Need a curb photo', taken ? 'None' : 'Shoot the front elevation', { prompt: !taken, label: 'Curb roof photo' })
}
export function draftSoftMetalPhoto(notes: string) {
  const prompt = /soft|gutter|dent|downspout/i.test(notes)
  return gated('soft-metal-photo', prompt ? 'Notes mention soft metal' : 'No soft-metal cue', prompt ? 'Photograph gutters' : 'Skip', { prompt })
}
export function draftGranulePhoto(notes: string) {
  const prompt = /granule|loss|bare|exposed/i.test(notes)
  return gated('granule-photo', prompt ? 'Granule loss mentioned' : 'No granule cue', prompt ? 'Photograph the bare spots' : 'Skip', { prompt })
}
export function draftGutterDentPhoto(notes: string) {
  const prompt = /gutter|dent/i.test(notes)
  return gated('gutter-photo', prompt ? 'Gutter dents mentioned' : 'No gutter cue', prompt ? 'Photograph the dents' : 'Skip', { prompt })
}
export function draftScreenTearPhoto(notes: string) {
  const prompt = /screen|window/i.test(notes)
  return gated('screen-photo', prompt ? 'Screen or window damage mentioned' : 'No screen cue', prompt ? 'Photograph the tear' : 'Skip', { prompt })
}
export function draftAnnotatePhoto(caption: string) {
  return gated('annotate-photo', caption ? 'Caption ready' : 'Need a caption', 'Mark the elevation', { caption: caption || 'front elevation' })
}
export function draftAlbumByElevation(elevation: string) {
  return gated('album-elevation', `Album: ${elevation || 'front'}`, 'Keep elevations separate', { album: elevation || 'front' })
}
export function draftOpenerScript(stormDate?: string) {
  const script = stormDate
    ? `Hi, I'm with Guru Roofing. The ${stormDate} storm put hail on this street. Free inspection today?`
    : "Hi, I'm with Guru Roofing. Free roof inspection today — looking for storm damage."
  return gated('opener', 'Opener ready', 'Say it, then listen', { script })
}
export function draftObjectionResponse(objection: string) {
  return gated('objection', objection ? `Heard: ${objection}` : 'No objection yet', 'Acknowledge. Offer the inspection only. Never override a refusal.', {
    response: objection ? `I hear you on ${objection}. The inspection is free and there is no obligation. Want me to look?` : 'Ask for the inspection.',
  })
}
export function draftHardStopRefusal(saidNo: boolean) {
  return gated('hard-stop-refusal', saidNo ? 'Homeowner refused' : 'No refusal', saidNo ? 'Stop. Apologize. Leave.' : 'Continue', {
    stop: saidNo,
    outcome: saidNo ? 'DO_NOT_KNOCK' : 'continue',
  })
}
export function draftHardStopNoSolicit(flag: boolean) {
  return gated('hard-stop-sign', flag ? 'No-soliciting sign' : 'No sign', flag ? 'Do not knock' : 'Proceed', { stop: flag })
}
export function draftHardStopHostile(notes: string) {
  const stop = /threat|hostile|get off|call police|leave now/i.test(notes)
  return gated('hard-stop-hostile', stop ? 'Hostile language' : 'Calm', stop ? 'Leave immediately' : 'None', { stop })
}

// 56-70 Lead quality
export function draftLeadScoreBefore(input: CanvassInput) {
  const reasons: string[] = []
  let score = 35
  if ((input.hailInches || 0) >= 1.5) { score += 25; reasons.push('severe hail') }
  else if ((input.hailInches || 0) >= 0.75) { score += 15; reasons.push('damaging hail') }
  if ((input.roofAge || 0) >= 20) { score += 15; reasons.push('roof 20+') }
  else if ((input.roofAge || 0) >= 15) { score += 10; reasons.push('roof 15+') }
  if (input.newHomeowner) { score += 10; reasons.push('new owner') }
  if ((input.neighborsSold || 0) > 0) { score += 10; reasons.push('neighbor sold') }
  if (input.noSoliciting) { score -= 50; reasons.push('no soliciting') }
  if (input.existingCustomer) { score -= 10; reasons.push('already a customer') }
  score = Math.max(0, Math.min(100, score))
  return gated('score-before', reasons.join(', ') || 'base score', score >= 70 ? 'Knock this door first' : 'Standard order', { score, reasons })
}
export function draftLeadScoreAfter(outcome: string, notes: string) {
  let score = outcome === 'INTERESTED' ? 65 : outcome === 'INSPECTED' ? 80 : outcome === 'NOT_HOME' ? 30 : 5
  const reasons = [outcome]
  if (/today|asap|this week/i.test(notes)) { score += 15; reasons.push('wants it soon') }
  if (/insurance|adjuster|claim/i.test(notes)) { score += 10; reasons.push('claim path') }
  if (/spouse|husband|wife|talk to/i.test(notes)) { score -= 5; reasons.push('needs spouse') }
  return gated('score-after', reasons.join(', '), score >= 70 ? 'Book the inspection now' : 'Set a follow-up', { score: Math.max(0, Math.min(100, score)), reasons })
}
export function draftIntentFromNotes(notes: string) {
  const intent = /inspect|yes|interested|come look/i.test(notes) ? 'inspect' : /not home|no answer/i.test(notes) ? 'return' : /no|not interested/i.test(notes) ? 'closed' : 'unknown'
  return gated('intent', `Intent: ${intent}`, intent === 'inspect' ? 'Book it' : intent === 'return' ? 'Set a return' : 'Log and move', { intent })
}
export function draftNameFromNotes(notes: string) {
  const m = notes.match(/\b([A-Z][a-z]+ [A-Z][a-z]+)\b/)
  return gated('name-from-notes', m ? `Found ${m[1]}` : 'No name in notes', m ? 'Fill the name field' : 'Ask', { name: m ? m[1] : '' })
}
export function draftPhoneFromNotes(notes: string) {
  const m = notes.match(/\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/)
  return gated('phone-from-notes', m ? `Found ${m[0]}` : 'No phone in notes', m ? 'Fill the phone field' : 'Ask', { phone: m ? m[0] : '' })
}
export function draftBestReturnTime(notes: string) {
  const evening = /work|evening|after 5|not home|night/i.test(notes)
  return gated('return-window', evening ? 'Works days — evening return' : 'Daytime is fine', 'Set the reminder', { window: evening ? '17:00-19:00' : '10:00-14:00' })
}
export function draftFollowUpDate(outcome: string) {
  const days = outcome === 'NOT_HOME' ? 1 : outcome === 'INTERESTED' ? 0 : 7
  return gated('follow-up', outcome === 'INTERESTED' ? 'Same day' : `In ${days} days`, 'Put it on the calendar', { inDays: days, outcome })
}
export function draftDuplicateCheck(address: string, existing: string[]) {
  const duplicate = existing.some((a) => a.toLowerCase() === address.toLowerCase())
  return gated('duplicate', duplicate ? 'Already knocked' : 'New door', duplicate ? 'Open the existing lead' : 'Log it', { duplicate })
}
export function draftExistingCustomer(flag: boolean) {
  return gated('existing-customer', flag ? 'Already a customer' : 'New', flag ? 'Thank them. Do not pitch.' : 'Standard', { match: flag, tone: flag ? 'thank you, not a pitch' : 'standard' })
}
export function draftPriorKnockHistory(count: number) {
  return gated('prior-knocks', `${count} prior visits`, count >= 2 ? 'Do not knock again without a reason' : 'OK', { visits: count, caution: count >= 2 })
}
export function draftSpouseDecision(notes: string) {
  const flag = /spouse|husband|wife|talk to|partner/i.test(notes)
  return gated('spouse', flag ? 'Needs the other decision-maker' : 'Single decision', flag ? 'Book a time both are home' : 'Proceed', { flag })
}
export function draftCarrierNote(notes: string) {
  const m = notes.match(/state farm|allstate|usaa|farmers|progressive|nationwide|travelers|liberty mutual/i)
  return gated('carrier', m ? `Carrier: ${m[0]}` : 'No carrier named', m ? 'Put it on the lead' : 'Ask if they have a claim', { carrier: m ? m[0] : '' })
}
export function draftDeductibleNote(notes: string) {
  const m = notes.match(/\$?\d{3,5}\s*(deductible)?/i)
  return gated('deductible', m ? `Possible deductible ${m[0]}` : 'No deductible noted', m ? 'Confirm the number' : 'Ask', { deductible: m ? m[0] : '' })
}
export function draftFinancingFlag(notes: string) {
  const interested = /financ|payment|monthly|afford/i.test(notes)
  return gated('financing', interested ? 'Asked about payments' : 'No financing cue', interested ? 'Offer the monthly draft' : 'Skip', { interested })
}
export function draftMultiTradeFlag(notes: string) {
  const trades = ['gutter', 'siding', 'window', 'paint', 'fascia', 'soffit'].filter((t) => new RegExp(t, 'i').test(notes))
  return gated('multi-trade', trades.length ? `Also: ${trades.join(', ')}` : 'Roof only', trades.length ? 'Open the multi-trade estimate' : 'Roof estimate', { trades, yes: trades.length > 0 })
}

// 71-85 Voice
export function draftVoiceInterested(said: string) {
  const hit = /interested|yes|inspect|come look/i.test(said)
  return gated('voice-interested', hit ? 'Heard interest' : 'Not clearly interested', hit ? 'Set INTERESTED' : 'Review', { outcome: hit ? 'INTERESTED' : 'review' })
}
export function draftVoiceNotHome(said: string) {
  const hit = /not home|no answer|nobody/i.test(said)
  return gated('voice-not-home', hit ? 'Heard not home' : 'Unclear', hit ? 'Set NOT_HOME' : 'Review', { outcome: hit ? 'NOT_HOME' : 'review' })
}
export function draftVoiceDnk(said: string) {
  const hit = /do not knock|no soliciting|get off|leave/i.test(said)
  return gated('voice-dnk', hit ? 'Heard a refusal' : 'No refusal', hit ? 'Hard stop' : 'Continue', { outcome: hit ? 'DO_NOT_KNOCK' : 'review' })
}
export function draftVoiceAddNote(said: string) {
  return gated('voice-note', 'Note from voice', 'Confirm, then append', { note: said })
}
export function draftVoiceFollowUp(said: string) {
  return gated('voice-follow-up', /follow|tomorrow|call|later/i.test(said) ? 'Follow-up requested' : 'No follow-up', 'Set the date', { set: /follow|tomorrow|call|later/i.test(said) })
}
export function draftVoiceNextDoor() {
  return gated('voice-next', 'Move to the next door', 'Advance the walk list', { action: 'next' })
}
export function draftVoiceOpenScript(lang = 'en') {
  return gated('voice-opener', `Opener in ${lang}`, 'Read it', { script: lang === 'es' ? 'Inspección de techo gratis hoy?' : 'Free inspection today?' })
}
export function draftVoiceObjection(said: string) {
  return gated('voice-objection', 'Objection captured', 'Use the matching response', { heard: said.slice(0, 120) })
}
export function draftSpanishScript() {
  return gated('spanish-script', 'Spanish opener', 'Use if the homeowner prefers Spanish', { script: 'Hola, soy de Guru Roofing. Inspección de techo gratis por la tormenta. ¿Le interesa?' })
}
export function draftSpanishLog(said: string) {
  return gated('spanish-log', 'Spanish transcript', 'Confirm before saving', { transcript: said, lang: 'es' })
}
export function draftConfirmBeforeWrite() {
  return gated('confirm-write', 'Nothing writes until you confirm', 'Tap save', { confirm: true })
}
export function draftOfflineVoiceQueue(pending: number) {
  return gated('voice-queue', `${pending} voice notes waiting`, 'They sync when signal returns', { queued: pending })
}
export function draftWhisperTranscript(audioPresent: boolean) {
  return gated('whisper', audioPresent ? 'Audio ready for local whisper' : 'No audio', 'Transcribe on device', { ready: audioPresent, engine: 'whisper.cpp' })
}
export function draftStructuredNote(transcript: string) {
  const summary = transcript.split(/[.!?]/).map((s) => s.trim()).filter(Boolean).slice(0, 2).join('. ')
  return gated('structured-note', 'Two-sentence summary', 'Use this as the lead note', { summary })
}
export function draftSentiment(transcript: string) {
  const negative = /no|angry|leave|hate|stop|get out/i.test(transcript)
  return gated('sentiment', negative ? 'Negative' : 'Neutral', negative ? 'Consider hard stop' : 'Continue', { sentiment: negative ? 'negative' : 'neutral' })
}

// 86-100 Follow-up
export function draftSms(name: string, address: string) {
  const text = `Hi ${name || 'there'}, this is Guru Roofing. We can inspect ${address || 'the roof'} today at no cost. Reply YES and we will book it.`
  return gated('sms', 'SMS draft ready', 'Send only after you confirm', { text })
}
export function draftEmail(name: string, address: string) {
  return gated('email', 'Email draft ready', 'Send from the office, not the door', {
    subject: `Free roof inspection — ${address || 'your home'}`,
    body: `Hi ${name || 'there'},\n\nGuru Roofing can inspect ${address || 'the roof'} after the recent storm. No cost, no obligation.\n\nReply with a time that works.\n`,
  })
}
export function draftBookInspection(interested: boolean) {
  return gated('book-inspection', interested ? 'Ready to book' : 'Not interested yet', interested ? 'Pick a slot' : 'Set a follow-up instead', { book: interested, slot: 'next available' })
}
export function draftAssignCloser(score: number) {
  return gated('assign-closer', score >= 70 ? `Score ${score} — closer` : `Score ${score} — stays with canvass`, score >= 70 ? 'Hand to a closer' : 'Keep working it', { assign: score >= 70, role: score >= 70 ? 'closer' : 'canvass' })
}
export function draftCreateLead() {
  return gated('create-lead', 'Lead draft from this knock', 'Save creates the CRM lead', { create: true, source: 'canvass' })
}
export function draftOfficeTask(summary: string) {
  return gated('office-task', 'Office task draft', 'Office calls within 15 minutes', { task: summary || 'Call canvass lead to confirm inspection' })
}
export function draftFifteenMinuteReminder() {
  return gated('15-min', 'Office should call in 15 minutes', 'Queue the reminder', { inMinutes: 15 })
}
export function draftFortyEightHourReminder() {
  return gated('48-hr', 'Estimate follow-up in 48 hours', 'Queue it', { inHours: 48 })
}
export function draftNoShowRisk(notes: string) {
  const risk = /maybe|call me|busy|not sure/i.test(notes) ? 'high' : 'low'
  return gated('no-show', risk === 'high' ? 'Soft yes — no-show risk' : 'Firm', risk === 'high' ? 'Confirm the morning of' : 'Standard', { risk })
}
export function draftReferralAsk(closed: boolean) {
  return gated('referral', closed ? 'Ask for a neighbor' : 'Too early', closed ? 'Ask after the thank-you' : 'Wait', { ask: closed })
}
export function draftReviewRequest(completed: boolean) {
  return gated('review', completed ? 'Ask for the review' : 'Job not done', completed ? 'Send the review link' : 'Wait', { ask: completed })
}
export function draftNeighborList(sold: number) {
  return gated('neighbor-list', sold > 0 ? `Knock the 6 around the sale` : 'No sale to anchor', sold > 0 ? 'Build the list' : 'Skip', { doors: sold > 0 ? 6 : 0 })
}
export function draftStormSurgeQueue(newLeads: number) {
  return gated('storm-surge', newLeads > 20 ? `${newLeads} new — surge` : `${newLeads} new`, newLeads > 20 ? 'Office calls in order of score' : 'Normal queue', { queue: newLeads, priority: newLeads > 20 ? 'surge' : 'normal' })
}
export function draftOfficeHandoff(address: string, outcome: string) {
  return gated('handoff', `${address}: ${outcome}`, 'Office gets this summary', { summary: `${address}: ${outcome}` })
}
export function draftDailySummary(doors: number, interested: number) {
  const rate = doors ? Math.round((interested / doors) * 100) : 0
  return gated('daily-summary', `${doors} doors, ${interested} interested, ${rate}%`, 'Send at end of day', { doors, interested, rate })
}

// 101-115 Manager
export function draftLeaderboard(rows: { rep: string; doors: number }[]) {
  const top = [...rows].sort((a, b) => b.doors - a.doors)[0]
  return gated('leaderboard', top ? `${top.rep} leads with ${top.doors}` : 'No reps yet', 'Post it at lunch', { top: top?.rep || 'none', rows })
}
export function draftContactRate(contacts: number, doors: number) {
  const pct = doors ? Math.round((contacts / doors) * 100) : 0
  return gated('contact-rate', `${pct}% contact`, pct < 25 ? 'Coach the opener' : 'Healthy', { pct, contacts, doors })
}
export function draftDoorsPerHourByRep(doors: number, hours: number) {
  const rate = hours ? Math.round(doors / hours) : 0
  return gated('dph-rep', `${rate}/hour`, rate < 8 ? 'Check the route' : 'Fine', { rate })
}
export function draftConversionByTurf(interested: number, doors: number) {
  const pct = doors ? Math.round((interested / doors) * 100) : 0
  return gated('turf-conversion', `${pct}% interested`, pct < 5 ? 'Move the turf' : 'Keep it', { pct })
}
export function draftCoachingTip(outcome: string) {
  const tip = outcome === 'NOT_HOME' ? 'Return 5-7pm. Leave no flyer if the sign says no.' : outcome === 'DO_NOT_KNOCK' ? 'Respect it. Do not return.' : 'Lead with the storm date, then the free inspection.'
  return gated('coaching', tip, 'Say it once', { tip })
}
export function draftScriptAb(variant: 'A' | 'B') {
  return gated('script-ab', `Variant ${variant}`, 'Track which one books', {
    variant,
    script: variant === 'A' ? 'Storm on this street — free inspection?' : 'Your neighbor had damage — free inspection?',
  })
}
export function draftObjectionFrequency(counts: Record<string, number>) {
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]
  return gated('objection-freq', top ? `Most common: ${top[0]}` : 'No objections logged', 'Train that one', { top: top ? top[0] : 'none', counts })
}
export function draftBestTimeOfDay(hour: number) {
  return gated('best-time', hour >= 17 ? 'Evening is working' : 'Daytime is working', 'Schedule the return there', { window: hour >= 17 ? 'evening' : 'day', hour })
}
export function draftIdleGap(minutes: number) {
  return gated('idle-gap', minutes > 15 ? `${minutes} min gap` : 'No gap', minutes > 15 ? 'Check on the rep' : 'None', { alert: minutes > 15, minutes })
}
export function draftDoubleKnock(prior: number) {
  return gated('double-knock', prior >= 1 ? `Already knocked ${prior} time(s)` : 'First knock', prior >= 1 ? 'Do not knock again today' : 'Proceed', { alert: prior >= 1, prior })
}
export function draftDnkViolation(address: string, dnk: string[]) {
  const violation = dnk.some((d) => d.toLowerCase() === address.toLowerCase())
  return gated('dnk-violation', violation ? 'DNK violation' : 'Clear', violation ? 'Alert the manager' : 'None', { violation })
}
export function draftTeamFeed(event: string) {
  return gated('team-feed', event, 'Post to the team', { event })
}
export function draftEndOfDay(doors: number, interested: number) {
  return gated('end-of-day', `${doors} doors, ${interested} interested`, 'Send the recap', { recap: `${doors} doors, ${interested} interested` })
}
export function draftWeeklyTurf(coverage: number) {
  return gated('weekly-turf', `${coverage}% covered this week`, coverage < 70 ? 'Finish before new turf' : 'Can expand', { coverage })
}
export function draftVerifiedKnockPay(verified: number, rate: number) {
  return gated('verified-pay', `${verified} verified × $${rate}`, 'Optional. Owner turns it on.', { pay: verified * rate, optional: true })
}

// 116-125 Estimate bridge
export function draftPinToEstimate(address: string) {
  return gated('pin-estimate', `Open estimate for ${address}`, 'Prefill from the knock', { href: `/estimate?address=${encodeURIComponent(address)}` })
}
export function draftSquaresFromPhoto(photos: number) {
  return gated('squares-photo', photos >= 4 ? 'Enough photos for a draft square count' : 'Need more photos', photos >= 4 ? 'Confirm 22 squares' : 'Shoot elevations', { squares: photos >= 4 ? 22 : null, confidence: photos >= 4 ? 0.6 : 0.2, photos })
}
export function draftPitchFromPhoto(photos: number) {
  return gated('pitch-photo', photos >= 2 ? 'Draft pitch 6/12' : 'Need a slope photo', 'Confirm on site', { pitch: photos >= 2 ? 6 : null, photos })
}
export function draftGoodBetterBest() {
  return gated('gbb', 'Three tiers ready', 'Show Good first', { tiers: ['Good — 3-tab', 'Better — architectural', 'Best — designer'] })
}
export function draftFinancingOffer(total: number) {
  return gated('financing-offer', `About $${Math.round(total / 60)}/mo on 60 months`, 'Mention only if they ask', { monthly: Math.round(total / 60), months: 60, total })
}
export function draftEsignReady(name: string, total: number) {
  const ready = Boolean(name) && total > 0
  return gated('esign', ready ? 'Name and total present' : 'Missing name or total', ready ? 'Queue the e-sign' : 'Fill the gaps', { ready })
}
export function draftMaterialOrder(squares: number) {
  return gated('material-order', `${squares} squares draft order`, 'Office confirms before it sends', { squares, status: 'draft' })
}
export function draftWorkOrder(address: string) {
  return gated('work-order', `Work order draft for ${address}`, 'Office schedules the crew', { address, status: 'draft' })
}
export function draftPortalSummary(address: string, outcome: string) {
  return gated('portal', `${address} — ${outcome}`, 'Homeowner sees this after you send', { summary: `${address} — ${outcome}. Free inspection offered.` })
}
export function draftYoloFreeLog(owner: boolean) {
  return gated('yolo', owner ? 'Owner can free-log' : 'Locked', owner ? 'Toggle is on' : 'Owner PIN required', { allowed: owner, note: 'Owner only' })
}

export const CANVASS_125_CATALOG: { id: string; name: string; group: string }[] = [
  { id: 'draw-territory', name: 'Draw territory', group: 'Territory' },
  { id: 'assign-turf', name: 'Assign turf', group: 'Territory' },
  { id: 'prevent-overlap', name: 'Prevent overlap', group: 'Territory' },
  { id: 'color-pins', name: 'Color pins', group: 'Territory' },
  { id: 'untouched-layer', name: 'Untouched layer', group: 'Territory' },
  { id: 'completed-layer', name: 'Completed layer', group: 'Territory' },
  { id: 'dnk-layer', name: 'Do-not-knock layer', group: 'Territory' },
  { id: 'prior-customer', name: 'Prior customer layer', group: 'Territory' },
  { id: 'multi-unit', name: 'Multi-unit pins', group: 'Territory' },
  { id: 'street-coverage', name: 'Street coverage', group: 'Territory' },
  { id: 'territory-score', name: 'Territory scorecard', group: 'Territory' },
  { id: 'bulk-assign', name: 'Bulk assign streets', group: 'Territory' },
  { id: 'import-addresses', name: 'Import addresses', group: 'Territory' },
  { id: 'export-knocked', name: 'Export knocked', group: 'Territory' },
  { id: 'share-turf', name: 'Share turf link', group: 'Territory' },
  { id: 'hail-overlay', name: 'Hail overlay', group: 'Storm' },
  { id: 'hail-filter', name: 'Hail size filter', group: 'Storm' },
  { id: 'storm-date', name: 'Storm date filter', group: 'Storm' },
  { id: 'wind-overlay', name: 'Wind overlay', group: 'Storm' },
  { id: 'radar-link', name: 'Radar link', group: 'Storm' },
  { id: 'storm-turf', name: 'Storm-zone turf', group: 'Storm' },
  { id: 'roof-age', name: 'Roof age', group: 'Storm' },
  { id: 'roof-type', name: 'Roof type guess', group: 'Storm' },
  { id: 'prior-claim', name: 'Prior claim flag', group: 'Storm' },
  { id: 'new-homeowner', name: 'New homeowner', group: 'Storm' },
  { id: 'recent-sale', name: 'Recent sale', group: 'Storm' },
  { id: 'hoa', name: 'HOA flag', group: 'Storm' },
  { id: 'no-soliciting', name: 'No soliciting', group: 'Storm' },
  { id: 'soft-metal', name: 'Soft-metal target', group: 'Storm' },
  { id: 'neighbor-sold', name: 'Neighbor sold', group: 'Storm' },
  { id: 'walking-order', name: 'Walking order', group: 'Route' },
  { id: 'next-door', name: 'Next door', group: 'Route' },
  { id: 'skip-dnk', name: 'Skip DNK', group: 'Route' },
  { id: 'barrier', name: 'Barrier-aware', group: 'Route' },
  { id: 'drive-to-turf', name: 'Drive to turf', group: 'Route' },
  { id: 'idle-alert', name: 'Idle alert', group: 'Route' },
  { id: 'gps-dwell', name: 'GPS dwell', group: 'Route' },
  { id: 'activity-trail', name: 'Activity trail', group: 'Route' },
  { id: 'doors-per-hour', name: 'Doors per hour', group: 'Route' },
  { id: 'coverage-heat', name: 'Coverage heat', group: 'Route' },
  { id: 'one-tap', name: 'One-tap outcome', group: 'Door' },
  { id: 'voice-log', name: 'Voice log', group: 'Door' },
  { id: 'auto-address', name: 'Auto address', group: 'Door' },
  { id: 'curb-photo', name: 'Curb photo', group: 'Door' },
  { id: 'soft-metal-photo', name: 'Soft-metal photo', group: 'Door' },
  { id: 'granule-photo', name: 'Granule photo', group: 'Door' },
  { id: 'gutter-photo', name: 'Gutter dent photo', group: 'Door' },
  { id: 'screen-photo', name: 'Screen tear photo', group: 'Door' },
  { id: 'annotate-photo', name: 'Annotate photo', group: 'Door' },
  { id: 'album-elevation', name: 'Album by elevation', group: 'Door' },
  { id: 'opener', name: 'Opener script', group: 'Door' },
  { id: 'objection', name: 'Objection response', group: 'Door' },
  { id: 'hard-stop-refusal', name: 'Hard stop refusal', group: 'Door' },
  { id: 'hard-stop-sign', name: 'Hard stop sign', group: 'Door' },
  { id: 'hard-stop-hostile', name: 'Hard stop hostile', group: 'Door' },
  { id: 'score-before', name: 'Score before door', group: 'Lead' },
  { id: 'score-after', name: 'Score after talk', group: 'Lead' },
  { id: 'intent', name: 'Intent from notes', group: 'Lead' },
  { id: 'name-from-notes', name: 'Name from notes', group: 'Lead' },
  { id: 'phone-from-notes', name: 'Phone from notes', group: 'Lead' },
  { id: 'return-window', name: 'Best return time', group: 'Lead' },
  { id: 'follow-up', name: 'Follow-up date', group: 'Lead' },
  { id: 'duplicate', name: 'Duplicate check', group: 'Lead' },
  { id: 'existing-customer', name: 'Existing customer', group: 'Lead' },
  { id: 'prior-knocks', name: 'Prior knock history', group: 'Lead' },
  { id: 'spouse', name: 'Spouse decision', group: 'Lead' },
  { id: 'carrier', name: 'Carrier note', group: 'Lead' },
  { id: 'deductible', name: 'Deductible note', group: 'Lead' },
  { id: 'financing', name: 'Financing flag', group: 'Lead' },
  { id: 'multi-trade', name: 'Multi-trade flag', group: 'Lead' },
  { id: 'voice-interested', name: 'Voice interested', group: 'Voice' },
  { id: 'voice-not-home', name: 'Voice not home', group: 'Voice' },
  { id: 'voice-dnk', name: 'Voice DNK', group: 'Voice' },
  { id: 'voice-note', name: 'Voice add note', group: 'Voice' },
  { id: 'voice-follow-up', name: 'Voice follow-up', group: 'Voice' },
  { id: 'voice-next', name: 'Voice next door', group: 'Voice' },
  { id: 'voice-opener', name: 'Voice opener', group: 'Voice' },
  { id: 'voice-objection', name: 'Voice objection', group: 'Voice' },
  { id: 'spanish-script', name: 'Spanish script', group: 'Voice' },
  { id: 'spanish-log', name: 'Spanish log', group: 'Voice' },
  { id: 'confirm-write', name: 'Confirm before write', group: 'Voice' },
  { id: 'voice-queue', name: 'Offline voice queue', group: 'Voice' },
  { id: 'whisper', name: 'Whisper transcript', group: 'Voice' },
  { id: 'structured-note', name: 'Structured note', group: 'Voice' },
  { id: 'sentiment', name: 'Sentiment', group: 'Voice' },
  { id: 'sms', name: 'SMS draft', group: 'Follow-up' },
  { id: 'email', name: 'Email draft', group: 'Follow-up' },
  { id: 'book-inspection', name: 'Book inspection', group: 'Follow-up' },
  { id: 'assign-closer', name: 'Assign closer', group: 'Follow-up' },
  { id: 'create-lead', name: 'Create lead', group: 'Follow-up' },
  { id: 'office-task', name: 'Office task', group: 'Follow-up' },
  { id: '15-min', name: '15-minute reminder', group: 'Follow-up' },
  { id: '48-hr', name: '48-hour reminder', group: 'Follow-up' },
  { id: 'no-show', name: 'No-show risk', group: 'Follow-up' },
  { id: 'referral', name: 'Referral ask', group: 'Follow-up' },
  { id: 'review', name: 'Review request', group: 'Follow-up' },
  { id: 'neighbor-list', name: 'Neighbor list', group: 'Follow-up' },
  { id: 'storm-surge', name: 'Storm surge queue', group: 'Follow-up' },
  { id: 'handoff', name: 'Office handoff', group: 'Follow-up' },
  { id: 'daily-summary', name: 'Daily summary', group: 'Follow-up' },
  { id: 'leaderboard', name: 'Leaderboard', group: 'Manager' },
  { id: 'contact-rate', name: 'Contact rate', group: 'Manager' },
  { id: 'dph-rep', name: 'Doors/hour by rep', group: 'Manager' },
  { id: 'turf-conversion', name: 'Conversion by turf', group: 'Manager' },
  { id: 'coaching', name: 'Coaching tip', group: 'Manager' },
  { id: 'script-ab', name: 'Script A/B', group: 'Manager' },
  { id: 'objection-freq', name: 'Objection frequency', group: 'Manager' },
  { id: 'best-time', name: 'Best time of day', group: 'Manager' },
  { id: 'idle-gap', name: 'Idle gap', group: 'Manager' },
  { id: 'double-knock', name: 'Double knock', group: 'Manager' },
  { id: 'dnk-violation', name: 'DNK violation', group: 'Manager' },
  { id: 'team-feed', name: 'Team feed', group: 'Manager' },
  { id: 'end-of-day', name: 'End of day', group: 'Manager' },
  { id: 'weekly-turf', name: 'Weekly turf', group: 'Manager' },
  { id: 'verified-pay', name: 'Verified knock pay', group: 'Manager' },
  { id: 'pin-estimate', name: 'Pin to estimate', group: 'Estimate' },
  { id: 'squares-photo', name: 'Squares from photo', group: 'Estimate' },
  { id: 'pitch-photo', name: 'Pitch from photo', group: 'Estimate' },
  { id: 'gbb', name: 'Good Better Best', group: 'Estimate' },
  { id: 'financing-offer', name: 'Financing offer', group: 'Estimate' },
  { id: 'esign', name: 'E-sign ready', group: 'Estimate' },
  { id: 'material-order', name: 'Material order', group: 'Estimate' },
  { id: 'work-order', name: 'Work order', group: 'Estimate' },
  { id: 'portal', name: 'Portal summary', group: 'Estimate' },
  { id: 'yolo', name: 'YOLO free log', group: 'Estimate' },
]

export const CANVASS_125 = CANVASS_125_CATALOG

export function canvass125Count() {
  return CANVASS_125_CATALOG.length
}
