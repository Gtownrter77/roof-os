import { StatusBar } from 'expo-status-bar'
import * as ImagePicker from 'expo-image-picker'
import * as Linking from 'expo-linking'
import * as SQLite from 'expo-sqlite'
import { useEffect, useState } from 'react'
import { Alert, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'

const colors = { ink: '#102033', blue: '#1769e0', pale: '#eef5ff', green: '#138a5b', border: '#dbe4ef', muted: '#607086', white: '#ffffff', amber: '#9a5b00' }
const db = SQLite.openDatabaseSync('roofos-field.db')

type Draft = { id: number; address: string; photoCount: number; status: string; updatedAt: string }

function ensureDatabase() {
  db.execSync(`CREATE TABLE IF NOT EXISTS inspection_drafts (id INTEGER PRIMARY KEY AUTOINCREMENT, address TEXT NOT NULL DEFAULT '', photo_count INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'draft', updated_at TEXT NOT NULL);`)
}

export default function App() {
  const [address, setAddress] = useState('')
  const [photos, setPhotos] = useState(0)
  const [notice, setNotice] = useState('')
  const [draft, setDraft] = useState<Draft | null>(null)

  useEffect(() => {
    try {
      ensureDatabase()
      const existing = db.getFirstSync<Draft>('SELECT id, address, photo_count as photoCount, status, updated_at as updatedAt FROM inspection_drafts ORDER BY updated_at DESC LIMIT 1')
      if (existing) { setDraft(existing); setAddress(existing.address); setPhotos(existing.photoCount) }
    } catch { setNotice('Offline storage is unavailable. Do not close the app until the draft is saved.') }
  }, [])

  function saveDraft(nextAddress = address, nextPhotos = photos) {
    try {
      ensureDatabase()
      const now = new Date().toISOString()
      if (draft) {
        db.runSync('UPDATE inspection_drafts SET address = ?, photo_count = ?, updated_at = ? WHERE id = ?', nextAddress, nextPhotos, now, draft.id)
        setDraft({ ...draft, address: nextAddress, photoCount: nextPhotos, updatedAt: now })
      } else {
        const result = db.runSync('INSERT INTO inspection_drafts (address, photo_count, status, updated_at) VALUES (?, ?, ?, ?)', nextAddress, nextPhotos, 'draft', now)
        setDraft({ id: result.lastInsertRowId, address: nextAddress, photoCount: nextPhotos, status: 'draft', updatedAt: now })
      }
      setNotice('Draft saved on this device. It is queued for sync when the workspace connection is configured.')
    } catch { setNotice('Could not save the draft locally. Keep the app open and try again.') }
  }

  async function startCamera() {
    const permission = await ImagePicker.requestCameraPermissionsAsync()
    if (!permission.granted) { Alert.alert('Camera permission needed', 'Allow camera access to capture inspection evidence.'); return }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 })
    if (!result.canceled) {
      const nextPhotos = photos + result.assets.length
      setPhotos(nextPhotos)
      saveDraft(address, nextPhotos)
      setNotice(`${result.assets.length} photo${result.assets.length === 1 ? '' : 's'} added and draft saved locally.`)
    }
  }

  function openDirections() {
    if (!address.trim()) { setNotice('Enter a job address first.'); return }
    Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`)
  }

  return <SafeAreaView style={styles.safe}><StatusBar style="dark"/><ScrollView contentContainerStyle={styles.content}><View style={styles.header}><View><Text style={styles.eyebrow}>ROOF/OS FIELD</Text><Text style={styles.title}>Good morning</Text><Text style={styles.subtitle}>Capture the job. Keep the office moving.</Text></View><View style={styles.avatar}><Text style={styles.avatarText}>RL</Text></View></View><View style={styles.hero}><Text style={styles.heroLabel}>NEXT ACTION</Text><Text style={styles.heroTitle}>Start an inspection</Text><Text style={styles.heroText}>Evidence is saved as a durable offline draft before any future sync.</Text><Pressable style={styles.primary} onPress={startCamera}><Text style={styles.primaryText}>Open camera</Text></Pressable></View><View style={styles.metrics}><Metric value="3" label="Today"/><Metric value={String(photos)} label="Draft photos"/><Metric value={draft ? 'Saved' : 'New'} label="Offline draft"/></View><Text style={styles.sectionTitle}>Jobsite navigation</Text><View style={styles.card}><Text style={styles.cardTitle}>Navigate to a lead</Text><TextInput value={address} onChangeText={setAddress} onBlur={() => saveDraft()} placeholder="Enter job address" placeholderTextColor="#8b99aa" style={styles.input}/><Pressable style={styles.secondary} onPress={openDirections}><Text style={styles.secondaryText}>Open Google Maps directions</Text></Pressable><Text style={styles.helper}>No Maps API key required. This opens the device’s navigation experience.</Text></View><Text style={styles.sectionTitle}>Field checklist</Text><View style={styles.card}><Checklist label="Confirm customer and property"/><Checklist label="Capture roof elevations and damage"/><Checklist label="Add notes and next action"/><Checklist label="Upload when online"/></View>{notice ? <Text style={styles.notice}>{notice}</Text> : null}<Text style={styles.footer}>Local draft persistence is enabled. Server sync remains gated until workspace authentication and storage rules are configured.</Text></ScrollView></SafeAreaView>
}
function Metric({ value, label }: { value: string; label: string }) { return <View style={styles.metric}><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View> }
function Checklist({ label }: { label: string }) { return <View style={styles.check}><View style={styles.checkDot}/><Text style={styles.checkText}>{label}</Text></View> }
const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: '#f7f9fc' }, content: { padding: 20, paddingBottom: 40 }, header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }, eyebrow: { color: colors.blue, fontSize: 12, fontWeight: '800', letterSpacing: 1.5 }, title: { color: colors.ink, fontSize: 30, fontWeight: '800', marginTop: 4 }, subtitle: { color: colors.muted, marginTop: 4, fontSize: 14 }, avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' }, avatarText: { color: colors.white, fontWeight: '800' }, hero: { backgroundColor: colors.ink, borderRadius: 22, padding: 22, marginBottom: 14 }, heroLabel: { color: '#9dc4ff', fontWeight: '800', fontSize: 11, letterSpacing: 1.4 }, heroTitle: { color: colors.white, fontSize: 24, fontWeight: '800', marginTop: 8 }, heroText: { color: '#cad7e8', lineHeight: 21, marginTop: 8, marginBottom: 18 }, primary: { backgroundColor: '#3e8cff', paddingVertical: 14, borderRadius: 12, alignItems: 'center' }, primaryText: { color: colors.white, fontWeight: '800', fontSize: 16 }, metrics: { flexDirection: 'row', gap: 10, marginBottom: 22 }, metric: { flex: 1, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 14 }, metricValue: { color: colors.ink, fontSize: 20, fontWeight: '800' }, metricLabel: { color: colors.muted, fontSize: 12, marginTop: 3 }, sectionTitle: { color: colors.ink, fontSize: 17, fontWeight: '800', marginBottom: 10, marginTop: 6 }, card: { backgroundColor: colors.white, borderColor: colors.border, borderWidth: 1, borderRadius: 16, padding: 16, marginBottom: 18 }, cardTitle: { color: colors.ink, fontSize: 16, fontWeight: '700', marginBottom: 10 }, input: { borderColor: colors.border, borderWidth: 1, borderRadius: 10, padding: 12, color: colors.ink, marginBottom: 10 }, secondary: { backgroundColor: colors.pale, paddingVertical: 12, borderRadius: 10, alignItems: 'center' }, secondaryText: { color: colors.blue, fontWeight: '800' }, helper: { color: colors.muted, fontSize: 12, lineHeight: 17, marginTop: 8 }, check: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9 }, checkDot: { width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: colors.green, marginRight: 10 }, checkText: { color: colors.ink, fontSize: 14 }, notice: { color: colors.green, backgroundColor: '#e7f7ef', padding: 12, borderRadius: 10, marginBottom: 14 }, footer: { color: colors.muted, fontSize: 12, lineHeight: 17, textAlign: 'center' } })
