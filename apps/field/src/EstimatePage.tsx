import { useMemo, useState } from 'react'
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import {
  draftMaterialMatch,
  draftTearOff,
  draftDeckRepair,
  draftPipeBoots,
  draftRidgeVent,
  draftSoffit,
  draftFascia,
  draftGutterGuard,
  draftSatellite,
  draftSolar,
  draftCricket,
  draftIceBarrier,
  draftUnderlaymentType,
  draftNailPattern,
  draftWasteFactor,
  draftLaborCrew,
  draftDuration,
  draftStaging,
  draftSafetyHarness,
  draftDumpFee,
  draftPermitCost,
} from './ai/batch126to150'
import { draftGoodBetterBest, draftPitchLabor, draftMaterialOrder, draftPortalSummary, draftESignReady, draftFinancingOffer } from './ai/batch151to175'
import { draftJobCost, draftWorkOrderTasks, draftMarginFloor, draftWarranty, draftCompleteness, draftNextAction } from './ai/batch176to200'
import { draftColorMatch, draftCustomerTextShort, draftOfficeHandoff, draftUpsell, draftCompetitiveNote } from './ai/batch201to225'

type LineItem = {
  id: string
  name: string
  qty: number
  unit: string
  unitPrice: number
  section: string
}

type Props = {
  squares: number
  pitch: number
  notes: string
  laborRate: number
  materialRate: number
  minMargin: number
  state?: string
  stories?: number
  onClose?: () => void
}

const SECTIONS = [
  'Roofing',
  'Roofing Repairs',
  'Gutters',
  'Downspouts',
  'Siding',
  'Windows',
  'Exterior Painting',
  'Interior Painting',
  'Fascia',
  'Soffit',
  'Accessories',
  'Other',
] as const

function uid() {
  return Math.random().toString(36).slice(2, 9)
}

