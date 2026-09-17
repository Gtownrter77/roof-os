import { StatusBar } from 'expo-status-bar'
import * as ImagePicker from 'expo-image-picker'
import * as Linking from 'expo-linking'
import * as Location from 'expo-location'

import * as SecureStore from 'expo-secure-store'
import { createClient, type Session } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'
import { ActivityIndicator, Alert, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'

const colors = { ink: '#102033', blue: '#1769e0', pale: '#eef5ff', green: '#138a5b', border: '#dbe4ef', muted: '#607086', white: '#fff', red: '#b42318' }
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''
const webAppUrl = process.env.EXPO_PUBLIC_WEB_APP_URL ?? 'https://roof-os-lemon.vercel.app'
import { db } from './src/localDb'
const supabase = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey, { auth: { storage: { getItem: SecureStore.getItemAsync, setItem: SecureStore.setItemAsync, removeItem: SecureStore.deleteItemAsync }, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } }) : null

type Draft = { id: number; remoteId: string | null; address: string; photoCount: number; status: string; updatedAt: string; latitude: number | null; longitude: number | null }
type Point = { latitude: number; longitude: number }
const timestamp = () => new Date().toISOString()

function ensureDatabase() {
  db.execSync(`CREATE TABLE IF NOT EXISTS inspection_drafts (id INTEGER PRIMARY KEY AUTOINCREMENT, remote_id TEXT, address TEXT NOT NULL DEFAULT '', photo_count INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'draft', latitude REAL, longitude REAL, updated_at TEXT NOT NULL); CREATE TABLE IF NOT EXISTS inspection_measurements_local (id INTEGER PRIMARY KEY AUTOINCREMENT, draft_id INTEGER NOT NULL, roof_squares REAL NOT NULL, gutter_lf REAL NOT NULL, latitude REAL, longitude REAL, captured_at TEXT NOT NULL, sync_status TEXT NOT NULL DEFAULT 'queued'); CREATE TABLE IF NOT EXISTS inspection_photo_queue (id INTEGER PRIMARY KEY AUTOINCREMENT, draft_id INTEGER NOT NULL, local_uri TEXT NOT NULL, captured_at TEXT NOT NULL, sync_status TEXT NOT NULL DEFAULT 'queued', remote_id TEXT, error TEXT);`)
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [booting, setBooting] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authBusy, setAuthBusy] = useState(false)
  const [address, setAddress] = useState('')
  const [photos, setPhotos] = useState(0)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [point, setPoint] = useState<Point | null>(null)
  const [squares, setSquares] = useState('')
  const [gutters, setGutters] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [syncing, setSyncing] = useState(false)
  const [checks, setChecks] = useState({ property: false, elevations: false, notes: false, upload: false })

  useEffect(() => {
    ensureDatabase()
    if (!supabase) { setError('Mobile Supabase environment is not configured. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to the Expo/EAS build environment, then rebuild the app.'); setBooting(false); return }
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setBooting(false) })
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next))
    return () => data.subscription.unsubscribe()
  }, [])

  useEffect(() => { if (session) loadDraft() }, [session])

  function loadDraft() {
    const row = db.getFirstSync<Draft>('SELECT id, remote_id as remoteId, address, photo_count as photoCount, status, updated_at as updatedAt, latitude, longitude FROM inspection_drafts ORDER BY updated_at DESC LIMIT 1')
    if (row) { setDraft(row); setAddress(row.address); setPhotos(row.photoCount); if (row.latitude !== null && row.longitude !== null) setPoint({ latitude: row.latitude, longitude: row.longitude }) }
  }

  function saveDraft(nextAddress = address, nextPhotos = photos, nextPoint = point): number | null {
    try {
      const now = timestamp()
      if (draft) {
        db.runSync('UPDATE inspection_drafts SET address = ?, photo_count = ?, latitude = ?, longitude = ?, updated_at = ? WHERE id = ?', nextAddress, nextPhotos, nextPoint?.latitude ?? null, nextPoint?.longitude ?? null, now, draft.id)
        setDraft({ ...draft, address: nextAddress, photoCount: nextPhotos, latitude: nextPoint?.latitude ?? null, longitude: nextPoint?.longitude ?? null, updatedAt: now })
        return draft.id
      }
      const result = db.runSync('INSERT INTO inspection_drafts (address, photo_count, status, latitude, longitude, updated_at) VALUES (?, ?, ?, ?, ?, ?)', nextAddress, nextPhotos, 'draft', nextPoint?.latitude ?? null, nextPoint?.longitude ?? null, now)
      const created = { id: result.lastInsertRowId, remoteId: null, address: nextAddress, photoCount: nextPhotos, status: 'draft', latitude: nextPoint?.latitude ?? null, longitude: nextPoint?.longitude ?? null, updatedAt: now }
      setDraft(created); return created.id
    } catch { setError('Could not save the local draft. Keep the app open and try again.'); return null }
  }

  async function signIn() {
    if (!supabase) { setError('Mobile Supabase environment is not configured. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to the Expo/EAS build environment, then rebuild the app.'); return }
    if (!email.trim() || password.length < 6) { setError('Enter a valid email and a password with at least 6 characters.'); return }
    setAuthBusy(true); setError('')
    const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (authError) setError(authError.message)
    setAuthBusy(false)
  }

  async function capturePhoto() {
    const permission = await ImagePicker.requestCameraPermissionsAsync()
    if (!permission.granted) { Alert.alert('Camera permission needed', 'Allow camera access to capture inspection evidence.'); return }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 })
    if (result.canceled) return
    const count = photos + result.assets.length; const draftId = saveDraft(address, count)
    if (!draftId) return
    const capturedAt = timestamp()
    result.assets.forEach((asset) => db.runSync('INSERT INTO inspection_photo_queue (draft_id, local_uri, captured_at) VALUES (?, ?, ?)', draftId, asset.uri, capturedAt))
    setPhotos(count); setNotice(`${result.assets.length} photo${result.assets.length === 1 ? '' : 's'} saved to the offline upload queue.`)
    if (session) void syncNow()
  }

  async function captureLocation() {
    const permission = await Location.requestForegroundPermissionsAsync()
    if (!permission.granted) { setError('Location permission is required to attach a property coordinate.'); return }
    const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
    const next = { latitude: current.coords.latitude, longitude: current.coords.longitude }; setPoint(next); saveDraft(address, photos, next)
    setNotice(`Location captured at ${next.latitude.toFixed(5)}, ${next.longitude.toFixed(5)}. Confirm the address before using it for a claim.`)
  }

  function saveMeasurements() {
    const roof = Number(squares); const gutter = Number(gutters)
    if (!Number.isFinite(roof) || roof <= 0 || !Number.isFinite(gutter) || gutter < 0) { setError('Enter valid roof squares and gutter linear feet.'); return }
    const draftId = saveDraft(); if (!draftId) return
    db.runSync('INSERT INTO inspection_measurements_local (draft_id, roof_squares, gutter_lf, latitude, longitude, captured_at) VALUES (?, ?, ?, ?, ?, ?)', draftId, roof, gutter, point?.latitude ?? null, point?.longitude ?? null, timestamp())
    setNotice('Measurements saved locally as manual, unverified inputs.'); if (session) void syncNow()
  }

  async function syncNow() {
    if (!supabase || !session || !draft || syncing) return
    setSyncing(true); setError('')
    try {
      const { data: workspaceId, error: workspaceError } = await supabase.rpc('current_workspace_id')
      if (workspaceError || !workspaceId) throw new Error('No workspace is available for this account.')
      let remoteId = draft.remoteId
      if (!remoteId) {
        const { data, error: insertError } = await supabase.from('inspection_sessions').insert({ workspace_id: workspaceId, created_by: session.user.id, status: 'draft', client_version: 'field-0.2.0' }).select('id').single()
        if (insertError) throw insertError
        remoteId = data.id; db.runSync('UPDATE inspection_drafts SET remote_id = ? WHERE id = ?', remoteId, draft.id); setDraft({ ...draft, remoteId })
      }
      const measurements = db.getAllSync<{ roof_squares: number; gutter_lf: number; latitude: number | null; longitude: number | null; captured_at: string }>('SELECT roof_squares, gutter_lf, latitude, longitude, captured_at FROM inspection_measurements_local WHERE draft_id = ? AND sync_status = ?', draft.id, 'queued')
      for (const measurement of measurements) {
        const { error } = await supabase.from('inspection_measurements').insert({ workspace_id: workspaceId, inspection_id: remoteId, source_type: 'manual', confidence: 'unverified', roof_squares: measurement.roof_squares, gutter_lf: measurement.gutter_lf, latitude: measurement.latitude, longitude: measurement.longitude, source_reference: 'field-mobile-manual', captured_at: measurement.captured_at, created_by: session.user.id })
        if (error) throw error
      }
      if (measurements.length) db.runSync('UPDATE inspection_measurements_local SET sync_status = ? WHERE draft_id = ?', 'synced', draft.id)
      const queued = db.getAllSync<{ id: number; local_uri: string; captured_at: string }>('SELECT id, local_uri, captured_at FROM inspection_photo_queue WHERE draft_id = ? AND sync_status = ?', draft.id, 'queued')
      for (const photo of queued) {
        const objectPath = `${workspaceId}/${session.user.id}/${remoteId}/${photo.id}.jpg`; const response = await fetch(photo.local_uri); const blob = await response.blob()
        const { error: uploadError } = await supabase.storage.from('inspection-photos').upload(objectPath, blob, { contentType: 'image/jpeg', upsert: false })
        if (uploadError) throw uploadError
        const { data, error: recordError } = await supabase.from('inspection_photos').insert({ inspection_id: remoteId, workspace_id: workspaceId, uploaded_by: session.user.id, bucket_id: 'inspection-photos', object_path: objectPath, album: 'general', mime_type: 'image/jpeg', captured_at: photo.captured_at, upload_status: 'uploaded' }).select('id').single()
        if (recordError) throw recordError
        db.runSync('UPDATE inspection_photo_queue SET sync_status = ?, remote_id = ? WHERE id = ?', 'synced', data.id, photo.id)
      }
      setNotice('Synced securely to the workspace. Evidence and estimates remain review-gated.')
    } catch (syncError) { setError(syncError instanceof Error ? `Sync paused: ${syncError.message}` : 'Sync paused. Your local draft is safe and will retry.') }
    finally { setSyncing(false) }
  }

  if (booting) return <SafeAreaView style={styles.center}><ActivityIndicator color={colors.blue}/><Text style={styles.helper}>Loading secure field session…</Text></SafeAreaView>
  if (!session) return <AuthScreen email={email} password={password} setEmail={setEmail} setPassword={setPassword} signIn={signIn} busy={authBusy} error={error} configured={Boolean(supabase)}/>
  const name = session.user.email?.split('@')[0] ?? 'Field user'
  const toggle = (key: keyof typeof checks) => setChecks((current) => ({ ...current, [key]: !current[key] }))
  return <SafeAreaView style={styles.safe}><StatusBar style="dark"/><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled"><View style={styles.header}><View><Text style={styles.eyebrow}>ROOF/OS FIELD</Text><Text style={styles.title}>Good morning</Text><Text style={styles.subtitle}>{name} · offline-ready capture</Text></View><Pressable style={styles.avatar} onPress={() => void supabase?.auth.signOut()} accessibilityLabel="Sign out"><Text style={styles.avatarText}>{name.slice(0, 2).toUpperCase()}</Text></Pressable></View><View style={styles.hero}><Text style={styles.heroLabel}>NEXT ACTION</Text><Text style={styles.heroTitle}>Start an inspection</Text><Text style={styles.heroText}>Drafts save locally before sync. Workspace access and private evidence storage are protected by Supabase RLS.</Text><Pressable style={styles.primary} onPress={capturePhoto}><Text style={styles.primaryText}>Open camera</Text></Pressable></View><View style={styles.metrics}><Metric value={String(photos)} label="Draft photos"/><Metric value={draft ? 'Saved' : 'New'} label="Offline draft"/><Metric value={syncing ? 'Syncing' : 'Ready'} label="Workspace"/></View><Text style={styles.sectionTitle}>Property location</Text><View style={styles.card}><Text style={styles.cardTitle}>Confirm address and GPS</Text><TextInput value={address} onChangeText={setAddress} onBlur={() => saveDraft()} placeholder="Enter job address" placeholderTextColor="#8b99aa" style={styles.input} accessibilityLabel="Job address"/><View style={styles.row}><Pressable style={styles.secondaryHalf} onPress={captureLocation}><Text style={styles.secondaryText}>Capture GPS</Text></Pressable><Pressable style={styles.secondaryHalf} onPress={() => address.trim() ? Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`) : setError('Enter a job address first.')}><Text style={styles.secondaryText}>Open directions</Text></Pressable></View><Text style={styles.helper}>{point ? `GPS captured: ${point.latitude.toFixed(5)}, ${point.longitude.toFixed(5)}` : 'GPS shows where the inspector stood; it does not prove ownership or damage.'}</Text></View><Text style={styles.sectionTitle}>Manual measurement review</Text><View style={styles.card}><Text style={styles.cardTitle}>Draft inputs — unverified</Text><View style={styles.row}><TextInput value={squares} onChangeText={setSquares} keyboardType="decimal-pad" placeholder="Roof squares" placeholderTextColor="#8b99aa" style={styles.inputHalf} accessibilityLabel="Roof squares"/><TextInput value={gutters} onChangeText={setGutters} keyboardType="decimal-pad" placeholder="Gutter LF" placeholderTextColor="#8b99aa" style={styles.inputHalf} accessibilityLabel="Gutter linear feet"/></View><Pressable style={styles.secondary} onPress={saveMeasurements}><Text style={styles.secondaryText}>Save measurements for review</Text></Pressable><Pressable style={styles.reportButton} onPress={() => Linking.openURL(`${webAppUrl}/reports`)}><Text style={styles.reportButtonText}>Open inspection report builder</Text></Pressable></View><Text style={styles.sectionTitle}>Field checklist</Text><View style={styles.card}><Checklist label="Confirm customer and property" checked={checks.property} onPress={() => toggle('property')}/><Checklist label="Capture roof elevations and damage" checked={checks.elevations} onPress={() => toggle('elevations')}/><Checklist label="Add notes and next action" checked={checks.notes} onPress={() => toggle('notes')}/><Checklist label="Upload when online" checked={checks.upload} onPress={() => toggle('upload')}/></View><Pressable style={styles.syncButton} onPress={() => void syncNow()} disabled={syncing}><Text style={styles.syncText}>{syncing ? 'Syncing securely…' : 'Sync queued work now'}</Text></Pressable>{notice ? <Text style={styles.notice}>{notice}</Text> : null}{error ? <Text style={styles.error}>{error}</Text> : null}<Text style={styles.footer}>Field release 0.2.0 · local drafts remain until server confirmation.</Text></ScrollView></SafeAreaView>
}

