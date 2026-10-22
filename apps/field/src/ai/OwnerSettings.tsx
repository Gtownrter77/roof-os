import { Pressable, Text, View, Modal, Switch, TextInput, Alert, ScrollView } from 'react-native'
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

async function loadFlags(): Promise<YoloFlags> {
  try {
    const raw = await SecureStore.getItemAsync(KEY)
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS
  } catch {
    return DEFAULTS
  }
}

async function saveFlags(flags: YoloFlags) {
  await SecureStore.setItemAsync(KEY, JSON.stringify(flags))
}

export function OwnerSettings({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [flags, setFlags] = useState<YoloFlags>(DEFAULTS)
  const [hasPin, setHasPin] = useState(false)
  const [authed, setAuthed] = useState(false)
  const [pin, setPin] = useState('')
  const [newPin, setNewPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')

  useEffect(() => {
    if (!visible) return
    loadFlags().then(setFlags)
    SecureStore.getItemAsync(PIN_KEY).then(p => {
      setHasPin(!!p)
      setAuthed(!p)
    })
    setPin('')
    setNewPin('')
    setConfirmPin('')
  }, [visible])

  function update(next: Partial<YoloFlags>) {
    const merged = { ...flags, ...next }
    setFlags(merged)
    saveFlags(merged)
  }

  async function authenticate() {
    const stored = await SecureStore.getItemAsync(PIN_KEY)
    if (!stored) {
      setAuthed(true)
      return
    }
    if (pin === stored) {
      setAuthed(true)
      setPin('')
    } else {
      Alert.alert('Wrong PIN', 'Owner PIN required.')
    }
  }

  async function setPinNow() {
    if (newPin.length < 4) {
      Alert.alert('PIN too short', 'Use at least 4 digits.')
      return
    }
    if (newPin !== confirmPin) {
      Alert.alert('Mismatch', 'PINs do not match.')
      return
    }
    await SecureStore.setItemAsync(PIN_KEY, newPin)
    setHasPin(true)
    setNewPin('')
    setConfirmPin('')
    Alert.alert('Saved', 'Owner PIN updated.')
  }

  async function clearPin() {
    await SecureStore.deleteItemAsync(PIN_KEY)
    setHasPin(false)
    update({ unlocked: false, freeEstimate: false, freePrefill: false, freeCustomerText: false, freeMaterialOrder: false, freeCanvass: false, freeAll: false })
    Alert.alert('Cleared', 'PIN removed. YOLO locked.')
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <ScrollView style={{ flex: 1, backgroundColor: '#0b0b0f' }} contentContainerStyle={{ padding: 20 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
          <Text style={{ color: '#fff', fontSize: 20, fontWeight: '700' }}>Owner settings</Text>
          <Pressable onPress={onClose}><Text style={{ color: '#9ecbff', fontWeight: '600' }}>Close</Text></Pressable>
        </View>

        {!authed ? (
          <>
            <Text style={{ color: '#aaa', marginBottom: 12 }}>Enter owner PIN to open settings.</Text>
            <TextInput value={pin} onChangeText={setPin} placeholder="Owner PIN" secureTextEntry keyboardType="number-pad" style={inputStyle} />
            <Pressable onPress={authenticate} style={btnStyle('#1769e0')}>
              <Text style={{ color: '#fff', textAlign: 'center', fontWeight: '600' }}>Unlock settings</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={{ color: '#9ecbff', fontWeight: '700', marginBottom: 8 }}>PIN</Text>
            <TextInput value={newPin} onChangeText={setNewPin} placeholder={hasPin ? 'New PIN' : 'Set PIN (4+ digits)'} secureTextEntry keyboardType="number-pad" style={inputStyle} />
            <TextInput value={confirmPin} onChangeText={setConfirmPin} placeholder="Confirm PIN" secureTextEntry keyboardType="number-pad" style={inputStyle} />
            <Pressable onPress={setPinNow} style={btnStyle('#138a5b')}>
              <Text style={{ color: '#fff', textAlign: 'center', fontWeight: '600' }}>{hasPin ? 'Change PIN' : 'Set PIN'}</Text>
            </Pressable>
            {hasPin && (
              <Pressable onPress={clearPin} style={[btnStyle('#b42318'), { marginTop: 8 }]}>
                <Text style={{ color: '#fff', textAlign: 'center' }}>Clear PIN and lock YOLO</Text>
              </Pressable>
            )}

            <Text style={{ color: '#9ecbff', fontWeight: '700', marginTop: 24, marginBottom: 8 }}>YOLO free toggles</Text>
            <Text style={{ color: '#888', fontSize: 12, marginBottom: 8 }}>These let AI apply without the approval gate. Off by default.</Text>
            <Row label="Unlock YOLO" value={flags.unlocked} onChange={v => update({ unlocked: v })} />
            <Row label="Free estimate apply" value={flags.freeEstimate} onChange={v => update({ freeEstimate: v })} />
            <Row label="Free AI prefill" value={flags.freePrefill} onChange={v => update({ freePrefill: v })} />
            <Row label="Free customer text" value={flags.freeCustomerText} onChange={v => update({ freeCustomerText: v })} />
            <Row label="Free material order" value={flags.freeMaterialOrder} onChange={v => update({ freeMaterialOrder: v })} />
            <Row label="Free canvass AI (125)" value={flags.freeCanvass} onChange={v => update({ freeCanvass: v })} />
            <Row label="Free all drafts" value={flags.freeAll} onChange={v => update({ freeAll: v })} />
          </>
        )}
      </ScrollView>
    </Modal>
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

const inputStyle = { backgroundColor: '#1a1a22', color: '#fff', padding: 12, borderRadius: 8, marginBottom: 8 }
function btnStyle(bg: string) { return { backgroundColor: bg, padding: 12, borderRadius: 8 } }
