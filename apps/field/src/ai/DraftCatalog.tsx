import { Pressable, Text, View, Modal, ScrollView, TextInput } from 'react-native'
import { useState, useMemo } from 'react'
import * as batch1 from './batch1'
import * as batch3 from './batch3'
import * as batch26 from './batch26to50'
import * as batch76 from './batch76to100'
import * as batch101 from './batch101to125'
import * as batch126 from './batch126to150'
import * as batch151 from './batch151to175'
import * as batch176 from './batch176to200'
import * as batch201 from './batch201to225'
import { enqueue } from './behaviors'

const modules = [batch1, batch3, batch26, batch76, batch101, batch126, batch151, batch176, batch201]

type Entry = { name: string; fn: (...args: any[]) => any }

function collect(): Entry[] {
  const seen = new Set<string>()
  const out: Entry[] = []
  for (const mod of modules) {
    for (const [name, fn] of Object.entries(mod)) {
      if (typeof fn === 'function' && name.startsWith('draft') && !seen.has(name)) {
        seen.add(name)
        out.push({ name, fn })
      }
    }
  }
  return out.sort((a, b) => a.name.localeCompare(b.name))
}

const ALL = collect()

function sampleArgs(name: string, notes: string, squares: number, pitch: number, photoCount: number): any[] {
  if (/notes|text|match|severity|hail|wind|color|upsell|handoff|completeness|damage|album|structured/i.test(name)) return [notes || 'hail damage 20 squares']
  if (/square|duration|crew|waste|labor|dumpster|vent/i.test(name)) return [squares || 20]
  if (/pitch|steep|ice/i.test(name)) return [pitch || 6]
  if (/photo|quality|missing|granule/i.test(name)) return [photoCount || 4]
  if (/total|cost|margin|financing|price/i.test(name)) return [10000]
  if (/warranty|years/i.test(name)) return [30]
  return [notes || 'sample', squares || 20, pitch || 6]
}

export function DraftCatalog({ notes, squares, pitch, photoCount }: { notes: string; squares: number; pitch: number; photoCount: number }) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [result, setResult] = useState<string | null>(null)
  const [picked, setPicked] = useState('')

  const filtered = useMemo(() => ALL.filter(e => e.name.toLowerCase().includes(q.toLowerCase())), [q])

  async function run(entry: Entry) {
    try {
      const args = sampleArgs(entry.name, notes, squares, pitch, photoCount)
      const out = entry.fn(...args)
      setPicked(entry.name)
      const queued = await enqueue('desktop-approval', { name: entry.name, result: out })
      setResult(JSON.stringify({ result: out, queued }, null, 2))
    } catch (err) {
      setPicked(entry.name)
      setResult('Draft failed: ' + (err instanceof Error ? err.message : String(err)))
    }
  }

  return (
    <View style={{ marginTop: 12 }}>
      <Pressable onPress={() => setOpen(true)} style={{ backgroundColor: '#0b1220', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#1f3a5f' }}>
        <Text style={{ color: '#9ecbff', textAlign: 'center', fontWeight: '600' }}>All AI drafts ({ALL.length})</Text>
      </Pressable>
      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={{ flex: 1, backgroundColor: '#f7f9fc', padding: 12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <Text style={{ fontSize: 18, fontWeight: '700' }}>All drafts</Text>
            <Pressable onPress={() => setOpen(false)}><Text style={{ color: '#1769e0', fontWeight: '600' }}>Close</Text></Pressable>
          </View>
          <TextInput value={q} onChangeText={setQ} placeholder="Filter…" style={{ backgroundColor: '#fff', borderRadius: 8, padding: 10, marginBottom: 8 }} />
          <ScrollView style={{ flex: 1 }}>
            {filtered.map(e => (
              <Pressable key={e.name} onPress={() => run(e)} style={{ padding: 10, backgroundColor: '#fff', borderRadius: 6, marginBottom: 6 }}>
                <Text style={{ fontWeight: '600' }}>{e.name}</Text>
              </Pressable>
            ))}
          </ScrollView>
          {result && (
            <View style={{ maxHeight: 200, backgroundColor: '#fff', borderRadius: 8, padding: 8, marginTop: 8 }}>
              <Text style={{ fontWeight: '700', marginBottom: 4 }}>{picked}</Text>
              <ScrollView><Text selectable style={{ fontFamily: 'monospace', fontSize: 11 }}>{result}</Text></ScrollView>
            </View>
          )}
        </View>
      </Modal>
    </View>
  )
}
