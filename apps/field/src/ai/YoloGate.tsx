import { Pressable, Text, View, Modal, Switch, TextInput, Alert } from 'react-native'
import { useEffect, useState } from 'react'
import * as SecureStore from 'expo-secure-store'

const KEY = 'roofos.yolo.v1'
const PIN_KEY = 'roofos.yolo.pin'

export type YoloFlags = {
  unlocked: boolean
  freeEstimate: boolean
  freePrefill: boolean
  freeCustomerText: boolean
  freeMaterialOrder: boolean
  freeCanvass: boolean
  freeAll: boolean
}

const DEFAULTS: YoloFlags = {
  unlocked: false,
  freeEstimate: false,
  freePrefill: false,
  freeCustomerText: false,
  freeMaterialOrder: false,
  freeCanvass: false,
  freeAll: false,
}

async function load(): Promise<YoloFlags> {
  try {
    const raw = await SecureStore.getItemAsync(KEY)
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS
  } catch {
    return DEFAULTS
  }
}

async function save(flags: YoloFlags) {
  await SecureStore.setItemAsync(KEY, JSON.stringify(flags))
}

export function YoloGate() {
  const [flags, setFlags] = useState<YoloFlags>(DEFAULTS)
  const [revealed, setRevealed] = useState(false)
  const [open, setOpen] = useState(false)
  const [pin, setPin] = useState('')
  const [hasPin, setHasPin] = useState(false)

  useEffect(() => {
    load().then(setFlags)
    SecureStore.getItemAsync(PIN_KEY).then(p => setHasPin(!!p))
  }, [])

  function update(next: Partial<YoloFlags>) {
    const merged = { ...flags, ...next }
    setFlags(merged)
    save(merged)
  }

  async function unlock() {
    const stored = await SecureStore.getItemAsync(PIN_KEY)
    if (!stored) {
      if (pin.length < 4) {
        Alert.alert('Set a PIN', 'Enter at least 4 digits to lock YOLO mode.')
        return
      }
      await SecureStore.setItemAsync(PIN_KEY, pin)
      setHasPin(true)
      update({ unlocked: true })
      setPin('')
      return
    }
    if (pin === stored) {
      update({ unlocked: true })
      setPin('')
    } else {
      Alert.alert('Wrong PIN', 'Owner PIN required.')
    }
  }

  function lock() {
    update({ unlocked: false, freeEstimate: false, freePrefill: false, freeCustomerText: false, freeMaterialOrder: false, freeCanvass: false, freeAll: false })
  }

  if (!revealed) {
    return (
      <Pressable onLongPress={() => setRevealed(true)} delayLongPress={1200} style={{ height: 8 }} />
    )
  }

  return (
    <View style={{ marginTop: 8 }}>
      <Pressable onPress={() => setOpen(true)} style={{ padding: 8, backgroundColor: '#1a0a0a', borderRadius: 6, borderWidth: 1, borderColor: '#5a1a1a' }}>
        <Text style={{ color: '#ff6b6b', textAlign: 'center', fontSize: 12 }}>YOLO {flags.unlocked ? 'UNLOCKED' : 'LOCKED'}</Text>
      </Pressable>
      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={{ flex: 1, backgroundColor: '#0b0b0f', padding: 20 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
            <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700' }}>Owner YOLO</Text>
            <Pressable onPress={() => setOpen(false)}><Text style={{ color: '#9ecbff' }}>Close</Text></Pressable>
          </View>
          <Text style={{ color: '#aaa', marginBottom: 12, fontSize: 12 }}>Hidden. Long-press the empty gap above to reveal. Owner PIN required. Free toggles let AI apply without the approval gate.</Text>
          {!flags.unlocked ? (
            <>
              <TextInput value={pin} onChangeText={setPin} placeholder={hasPin ? 'Owner PIN' : 'Set owner PIN (4+ digits)'} secureTextEntry keyboardType="number-pad" style={{ backgroundColor: '#1a1a22', color: '#fff', padding: 12, borderRadius: 8, marginBottom: 12 }} />
              <Pressable onPress={unlock} style={{ backgroundColor: '#b42318', padding: 12, borderRadius: 8 }}>
                <Text style={{ color: '#fff', textAlign: 'center', fontWeight: '600' }}>{hasPin ? 'Unlock' : 'Set PIN and unlock'}</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Row label="Free estimate apply" value={flags.freeEstimate} onChange={v => update({ freeEstimate: v })} />
              <Row label="Free AI prefill" value={flags.freePrefill} onChange={v => update({ freePrefill: v })} />
              <Row label="Free customer text" value={flags.freeCustomerText} onChange={v => update({ freeCustomerText: v })} />
              <Row label="Free material order" value={flags.freeMaterialOrder} onChange={v => update({ freeMaterialOrder: v })} />
              <Row label="Free canvass AI (125)" value={flags.freeCanvass} onChange={v => update({ freeCanvass: v })} />
              <Row label="Free all drafts" value={flags.freeAll} onChange={v => update({ freeAll: v })} />
              <Pressable onPress={lock} style={{ marginTop: 20, backgroundColor: '#222', padding: 12, borderRadius: 8 }}>
                <Text style={{ color: '#fff', textAlign: 'center' }}>Lock and hide toggles</Text>
              </Pressable>
            </>
          )}
        </View>
      </Modal>
    </View>
  )
}

function Row({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderColor: '#222' }}>
      <Text style={{ color: '#fff' }}>{label}</Text>
      <Switch value={value} onValueChange={onChange} />
    </View>
  )
}