function aiSeedItems(squares: number, pitch: number, notes: string, laborRate: number, materialRate: number, state: string, stories: number): LineItem[] {
  const material = draftMaterialMatch(notes)
  const tear = draftTearOff(notes)
  const deck = draftDeckRepair(notes)
  const boots = draftPipeBoots(notes)
  const ridge = draftRidgeVent(squares)
  const soffitNeeded = draftSoffit(notes)
  const fasciaNeeded = draftFascia(notes)
  const guard = draftGutterGuard(notes)
  const sat = draftSatellite(notes)
  const solar = draftSolar(notes)
  const cricket = draftCricket(pitch)
  const ice = draftIceBarrier(state)
  const under = draftUnderlaymentType(pitch)
  const nails = draftNailPattern(pitch >= 8 ? 'high' : 'normal')
  const waste = draftWasteFactor(pitch, 1)
  const crew = draftLaborCrew(squares)
  const duration = draftDuration(squares)
  const staging = draftStaging(stories)
  const harness = draftSafetyHarness(pitch)
  const dump = draftDumpFee(squares)
  const permit = draftPermitCost()

  const wasteFactor = 1 + waste.percent / 100
  const matQty = Math.round(squares * wasteFactor * 10) / 10
  const eaveLf = Math.round(squares * 4)
  const rakeLf = Math.round(squares * 2)
  const hipRidgeLf = Math.round(squares * 3)
  const wallSf = Math.round(squares * 40)
  const windowCount = Math.max(4, Math.round(squares / 4))

  const items: LineItem[] = []

  // Roofing
  items.push({ id: uid(), section: 'Roofing', name: material.match + ' (with waste)', qty: matQty, unit: 'sq', unitPrice: materialRate || 95 })
  items.push({ id: uid(), section: 'Roofing', name: under.type, qty: Math.round(squares * 1.05 * 10) / 10, unit: 'sq', unitPrice: under.type.includes('Double') ? 28 : 18 })
  if (ice.needed) items.push({ id: uid(), section: 'Roofing', name: 'Ice & water barrier (eaves + valleys)', qty: Math.round(squares * 0.35 * 10) / 10, unit: 'sq', unitPrice: 45 })
  items.push({ id: uid(), section: 'Roofing', name: 'Starter strip', qty: eaveLf + rakeLf, unit: 'lf', unitPrice: 1.2 })
  items.push({ id: uid(), section: 'Roofing', name: 'Drip edge', qty: eaveLf + rakeLf, unit: 'lf', unitPrice: 1.8 })
  items.push({ id: uid(), section: 'Roofing', name: 'Ridge cap', qty: hipRidgeLf, unit: 'lf', unitPrice: 3.5 })
  items.push({ id: uid(), section: 'Roofing', name: 'Ridge vent', qty: ridge.lf, unit: 'lf', unitPrice: 4.5 })
  items.push({ id: uid(), section: 'Roofing', name: 'Step flashing', qty: Math.round(squares * 1.5), unit: 'lf', unitPrice: 2.5 })
  items.push({ id: uid(), section: 'Roofing', name: 'Counter flashing', qty: Math.round(squares * 0.8), unit: 'lf', unitPrice: 4 })
  if (boots.count > 0) items.push({ id: uid(), section: 'Roofing', name: 'Pipe boots / vent flashing', qty: boots.count, unit: 'ea', unitPrice: 28 })
  if (cricket.needed) items.push({ id: uid(), section: 'Roofing', name: 'Chimney cricket', qty: 1, unit: 'ea', unitPrice: 180 })
  items.push({ id: uid(), section: 'Roofing', name: nails.pattern + ' pattern', qty: matQty, unit: 'sq', unitPrice: 0 })
  items.push({ id: uid(), section: 'Roofing', name: 'Install labor', qty: squares, unit: 'sq', unitPrice: laborRate || 45 })
  if (tear.needed) items.push({ id: uid(), section: 'Roofing', name: 'Tear-off', qty: squares, unit: 'sq', unitPrice: 15 })
  if (harness.required) items.push({ id: uid(), section: 'Roofing', name: 'Steep / harness adder', qty: squares, unit: 'sq', unitPrice: 12 })
  items.push({ id: uid(), section: 'Roofing', name: `Crew ${crew.crew} · ${duration.days} day(s)`, qty: 1, unit: 'job', unitPrice: 0 })

  // Roofing Repairs
  if (deck.flagged) items.push({ id: uid(), section: 'Roofing Repairs', name: 'Deck / sheathing repair', qty: 1, unit: 'ea', unitPrice: 350 })
  items.push({ id: uid(), section: 'Roofing Repairs', name: 'Valley metal', qty: Math.round(squares * 0.5), unit: 'lf', unitPrice: 6 })
  items.push({ id: uid(), section: 'Roofing Repairs', name: 'Pipe jack / boot replacement', qty: Math.max(1, boots.count), unit: 'ea', unitPrice: 35 })
  items.push({ id: uid(), section: 'Roofing Repairs', name: 'Flashing reseal / touch-up', qty: 1, unit: 'job', unitPrice: 120 })

  // Gutters
  items.push({ id: uid(), section: 'Gutters', name: 'K-style gutter (5")', qty: eaveLf, unit: 'lf', unitPrice: 8 })
  items.push({ id: uid(), section: 'Gutters', name: 'Inside / outside miters', qty: 4, unit: 'ea', unitPrice: 12 })
  items.push({ id: uid(), section: 'Gutters', name: 'End caps', qty: 4, unit: 'ea', unitPrice: 6 })
  items.push({ id: uid(), section: 'Gutters', name: 'Hangers / brackets', qty: Math.ceil(eaveLf / 2), unit: 'ea', unitPrice: 1.5 })
  if (guard.suggest) items.push({ id: uid(), section: 'Gutters', name: 'Gutter guards', qty: eaveLf, unit: 'lf', unitPrice: 4 })

  // Downspouts
  const dsCount = Math.max(2, Math.ceil(eaveLf / 40))
  items.push({ id: uid(), section: 'Downspouts', name: 'Downspouts (3" x 4")', qty: dsCount * 12, unit: 'lf', unitPrice: 6 })
  items.push({ id: uid(), section: 'Downspouts', name: 'Elbows (A/B)', qty: dsCount * 2, unit: 'ea', unitPrice: 8 })
  items.push({ id: uid(), section: 'Downspouts', name: 'Outlets', qty: dsCount, unit: 'ea', unitPrice: 7 })
  items.push({ id: uid(), section: 'Downspouts', name: 'Straps / brackets', qty: dsCount * 3, unit: 'ea', unitPrice: 2 })

  // Siding
  items.push({ id: uid(), section: 'Siding', name: 'Siding (vinyl / fiber cement)', qty: wallSf, unit: 'sf', unitPrice: 4.5 })
  items.push({ id: uid(), section: 'Siding', name: 'House wrap', qty: wallSf, unit: 'sf', unitPrice: 0.35 })
  items.push({ id: uid(), section: 'Siding', name: 'J-channel', qty: Math.round(wallSf * 0.15), unit: 'lf', unitPrice: 1.2 })
  items.push({ id: uid(), section: 'Siding', name: 'Outside corners', qty: 8, unit: 'ea', unitPrice: 18 })
  items.push({ id: uid(), section: 'Siding', name: 'Starter strip', qty: Math.round(wallSf * 0.1), unit: 'lf', unitPrice: 1 })
  items.push({ id: uid(), section: 'Siding', name: 'Demo + disposal', qty: 1, unit: 'job', unitPrice: 450 })
  if (staging.needed) items.push({ id: uid(), section: 'Siding', name: 'Scaffolding / staging', qty: 1, unit: 'job', unitPrice: 350 })

  // Windows
  items.push({ id: uid(), section: 'Windows', name: 'Window replacement', qty: windowCount, unit: 'ea', unitPrice: 450 })
  items.push({ id: uid(), section: 'Windows', name: 'Flashing / seal', qty: windowCount, unit: 'ea', unitPrice: 35 })
  items.push({ id: uid(), section: 'Windows', name: 'Interior trim', qty: windowCount, unit: 'ea', unitPrice: 45 })

  // Exterior Painting
  items.push({ id: uid(), section: 'Exterior Painting', name: 'Prep / scrape / wash', qty: wallSf, unit: 'sf', unitPrice: 0.4 })
  items.push({ id: uid(), section: 'Exterior Painting', name: 'Primer', qty: wallSf, unit: 'sf', unitPrice: 0.35 })
  items.push({ id: uid(), section: 'Exterior Painting', name: '2-coat finish', qty: wallSf, unit: 'sf', unitPrice: 0.9 })
  items.push({ id: uid(), section: 'Exterior Painting', name: 'Trim paint', qty: eaveLf + rakeLf, unit: 'lf', unitPrice: 1.5 })

  // Interior Painting
  const intSf = Math.round(squares * 25)
  items.push({ id: uid(), section: 'Interior Painting', name: 'Walls (primer + 2 coats)', qty: intSf, unit: 'sf', unitPrice: 1.2 })
  items.push({ id: uid(), section: 'Interior Painting', name: 'Ceilings', qty: Math.round(intSf * 0.4), unit: 'sf', unitPrice: 0.8 })
  items.push({ id: uid(), section: 'Interior Painting', name: 'Trim / doors', qty: 1, unit: 'job', unitPrice: 350 })

  // Fascia
  if (fasciaNeeded.needed) {
    items.push({ id: uid(), section: 'Fascia', name: 'Fascia board / wrap', qty: eaveLf + rakeLf, unit: 'lf', unitPrice: 8 })
    items.push({ id: uid(), section: 'Fascia', name: 'Fascia tear-off', qty: eaveLf + rakeLf, unit: 'lf', unitPrice: 2 })
  }

  // Soffit
  if (soffitNeeded.needed) {
    const soffitSf = Math.round(eaveLf * 1.5)
    items.push({ id: uid(), section: 'Soffit', name: 'Soffit panels (vented)', qty: soffitSf, unit: 'sf', unitPrice: 5 })
    items.push({ id: uid(), section: 'Soffit', name: 'J-channel / F-channel', qty: eaveLf * 2, unit: 'lf', unitPrice: 1.1 })
    items.push({ id: uid(), section: 'Soffit', name: 'Soffit tear-off', qty: soffitSf, unit: 'sf', unitPrice: 1.5 })
  }

  // Accessories
  if (sat.present) items.push({ id: uid(), section: 'Accessories', name: 'Satellite relocation', qty: 1, unit: 'ea', unitPrice: 75 })
  if (solar.present) items.push({ id: uid(), section: 'Accessories', name: 'Solar coordination', qty: 1, unit: 'ea', unitPrice: 200 })
  items.push({ id: uid(), section: 'Accessories', name: 'Magnet sweep / cleanup', qty: 1, unit: 'job', unitPrice: 75 })

  // Other
  items.push({ id: uid(), section: 'Other', name: 'Dumpster', qty: 1, unit: 'ea', unitPrice: dump.estimate })
  items.push({ id: uid(), section: 'Other', name: 'Permit allowance', qty: 1, unit: 'ea', unitPrice: permit.estimate })
  items.push({ id: uid(), section: 'Other', name: 'Final walk / punch', qty: 1, unit: 'job', unitPrice: 0 })

  return items
}