function AuthScreen({ email, password, setEmail, setPassword, signIn, busy, error, configured }: { email: string; password: string; setEmail: (value: string) => void; setPassword: (value: string) => void; signIn: () => void; busy: boolean; error: string; configured: boolean }) { return <SafeAreaView style={styles.center}><View style={styles.authCard}><Text style={styles.eyebrow}>ROOF/OS FIELD</Text><Text style={styles.authTitle}>Secure field access</Text><Text style={styles.helper}>Sign in before accessing inspections or evidence.</Text><TextInput value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="Work email" placeholderTextColor="#8b99aa" style={styles.input}/><TextInput value={password} onChangeText={setPassword} secureTextEntry placeholder="Password" placeholderTextColor="#8b99aa" style={styles.input}/><Pressable style={styles.primary} onPress={signIn} disabled={busy}><Text style={styles.primaryText}>{busy ? 'Signing in…' : 'Sign in'}</Text></Pressable>{!configured ? <Text style={styles.error}>Mobile Supabase environment variables are not configured.</Text> : null}{error ? <Text style={styles.error}>{error}</Text> : null}</View></SafeAreaView> }
function Metric({ value, label }: { value: string; label: string }) { return <View style={styles.metric}><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View> }
function Checklist({ label, checked, onPress }: { label: string; checked: boolean; onPress: () => void }) { return <Pressable style={styles.check} onPress={onPress} accessibilityRole="checkbox" accessibilityState={{ checked }}><View style={[styles.checkDot, checked && styles.checkDotChecked]}/><Text style={styles.checkText}>{label}</Text></Pressable> }
const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: '#f7f9fc' }, center: { flex: 1, backgroundColor: '#f7f9fc', justifyContent: 'center', padding: 24 }, content: { padding: 20, paddingBottom: 40 }, header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }, eyebrow: { color: colors.blue, fontSize: 12, fontWeight: '800', letterSpacing: 1.5 }, title: { color: colors.ink, fontSize: 30, fontWeight: '800', marginTop: 4 }, subtitle: { color: colors.muted, marginTop: 4, fontSize: 14 }, avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' }, avatarText: { color: colors.white, fontWeight: '800' }, hero: { backgroundColor: colors.ink, borderRadius: 22, padding: 22, marginBottom: 14 }, heroLabel: { color: '#9dc4ff', fontWeight: '800', fontSize: 11, letterSpacing: 1.4 }, heroTitle: { color: colors.white, fontSize: 24, fontWeight: '800', marginTop: 8 }, heroText: { color: '#cad7e8', lineHeight: 21, marginTop: 8, marginBottom: 18 }, primary: { backgroundColor: '#3e8cff', paddingVertical: 14, borderRadius: 12, alignItems: 'center' }, primaryText: { color: colors.white, fontWeight: '800', fontSize: 16 }, metrics: { flexDirection: 'row', gap: 10, marginBottom: 22 }, metric: { flex: 1, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 14 }, metricValue: { color: colors.ink, fontSize: 20, fontWeight: '800' }, metricLabel: { color: colors.muted, fontSize: 12, marginTop: 3 }, sectionTitle: { color: colors.ink, fontSize: 17, fontWeight: '800', marginBottom: 10, marginTop: 6 }, card: { backgroundColor: colors.white, borderColor: colors.border, borderWidth: 1, borderRadius: 16, padding: 16, marginBottom: 18 }, authCard: { backgroundColor: colors.white, borderColor: colors.border, borderWidth: 1, borderRadius: 18, padding: 22 }, authTitle: { color: colors.ink, fontSize: 28, fontWeight: '800', marginVertical: 10 }, cardTitle: { color: colors.ink, fontSize: 16, fontWeight: '700', marginBottom: 10 }, input: { borderColor: colors.border, borderWidth: 1, borderRadius: 10, padding: 12, color: colors.ink, marginBottom: 10 }, row: { flexDirection: 'row', gap: 10 }, inputHalf: { flex: 1, borderColor: colors.border, borderWidth: 1, borderRadius: 10, padding: 12, color: colors.ink, marginBottom: 10 }, secondary: { backgroundColor: colors.pale, paddingVertical: 12, borderRadius: 10, alignItems: 'center' }, secondaryHalf: { flex: 1, backgroundColor: colors.pale, paddingVertical: 12, borderRadius: 10, alignItems: 'center' }, reportButton: { backgroundColor: '#dff7eb', paddingVertical: 12, borderRadius: 10, alignItems: 'center', marginTop: 10 }, reportButtonText: { color: colors.green, fontWeight: '800' }, secondaryText: { color: colors.blue, fontWeight: '800' }, helper: { color: colors.muted, fontSize: 12, lineHeight: 17, marginTop: 8 }, check: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9 }, checkDot: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: colors.green, marginRight: 10 }, checkDotChecked: { backgroundColor: colors.green }, checkText: { color: colors.ink, fontSize: 14 }, syncButton: { borderColor: colors.blue, borderWidth: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center', marginBottom: 14 }, syncText: { color: colors.blue, fontWeight: '800' }, notice: { color: colors.green, backgroundColor: '#e7f7ef', padding: 12, borderRadius: 10, marginBottom: 14 }, error: { color: colors.red, backgroundColor: '#fff1f0', padding: 12, borderRadius: 10, marginTop: 12 }, footer: { color: colors.muted, fontSize: 12, lineHeight: 17, textAlign: 'center' } })
