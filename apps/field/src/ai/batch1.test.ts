import { draftGoldenReport, draftEstimate } from './batch1'

describe('batch1 drafts', () => {
  it('report draft requires approval', () => {
    const d = draftGoldenReport({
      photos: [{ damageScore: 0.5, pitchEstimate: 6, suggestedAlbum: 'damage', suggestedCaption: null, condition: 'fair', observations: ['test'] }],
      notes: 'note',
      measurements: { squares: 20, pitch: 6 },
    })
    expect(d.requiresApproval).toBe(true)
    expect(d.deficiencies.length).toBeGreaterThan(0)
  })

  it('estimate draft requires approval', () => {
    const d = draftEstimate({
      squares: 30,
      pitch: 8,
      priceBook: { laborPerSquare: 100, materialPerSquare: 80, minMargin: 2000 },
    })
    expect(d.requiresApproval).toBe(true)
    expect(d.subtotal).toBeGreaterThan(0)
  })
})
