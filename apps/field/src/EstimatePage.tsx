import { useMemo, useState } from 'react'
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native'

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
  onClose?: () => void
}

const SECTIONS = ['Materials', 'Labor', 'Accessories', 'Other'] as const

function uid() {
  return Math.random().toString(36).slice(2, 9)
}

function seedItems(squares: number, pitch: number, laborRate: number, materialRate: number): LineItem[] {
  const waste = pitch >= 8 ? 0.15 : 0.1
  const matQty = Math.round(squares * (1 + waste) * 10) / 10
  return [
    { id: uid(), section: 'Materials', name: 'Architectural shingles', qty: matQty, unit: 'sq', unitPrice: materialRate || 95, },
    { id: uid(), section: 'Materials', name: 'Synthetic underlayment', qty: Math.round(squares * 1.05 * 10) / 10, unit: 'sq', unitPrice: 18 },
    { id: uid(), section: 'Materials', name: 'Starter strip', qty: Math.round(squares * 0.4 * 10) / 10, unit: 'lf', unitPrice: 1.2 },
    { id: uid(), section: 'Labor', name: 'Tear-off and install', qty: squares, unit: 'sq', unitPrice: laborRate || 45 },
    { id: uid(), section: 'Labor', name: 'Steep adder', qty: pitch >= 8 ? squares : 0, unit: 'sq', unitPrice: 12 },
    { id: uid(), section: 'Accessories', name: 'Ridge vent', qty: Math.round(squares * 2), unit: 'lf', unitPrice: 4.5 },
    { id: uid(), section: 'Accessories', name: 'Pipe boots', qty: 4, unit: 'ea', unitPrice: 28 },
    { id: uid(), section: 'Other', name: 'Dumpster', qty: squares > 25 ? 2 : 1, unit: 'ea', unitPrice: 450 },
    { id: uid(), section: 'Other', name: 'Permit allowance', qty: 1, unit: 'ea', unitPrice: 150 },
  ]
}

export function EstimatePage({ squares, pitch, notes, laborRate, materialRate, minMargin, onClose }: Props) {
  const [items, setItems] = useState<LineItem[]>(() => seedItems(squares, pitch, laborRate, materialRate))
  const [taxRate, setTaxRate] = useState(7)
  const [marginPct, setMarginPct] = useState(minMargin || 20)
  const [customerNote, setCustomerNote] = useState('Draft estimate — technician must approve on desktop before sending.')
  const [internalNote, setInternalNote] = useState(notes || '')
  const [open, setOpen] = useState<Record<string, boolean>>({ Materials: true, Labor: true, Accessories: true, Other: true })

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