function seedItems(squares: number, pitch: number, laborRate: number, materialRate: number): LineItem[] {
  const waste = pitch >= 8 ? 0.15 : 0.1
  const matQty = Math.round(squares * (1 + waste) * 10) / 10
  const eaveLf = Math.round(squares * 4)
  return [
    { id: uid(), section: 'Roofing', name: 'Architectural shingles', qty: matQty, unit: 'sq', unitPrice: materialRate || 95 },
    { id: uid(), section: 'Roofing', name: 'Underlayment', qty: Math.round(squares * 1.05 * 10) / 10, unit: 'sq', unitPrice: 18 },
    { id: uid(), section: 'Roofing', name: 'Starter + drip edge', qty: eaveLf, unit: 'lf', unitPrice: 3 },
    { id: uid(), section: 'Roofing', name: 'Install labor', qty: squares, unit: 'sq', unitPrice: laborRate || 45 },
    { id: uid(), section: 'Gutters', name: 'K-style gutter', qty: eaveLf, unit: 'lf', unitPrice: 8 },
    { id: uid(), section: 'Downspouts', name: 'Downspouts', qty: Math.max(24, Math.round(eaveLf * 0.3)), unit: 'lf', unitPrice: 6 },
    { id: uid(), section: 'Siding', name: 'Siding allowance', qty: Math.round(squares * 40), unit: 'sf', unitPrice: 4.5 },
    { id: uid(), section: 'Windows', name: 'Window allowance', qty: Math.max(4, Math.round(squares / 4)), unit: 'ea', unitPrice: 450 },
    { id: uid(), section: 'Exterior Painting', name: 'Exterior paint', qty: Math.round(squares * 40), unit: 'sf', unitPrice: 1.65 },
    { id: uid(), section: 'Interior Painting', name: 'Interior paint', qty: Math.round(squares * 25), unit: 'sf', unitPrice: 1.2 },
    { id: uid(), section: 'Fascia', name: 'Fascia', qty: eaveLf, unit: 'lf', unitPrice: 8 },
    { id: uid(), section: 'Soffit', name: 'Soffit', qty: Math.round(eaveLf * 1.5), unit: 'sf', unitPrice: 5 },
    { id: uid(), section: 'Other', name: 'Dumpster + permit', qty: 1, unit: 'job', unitPrice: 600 },
  ]
}

