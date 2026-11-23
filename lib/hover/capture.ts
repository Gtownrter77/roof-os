import { CAPTURE_SLOTS, type CaptureValidation, type ScanImage, type ScaleAnchor, type SlotId } from './types.ts'

const BLUR_THRESHOLD = 0.6
const LIGHT_THRESHOLD = 0.4
const REFERENCE_KINDS = new Set(['bar', 'door', 'garage', 'wall'])

export function classifySlot(value: unknown): SlotId | null {
  return CAPTURE_SLOTS.some((slot) => slot.id === value) ? value as SlotId : null
}

export function assessImageQuality(image: ScanImage): 'ok' | 'recapture' {
  if (image.blurScore !== null && image.blurScore !== undefined && image.blurScore < BLUR_THRESHOLD) return 'recapture'
  if (image.lightScore !== null && image.lightScore !== undefined && image.lightScore < LIGHT_THRESHOLD) return 'recapture'
  return 'ok'
}

export function validateCapture(images: ScanImage[], anchors: ScaleAnchor[]): CaptureValidation {
  const seenSlots = new Map<SlotId, number>()
  const rejectedImages: { imageId: string; reason: string }[] = []
  let quality: 'ok' | 'recapture' = 'ok'

  for (const image of images) {
    if (image.role !== 'model') continue
    const slot = classifySlot(image.slot)
    if (!slot) {
      rejectedImages.push({ imageId: image.id, reason: 'model image has no valid side/corner slot' })
      continue
    }
    if (seenSlots.has(slot)) {
      rejectedImages.push({ imageId: image.id, reason: `duplicate slot ${slot}` })
      continue
    }
    if (!image.gpsInFile) {
      rejectedImages.push({ imageId: image.id, reason: `GPS must be embedded in the photo file (${slot})` })
      continue
    }
    if (assessImageQuality(image) === 'recapture') quality = 'recapture'
    seenSlots.set(slot, 1)
  }

  const missingSlots = CAPTURE_SLOTS
    .map((slot) => slot.id)
    .filter((slot) => !seenSlots.has(slot))
  const anchorsAccepted = anchors.filter((anchor) =>
    Number.isFinite(anchor.observedValue) && anchor.observedValue > 0 &&
    (anchor.unit === 'ft' || anchor.unit === 'm'))
  const hasReference = anchorsAccepted.some((anchor) => REFERENCE_KINDS.has(anchor.kind))
  const complete = missingSlots.length === 0 && rejectedImages.length === 0

  let reason: string | null = null
  if (missingSlots.length) reason = `missing required slots: ${missingSlots.join(', ')}`
  else if (rejectedImages.length) reason = rejectedImages[0].reason
  else if (quality === 'recapture') reason = 'one or more model photos fail blur/light checks; recapture required'
  else if (!hasReference) reason = 'no reference measurement recorded; scale cue may be obscured'

  return { complete, missingSlots, rejectedImages, quality, anchorsAccepted, reason }
}
