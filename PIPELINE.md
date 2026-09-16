# Photo → report pipeline

The machine drafts. A human sends. A human signs.

## Flow

1. Photo of the house.
2. Vision model (xAI or other) drafts an address. Human confirms.
3. Confirmed address → NWS / NOAA storm-event candidates: hail, damaging wind, dates. Candidates, not “this house was hit.”
4. Aerial / satellite assist → draft squares. OSM footprint first. No certified measure claim.
5. Building-code *jurisdiction family* for that state. Link to the AHJ. We do not paste ICC books.
6. Four draft estimates from the owner price book.
7. One packet. Contractor reviews. Email + signature only after approve.

## Four estimates

| Slot | Meaning |
| --- | --- |
| Good | Repair / cap-out what is honest to sell |
| Better | Full reroof, mid system |
| Best | Full reroof, top system + warranty packet |
| Restoration draft | Insurance-shaped draft from our book, not a carrier price list |

All four stay DRAFT until the contractor sends.

## Open source / public path

| Step | Path |
| --- | --- |
| Photo store | Supabase Storage |
| Address from photo | xAI vision or open vision later. Confirm on screen. |
| Geocode | Nominatim / OSM |
| Storm dates | NWS alerts + NOAA Storm Events / IEM. Attribution required. |
| Aerial assist | OSM building footprint. Paid aerial later if we buy it. |
| Code family | State family reference only. Not legal advice. |
| Estimates | Owner price book |
| Signature | Documenso or similar later. Not wired. |
| Email | Resend / Postmark later. Not wired. |