export function EstimatePage({ squares, pitch, notes, laborRate, materialRate, minMargin, state = 'GA', stories = 1, onClose }: Props) {
  const [items, setItems] = useState<LineItem[]>(() => seedItems(squares, pitch, laborRate, materialRate))
  const [aiApplied, setAiApplied] = useState(false)
  const [diffDraft, setDiffDraft] = useState<string | null>(null)
  const [taxRate, setTaxRate] = useState(7)
  const [marginPct, setMarginPct] = useState(minMargin || 20)
  const [customerNote, setCustomerNote] = useState('Draft estimate — technician must approve on desktop before sending.')
  const [internalNote, setInternalNote] = useState(notes || '')
  const [open, setOpen] = useState<Record<string, boolean>>({
    Roofing: true,
    'Roofing Repairs': true,
    Gutters: true,
    Downspouts: true,
    Siding: true,
    Windows: true,
    'Exterior Painting': true,
    'Interior Painting': true,
    Fascia: true,
    Soffit: true,
    Accessories: true,
    Other: true,
  })

  const grouped = useMemo(() => {
    const map: Record<string, LineItem[]> = {}
    for (const s of SECTIONS) map[s] = []
    for (const it of items) {
      if (!map[it.section]) map[it.section] = []
      map[it.section].push(it)
    }
    return map
  }, [items])

  const subtotal = items.reduce((sum, it) => sum + it.qty * it.unitPrice, 0)
  const marginAmt = subtotal * (marginPct / 100)
  const taxable = subtotal + marginAmt
  const tax = taxable * (taxRate / 100)
  const total = taxable + tax

  function updateItem(id: string, patch: Partial<LineItem>) {
    setItems(prev => prev.map(it => (it.id === id ? { ...it, ...patch } : it)))
  }

  function addItem(section: string) {
    setItems(prev => [...prev, { id: uid(), section, name: 'New item', qty: 1, unit: 'ea', unitPrice: 0 }])
  }

  function removeItem(id: string) {
    setItems(prev => prev.filter(it => it.id !== id))
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#f7f9fc' }} contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Text style={{ fontSize: 22, fontWeight: '700', color: '#102033' }}>Estimate</Text>
        {onClose && (
          <Pressable onPress={onClose} style={{ padding: 8 }}>
            <Text style={{ color: '#1769e0', fontWeight: '600' }}>Close</Text>
          </Pressable>
        )}
      </View>

      <View style={{ backgroundColor: '#fff3cd', padding: 12, borderRadius: 8, marginBottom: 12 }}>
        <Text style={{ color: '#664d03', fontWeight: '600' }}>DRAFT — technician must approve on desktop</Text>
        <Text style={{ color: '#664d03', marginTop: 4, fontSize: 13 }}>No prices are authoritative. Review all line items before sending.</Text>
        <Pressable
          onPress={() => {
            setItems(aiSeedItems(squares, pitch, notes, laborRate, materialRate, state, stories))
            setAiApplied(true)
          }}
          style={{ marginTop: 10, padding: 10, backgroundColor: '#1769e0', borderRadius: 8 }}
        >
          <Text style={{ color: '#fff', textAlign: 'center', fontWeight: '600' }}>
            {aiApplied ? 'AI prefill applied' : 'AI assist — prefill from notes & measurements'}
          </Text>
        </Pressable>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
          <Pressable onPress={() => setDiffDraft(JSON.stringify(draftGoodBetterBest(), null, 2))} style={{ padding: 6, backgroundColor: '#102033', borderRadius: 6 }}>
            <Text style={{ color: '#fff', fontSize: 11 }}>Good/Better/Best</Text>
          </Pressable>
          <Pressable onPress={() => setDiffDraft(JSON.stringify(draftPitchLabor(laborRate, pitch), null, 2))} style={{ padding: 6, backgroundColor: '#102033', borderRadius: 6 }}>
            <Text style={{ color: '#fff', fontSize: 11 }}>Pitch labor</Text>
          </Pressable>
          <Pressable onPress={() => setDiffDraft(JSON.stringify(draftMaterialOrder(items.map(i => i.name)), null, 2))} style={{ padding: 6, backgroundColor: '#102033', borderRadius: 6 }}>
            <Text style={{ color: '#fff', fontSize: 11 }}>Material order</Text>
          </Pressable>
          <Pressable onPress={() => setDiffDraft(JSON.stringify(draftPortalSummary(total, Object.keys(grouped)), null, 2))} style={{ padding: 6, backgroundColor: '#102033', borderRadius: 6 }}>
            <Text style={{ color: '#fff', fontSize: 11 }}>Portal summary</Text>
          </Pressable>
          <Pressable onPress={() => setDiffDraft(JSON.stringify(draftESignReady(total > 0, true), null, 2))} style={{ padding: 6, backgroundColor: '#102033', borderRadius: 6 }}>
            <Text style={{ color: '#fff', fontSize: 11 }}>E-sign ready</Text>
          </Pressable>
          <Pressable onPress={() => setDiffDraft(JSON.stringify(draftFinancingOffer(total), null, 2))} style={{ padding: 6, backgroundColor: '#102033', borderRadius: 6 }}>
            <Text style={{ color: '#fff', fontSize: 11 }}>Financing</Text>
          </Pressable>
          <Pressable onPress={() => setDiffDraft(JSON.stringify(draftJobCost(total, subtotal * 0.6, subtotal * 0.3, subtotal * 0.1), null, 2))} style={{ padding: 6, backgroundColor: '#102033', borderRadius: 6 }}>
            <Text style={{ color: '#fff', fontSize: 11 }}>Job cost</Text>
          </Pressable>
          <Pressable onPress={() => setDiffDraft(JSON.stringify(draftWorkOrderTasks(Object.keys(grouped)), null, 2))} style={{ padding: 6, backgroundColor: '#102033', borderRadius: 6 }}>
            <Text style={{ color: '#fff', fontSize: 11 }}>Work order</Text>
          </Pressable>
          <Pressable onPress={() => setDiffDraft(JSON.stringify(draftMarginFloor(marginPct, 20), null, 2))} style={{ padding: 6, backgroundColor: '#102033', borderRadius: 6 }}>
            <Text style={{ color: '#fff', fontSize: 11 }}>Margin floor</Text>
          </Pressable>
          <Pressable onPress={() => setDiffDraft(JSON.stringify(draftWarranty(30), null, 2))} style={{ padding: 6, backgroundColor: '#102033', borderRadius: 6 }}>
            <Text style={{ color: '#fff', fontSize: 11 }}>Warranty</Text>
          </Pressable>
          <Pressable onPress={() => setDiffDraft(JSON.stringify(draftCompleteness(0, notes, squares), null, 2))} style={{ padding: 6, backgroundColor: '#102033', borderRadius: 6 }}>
            <Text style={{ color: '#fff', fontSize: 11 }}>Completeness</Text>
          </Pressable>
          <Pressable onPress={() => setDiffDraft(JSON.stringify(draftNextAction('estimated'), null, 2))} style={{ padding: 6, backgroundColor: '#102033', borderRadius: 6 }}>
            <Text style={{ color: '#fff', fontSize: 11 }}>Next action</Text>
          </Pressable>
          <Pressable onPress={() => setDiffDraft(JSON.stringify(draftColorMatch(notes), null, 2))} style={{ padding: 6, backgroundColor: '#102033', borderRadius: 6 }}>
            <Text style={{ color: '#fff', fontSize: 11 }}>Color</Text>
          </Pressable>
          <Pressable onPress={() => setDiffDraft(JSON.stringify(draftCustomerTextShort('Customer', total), null, 2))} style={{ padding: 6, backgroundColor: '#102033', borderRadius: 6 }}>
            <Text style={{ color: '#fff', fontSize: 11 }}>Customer text</Text>
          </Pressable>
          <Pressable onPress={() => setDiffDraft(JSON.stringify(draftOfficeHandoff(0, notes, squares), null, 2))} style={{ padding: 6, backgroundColor: '#102033', borderRadius: 6 }}>
            <Text style={{ color: '#fff', fontSize: 11 }}>Office handoff</Text>
          </Pressable>
          <Pressable onPress={() => setDiffDraft(JSON.stringify(draftUpsell(notes), null, 2))} style={{ padding: 6, backgroundColor: '#102033', borderRadius: 6 }}>
            <Text style={{ color: '#fff', fontSize: 11 }}>Upsell</Text>
          </Pressable>
          <Pressable onPress={() => setDiffDraft(JSON.stringify(draftCompetitiveNote(), null, 2))} style={{ padding: 6, backgroundColor: '#102033', borderRadius: 6 }}>
            <Text style={{ color: '#fff', fontSize: 11 }}>Why us</Text>
          </Pressable>
        </View>
        {diffDraft && (
          <View style={{ marginTop: 8, backgroundColor: '#fff', borderRadius: 6, padding: 8 }}>
            <Text style={{ fontSize: 11, fontFamily: 'monospace' }}>{diffDraft}</Text>
          </View>
        )}
      </View>

      <View style={{ backgroundColor: '#fff', borderRadius: 10, padding: 12, marginBottom: 12 }}>
        <Text style={{ fontWeight: '700', marginBottom: 6 }}>Measurements</Text>
        <Text>Squares: {squares || 0}</Text>
        <Text>Pitch: {pitch || 0}/12</Text>
        <Text>Waste applied: {pitch >= 8 ? '15%' : '10%'}</Text>
      </View>

      {SECTIONS.map(section => (
        <View key={section} style={{ backgroundColor: '#fff', borderRadius: 10, marginBottom: 10, overflow: 'hidden' }}>
          <Pressable onPress={() => setOpen(o => ({ ...o, [section]: !o[section] }))} style={{ padding: 12, backgroundColor: '#eef5ff', flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ fontWeight: '700', color: '#102033' }}>{section}</Text>
            <Text style={{ color: '#607086' }}>{open[section] ? '▼' : '▶'}</Text>
          </Pressable>
          {open[section] && (
            <View style={{ padding: 12 }}>
              {grouped[section].map(it => (
                <View key={it.id} style={{ borderBottomWidth: 1, borderColor: '#eee', paddingVertical: 8 }}>
                  <TextInput value={it.name} onChangeText={t => updateItem(it.id, { name: t })} style={{ fontWeight: '600', marginBottom: 4 }} />
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TextInput
                      keyboardType="numeric"
                      value={String(it.qty)}
                      onChangeText={t => updateItem(it.id, { qty: Number(t) || 0 })}
                      style={{ borderWidth: 1, borderColor: '#dbe4ef', borderRadius: 6, padding: 6, width: 70 }}
                    />
                    <TextInput value={it.unit} onChangeText={t => updateItem(it.id, { unit: t })} style={{ borderWidth: 1, borderColor: '#dbe4ef', borderRadius: 6, padding: 6, width: 50 }} />
                    <TextInput
                      keyboardType="numeric"
                      value={String(it.unitPrice)}
                      onChangeText={t => updateItem(it.id, { unitPrice: Number(t) || 0 })}
                      style={{ borderWidth: 1, borderColor: '#dbe4ef', borderRadius: 6, padding: 6, width: 80 }}
                    />
                    <Text style={{ alignSelf: 'center', flex: 1, textAlign: 'right' }}>${(it.qty * it.unitPrice).toFixed(2)}</Text>
                  </View>
                  <Pressable onPress={() => removeItem(it.id)} style={{ marginTop: 4 }}>
                    <Text style={{ color: '#b42318', fontSize: 12 }}>Remove</Text>
                  </Pressable>
                </View>
              ))}
              <Pressable onPress={() => addItem(section)} style={{ marginTop: 8, padding: 8, backgroundColor: '#eef5ff', borderRadius: 6 }}>
                <Text style={{ color: '#1769e0', textAlign: 'center' }}>+ Add {section.toLowerCase()} item</Text>
              </Pressable>
            </View>
          )}
        </View>
      ))}

      <View style={{ backgroundColor: '#fff', borderRadius: 10, padding: 12, marginBottom: 12 }}>
        <Text style={{ fontWeight: '700', marginBottom: 8 }}>Totals</Text>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
          <Text>Subtotal</Text>
          <Text>${subtotal.toFixed(2)}</Text>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <Text>Margin %</Text>
          <TextInput keyboardType="numeric" value={String(marginPct)} onChangeText={t => setMarginPct(Number(t) || 0)} style={{ borderWidth: 1, borderColor: '#dbe4ef', borderRadius: 6, padding: 6, width: 70, textAlign: 'right' }} />
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
          <Text>Margin</Text>
          <Text>${marginAmt.toFixed(2)}</Text>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <Text>Tax %</Text>
          <TextInput keyboardType="numeric" value={String(taxRate)} onChangeText={t => setTaxRate(Number(t) || 0)} style={{ borderWidth: 1, borderColor: '#dbe4ef', borderRadius: 6, padding: 6, width: 70, textAlign: 'right' }} />
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
          <Text>Tax</Text>
          <Text>${tax.toFixed(2)}</Text>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderColor: '#dbe4ef' }}>
          <Text style={{ fontWeight: '700', fontSize: 16 }}>Total</Text>
          <Text style={{ fontWeight: '700', fontSize: 16 }}>${total.toFixed(2)}</Text>
        </View>
      </View>

      <View style={{ backgroundColor: '#fff', borderRadius: 10, padding: 12, marginBottom: 12 }}>
        <Text style={{ fontWeight: '700', marginBottom: 6 }}>Customer note</Text>
        <TextInput multiline value={customerNote} onChangeText={setCustomerNote} style={{ borderWidth: 1, borderColor: '#dbe4ef', borderRadius: 6, padding: 8, minHeight: 60 }} />
        <Text style={{ fontWeight: '700', marginTop: 10, marginBottom: 6 }}>Internal note</Text>
        <TextInput multiline value={internalNote} onChangeText={setInternalNote} style={{ borderWidth: 1, borderColor: '#dbe4ef', borderRadius: 6, padding: 8, minHeight: 60 }} />
      </View>

      <View style={{ backgroundColor: '#102033', borderRadius: 10, padding: 14 }}>
        <Text style={{ color: '#fff', fontWeight: '700', marginBottom: 4 }}>Workflow (mimicked)</Text>
        <Text style={{ color: '#dbe4ef', fontSize: 13 }}>AccuLynx-style sections + line items</Text>
        <Text style={{ color: '#dbe4ef', fontSize: 13 }}>JobNimbus cover / inspection / details notes</Text>
        <Text style={{ color: '#dbe4ef', fontSize: 13 }}>Roofr measurement-driven quantities + margin</Text>
        <Text style={{ color: '#fff', marginTop: 8, fontSize: 12 }}>All values are drafts. Desktop approval required.</Text>
      </View>
    </ScrollView>
  )
}
