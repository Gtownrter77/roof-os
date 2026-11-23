# ROOF/OS exact workflow

This is the locked path. Do not invent a second one.

## 1. The photo

The owner allows location on the phone. The phone writes GPS into the photo.

- GPS in the file: this photo can start a measurement.
- No GPS in the file: evidence only. No measurement starts from it.
- A nearby phone reading does not count. If it is not in the file, it is not the key.

## 2. Address

The GPS in the photo is read. It becomes the address. The tech does not type the address for this path.

## 3. Skyview

The address is sent to skyview. Skyview is the top-down view of that house.

## 4. The wizard

The wizard measures the skyview with the established formulas.

- 100 sf = 1 sq
- Displays are whole, .33, or .66
- Full replacement starts at 10 sq
- 6 sq is owner-toggle only
- Never a fractional bundle

It returns a detailed drawing, the measurements, and an estimate. The AI does this work for Auto. A technician MAY trace roof geometry by hand on this path **only** when the drawn polygons are persisted and the area is recomputed on the server from reviewed geometry, scale and pitch; a client-supplied area is never authoritative.

## 5. The tech judges

The tech reviews the drawing, the measurements, and the estimate. The tech tags a lock only if it is correct. If it is not correct, it is not tagged.

## 6. The owner sets the sequence

There is no fixed ladder. The owner decides the business model.

- A trusted tech can be `self` only.
- A new field tech can be `self`, then `inspector`, then `owner`.

Each step is a lock. Send stays locked until every step the owner required is tagged.

## 7. Send

After the last lock is tagged, the tech has one click.

- Email the estimate to the homeowner.
- Text the estimate to the homeowner.

Nothing is sent before the owner sequence is complete.

## What this is not

- Not a crew app. The field app is the owner and inspector console.
- Not a guess from a phone location beside the photo.
- Not an estimate that leaves the building before the owner's locks are tagged.

## Amendment (2026-11-23)

<!-- EXACT-WORKFLOW.md:31 amendment — owner decision (b), 2026-11-23 -->
Owner decision (b), recorded in `docs/superpowers/specs/2026-11-23-roofr-roofsnap-mashup-design.md`, amends line 31 only: a reviewed, server-recomputed Manual trace may become an authoritative quantity alongside Auto. The conditions on line 31 still hold — persisted polygons, server recomputation from reviewed geometry, scale and pitch, and no client-supplied area. Every other step of the locked path is unchanged; no second workflow is created.
