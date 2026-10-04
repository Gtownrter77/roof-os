import { StatusBar } from 'expo-status-bar'
import * as ImagePicker from 'expo-image-picker'
import * as Linking from 'expo-linking'
import * as Location from 'expo-location'

import * as SecureStore from 'expo-secure-store'
import { createClient, type Session } from '@supabase/supabase-js'
import { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Alert, AppState, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'

const colors = { ink: '#102033', blue: '#1769e0', pale: '#eef5ff', green: '#138a5b', border: '#dbe4ef', muted: '#607086', white: '#fff', red: '#b42318' }
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''
const webAppUrl = process.env.EXPO_PUBLIC_WEB_APP_URL ?? 'https://roof-os-lemon.vercel.app'
import { db } from './src/localDb'
const supabase = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey, { auth: { storage: { getItem: SecureStore.getItemAsync, setItem: SecureStore.setItemAsync, removeItem: SecureStore.deleteItemAsync }, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } }) : null

type Draft = { id: number; remoteId: string | null; ownerUserId: string; workspaceId: string | null; clientId: string; leadId: string | null; address: string; photoCount: number; status: string; updatedAt: string; latitude: number | null; longitude: number | null }
type Lead = { id: string; name: string; address: string; status: string }
type AgendaItem = { id: string; kind: 'appointment' | 'task'; title: string; startsAt: string | null; location: string | null; status: string }
const photoAlbums = ['general', 'before', 'damage', 'measurements', 'completed'] as const
type PhotoAlbum = typeof photoAlbums[number]
type Point = { latitude: number; longitude: number }
const timestamp = () => new Date().toISOString()
const clientId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`

function ensureDatabase() {
  db.execSync(`CREATE TABLE IF NOT EXISTS inspection_drafts (id INTEGER PRIMARY KEY AUTOINCREMENT, remote_id TEXT, owner_user_id TEXT, workspace_id TEXT, client_id TEXT, lead_id TEXT, address TEXT NOT NULL DEFAULT '', photo_count INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'draft', latitude REAL, longitude REAL, updated_at TEXT NOT NULL); CREATE TABLE IF NOT EXISTS inspection_measurements_local (id INTEGER PRIMARY KEY AUTOINCREMENT, draft_id INTEGER NOT NULL, client_id TEXT, roof_squares REAL NOT NULL, gutter_lf REAL NOT NULL, latitude REAL, longitude REAL, captured_at TEXT NOT NULL, sync_status TEXT NOT NULL DEFAULT 'queued', retry_count INTEGER NOT NULL DEFAULT 0, next_retry_at TEXT, last_error TEXT); CREATE TABLE IF NOT EXISTS inspection_photo_queue (id INTEGER PRIMARY KEY AUTOINCREMENT, draft_id INTEGER NOT NULL, client_id TEXT, local_uri TEXT NOT NULL, album TEXT NOT NULL DEFAULT 'general', captured_at TEXT NOT NULL, sync_status TEXT NOT NULL DEFAULT 'queued', remote_id TEXT, error TEXT, retry_count INTEGER NOT NULL DEFAULT 0, next_retry_at TEXT, last_error TEXT);`)
  for (const statement of ['ALTER TABLE inspection_drafts ADD COLUMN owner_user_id TEXT', 'ALTER TABLE inspection_drafts ADD COLUMN lead_id TEXT', 'ALTER TABLE inspection_drafts ADD COLUMN workspace_id TEXT', 'ALTER TABLE inspection_drafts ADD COLUMN client_id TEXT', 'ALTER TABLE inspection_measurements_local ADD COLUMN client_id TEXT', 'ALTER TABLE inspection_measurements_local ADD COLUMN retry_count INTEGER NOT NULL DEFAULT 0', 'ALTER TABLE inspection_measurements_local ADD COLUMN next_retry_at TEXT', 'ALTER TABLE inspection_measurements_local ADD COLUMN last_error TEXT', 'ALTER TABLE inspection_photo_queue ADD COLUMN client_id TEXT', 'ALTER TABLE inspection_photo_queue ADD COLUMN album TEXT NOT NULL DEFAULT \'general\'', 'ALTER TABLE inspection_photo_queue ADD COLUMN retry_count INTEGER NOT NULL DEFAULT 0', 'ALTER TABLE inspection_photo_queue ADD COLUMN next_retry_at TEXT', 'ALTER TABLE inspection_photo_queue ADD COLUMN last_error TEXT']) {
    try { db.execSync(statement) } catch { /* Existing installs already have this column. */ }
  }
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
  const [leads, setLeads] = useState<Lead[]>([])
  const [agenda, setAgenda] = useState<AgendaItem[]>([])
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null)
  const [photoAlbum, setPhotoAlbum] = useState<PhotoAlbum>('general')
  const draftRef = useRef<Draft | null>(null)

  useEffect(() => {
    ensureDatabase()
    if (!supabase) { setError('Mobile Supabase environment is not configured. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to the Expo/EAS build environment, then rebuild the app.'); setBooting(false); return }
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setBooting(false) })
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next))
    return () => data.subscription.unsubscribe()
  }, [])

  useEffect(() => { if (session) { loadDraft(); void loadFieldData() } }, [session])

  useEffect(() => {
    if (!session) return
    const retry = () => { if (draftRef.current) void syncNow(draftRef.current) }
    const subscription = AppState.addEventListener('change', (state) => { if (state === 'active') retry() })
    const interval = setInterval(retry, 30_000)
    return () => { subscription.remove(); clearInterval(interval) }
  }, [session])

  function loadDraft() {
    const userId = session?.user.id
    if (!userId) return
    const row = db.getFirstSync<Draft>('SELECT id, remote_id as remoteId, owner_user_id as ownerUserId, workspace_id as workspaceId, client_id as clientId, lead_id as leadId, address, photo_count as photoCount, status, updated_at as updatedAt, latitude, longitude FROM inspection_drafts WHERE owner_user_id = ? ORDER BY updated_at DESC LIMIT 1', userId)
    if (row) { draftRef.current = row; setDraft(row); setSelectedLeadId(row.leadId); setAddress(row.address); setPhotos(row.photoCount); if (row.latitude !== null && row.longitude !== null) setPoint({ latitude: row.latitude, longitude: row.longitude }) }
  }

  async function loadFieldData() {
    if (!supabase || !session) return
    const { data: workspaceId, error: workspaceError } = await supabase.rpc('current_workspace_id')
    if (workspaceError || !workspaceId) return
    const [leadResult, appointmentResult, taskResult] = await Promise.all([
      supabase.from('leads').select('id,name,address,status').order('updated_at', { ascending: false }).limit(50),
      supabase.from('appointments').select('id,title,starts_at,location,status').eq('workspace_id', workspaceId).neq('status', 'cancelled').order('starts_at', { ascending: true }).limit(20),
      supabase.from('tasks').select('id,title,due_at,status').eq('workspace_id', workspaceId).eq('status', 'open').order('due_at', { ascending: true }).limit(20),
    ])
    if (!leadResult.error) setLeads((leadResult.data ?? []) as Lead[])
    const appointments: AgendaItem[] = (appointmentResult.data ?? []).map((item) => ({ id: item.id, kind: 'appointment', title: item.title, startsAt: item.starts_at, location: item.location, status: item.status }))
    const tasks: AgendaItem[] = (taskResult.data ?? []).map((item) => ({ id: item.id, kind: 'task', title: item.title, startsAt: item.due_at, location: null, status: item.status }))
    setAgenda([...appointments, ...tasks].sort((a, b) => (a.startsAt ?? '').localeCompare(b.startsAt ?? '')).slice(0, 8))
  }

  function saveDraft(nextAddress = address, nextPhotos = photos, nextPoint = point, nextLeadId = selectedLeadId): number | null {
    try {
      const now = timestamp()
      if (draft) {
        db.runSync('UPDATE inspection_drafts SET lead_id = ?, address = ?, photo_count = ?, latitude = ?, longitude = ?, updated_at = ? WHERE id = ?', nextLeadId, nextAddress, nextPhotos, nextPoint?.latitude ?? null, nextPoint?.longitude ?? null, now, draft.id)
        const nextDraft = { ...draft, leadId: nextLeadId, address: nextAddress, photoCount: nextPhotos, latitude: nextPoint?.latitude ?? null, longitude: nextPoint?.longitude ?? null, updatedAt: now }
        draftRef.current = nextDraft; setDraft(nextDraft)
        return draft.id
      }
      if (!session?.user.id) throw new Error('An authenticated user is required for local drafts.')
      const createdClientId = clientId('inspection')
      const result = db.runSync('INSERT INTO inspection_drafts (owner_user_id, workspace_id, client_id, lead_id, address, photo_count, status, latitude, longitude, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', session.user.id, null, createdClientId, nextLeadId, nextAddress, nextPhotos, 'draft', nextPoint?.latitude ?? null, nextPoint?.longitude ?? null, now)
      const created = { id: result.lastInsertRowId, remoteId: null, ownerUserId: session.user.id, workspaceId: null, clientId: createdClientId, leadId: nextLeadId, address: nextAddress, photoCount: nextPhotos, status: 'draft', latitude: nextPoint?.latitude ?? null, longitude: nextPoint?.longitude ?? null, updatedAt: now }
      draftRef.current = created; setDraft(created); return created.id
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
    const count = photos + result.assets.length; const draftId = saveDraft(address, count, point, selectedLeadId)
    if (!draftId) return
    const capturedAt = timestamp()
    result.assets.forEach((asset) => db.runSync('INSERT INTO inspection_photo_queue (draft_id, client_id, local_uri, album, captured_at) VALUES (?, ?, ?, ?, ?)', draftId, clientId('photo'), asset.uri, photoAlbum, capturedAt))
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
    db.runSync('INSERT INTO inspection_measurements_local (draft_id, client_id, roof_squares, gutter_lf, latitude, longitude, captured_at) VALUES (?, ?, ?, ?, ?, ?, ?)', draftId, clientId('measurement'), roof, gutter, point?.latitude ?? null, point?.longitude ?? null, timestamp())
    setNotice('Measurements saved locally as manual, unverified inputs.'); if (session) void syncNow()
  }

  async function syncNow(draftToSync = draftRef.current ?? draft) {
    if (!supabase || !session || !draftToSync || syncing) return
    setSyncing(true); setError('')
    try {
      const { data: workspaceId, error: workspaceError } = await supabase.rpc('current_workspace_id')
      if (workspaceError || !workspaceId) throw new Error('No workspace is available for this account.')
      if (draftToSync.ownerUserId !== session.user.id) throw new Error('This draft belongs to a different signed-in user.')
      if (draftToSync.workspaceId && draftToSync.workspaceId !== workspaceId) throw new Error('This draft belongs to a different workspace. Switch workspace before syncing.')
      let remoteId = draftToSync.remoteId
      if (!remoteId) {
        const { data, error: insertError } = await supabase.from('inspection_sessions').upsert({ workspace_id: workspaceId, lead_id: draftToSync.leadId, client_id: draftToSync.clientId, created_by: session.user.id, status: 'draft', client_version: 'field-0.2.0' }, { onConflict: 'workspace_id,client_id' }).select('id').single()
        if (insertError) throw insertError
        remoteId = data.id; db.runSync('UPDATE inspection_drafts SET remote_id = ?, workspace_id = ? WHERE id = ?', remoteId, workspaceId, draftToSync.id); const syncedDraft = { ...draftToSync, remoteId, workspaceId }; draftRef.current = syncedDraft; setDraft(syncedDraft)
      }
      const now = new Date().toISOString()
      const measurements = db.getAllSync<{ id: number; client_id: string; roof_squares: number; gutter_lf: number; latitude: number | null; longitude: number | null; captured_at: string }>('SELECT id, client_id, roof_squares, gutter_lf, latitude, longitude, captured_at FROM inspection_measurements_local WHERE draft_id = ? AND sync_status IN (?, ?) AND (next_retry_at IS NULL OR next_retry_at <= ?)', draftToSync.id, 'queued', 'retrying', now)
      for (const measurement of measurements) {
        const { error } = await supabase.from('inspection_measurements').upsert({ workspace_id: workspaceId, inspection_id: remoteId, client_id: measurement.client_id, source_type: 'manual', confidence: 'unverified', roof_squares: measurement.roof_squares, gutter_lf: measurement.gutter_lf, latitude: measurement.latitude, longitude: measurement.longitude, source_reference: 'field-mobile-manual', captured_at: measurement.captured_at, created_by: session.user.id }, { onConflict: 'workspace_id,client_id' })
        if (error) throw error
        db.runSync('UPDATE inspection_measurements_local SET sync_status = ?, last_error = NULL, next_retry_at = NULL WHERE id = ?', 'synced', measurement.id)
      }
      const queued = db.getAllSync<{ id: number; client_id: string; local_uri: string; album: string; captured_at: string }>('SELECT id, client_id, local_uri, album, captured_at FROM inspection_photo_queue WHERE draft_id = ? AND sync_status IN (?, ?) AND (next_retry_at IS NULL OR next_retry_at <= ?)', draftToSync.id, 'queued', 'retrying', now)
      for (const photo of queued) {
        const objectPath = `${workspaceId}/${session.user.id}/${remoteId}/${photo.client_id}.jpg`; const response = await fetch(photo.local_uri); const blob = await response.blob()
        const { error: uploadError } = await supabase.storage.from('inspection-photos').upload(objectPath, blob, { contentType: 'image/jpeg', upsert: false })
        if (uploadError && !/already exists|duplicate/i.test(uploadError.message)) throw uploadError
        const { data, error: recordError } = await supabase.from('inspection_photos').upsert({ inspection_id: remoteId, client_id: photo.client_id, workspace_id: workspaceId, uploaded_by: session.user.id, bucket_id: 'inspection-photos', object_path: objectPath, album: photo.album, mime_type: 'image/jpeg', captured_at: photo.captured_at, upload_status: 'uploaded' }, { onConflict: 'workspace_id,client_id' }).select('id').single()
        if (recordError) throw recordError
        db.runSync('UPDATE inspection_photo_queue SET sync_status = ?, remote_id = ?, last_error = NULL, next_retry_at = NULL WHERE id = ?', 'synced', data.id, photo.id)
      }
      setNotice('Synced securely to the workspace. Evidence and estimates remain review-gated.')
    } catch (syncError) {
      const message = syncError instanceof Error ? syncError.message : 'Unknown sync error'
      const retryAt = new Date(Date.now() + 30_000).toISOString()
      db.runSync('UPDATE inspection_measurements_local SET sync_status = ?, retry_count = retry_count + 1, next_retry_at = ?, last_error = ? WHERE draft_id = ? AND sync_status IN (?, ?)', 'retrying', retryAt, message, draftToSync.id, 'queued', 'retrying')
      db.runSync('UPDATE inspection_photo_queue SET sync_status = ?, retry_count = retry_count + 1, next_retry_at = ?, last_error = ?, error = ? WHERE draft_id = ? AND sync_status IN (?, ?)', 'retrying', retryAt, message, message, draftToSync.id, 'queued', 'retrying')
      setError(`Sync paused: ${message}. Automatic retry scheduled.`)
    }
    finally { setSyncing(false) }
  }

  if (booting) return <SafeAreaView style={styles.center}><ActivityIndicator color={colors.blue}/><Text style={styles.helper}>Loading secure field session…</Text></SafeAreaView>
  if (!session) return <AuthScreen email={email} password={password} setEmail={setEmail} setPassword={setPassword} signIn={signIn} busy={authBusy} error={error} configured={Boolean(supabase)}/>
  const name = session.user.email?.split('@')[0] ?? 'Field user'
  const toggle = (key: keyof typeof checks) => setChecks((current) => ({ ...current, [key]: !current[key] }))
  return <SafeAreaView style={styles.safe}><StatusBar style="dark"/><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled"><View style={styles.header}><View><Text style={styles.eyebrow}>ROOF/OS FIELD</Text><Text style={styles.title}>Good morning</Text><Text style={styles.subtitle}>{name} · offline-ready capture</Text></View><Pressable style={styles.avatar} onPress={() => void supabase?.auth.signOut()} accessibilityLabel="Sign out"><Text style={styles.avatarText}>{name.slice(0, 2).toUpperCase()}</Text></Pressable></View><View style={styles.hero}><Text style={styles.heroLabel}>UPGRADES ONLY · NO REGRESSIONS</Text><Text style={styles.heroTitle}>Start an inspection</Text><Text style={styles.heroText}>Drafts save locally before sync. Workspace access and private evidence storage are protected by Supabase RLS.</Text><Pressable style={styles.primary} onPress={capturePhoto}><Text style={styles.primaryText}>Open camera</Text></Pressable></View><View style={styles.metrics}><Metric value={String(photos)} label="Draft photos"/><Metric value={draft ? 'Saved' : 'New'} label="Offline draft"/><Metric value={syncing ? 'Syncing' : 'Ready'} label="Workspace"/></View><Text style={styles.sectionTitle}>Today</Text><View style={styles.card}><Text style={styles.cardTitle}>Next appointments and tasks</Text>{agenda.length ? agenda.map((item) => <View key={`${item.kind}-${item.id}`} style={styles.agendaRow}><View style={styles.agendaBadge}><Text style={styles.agendaBadgeText}>{item.kind === 'appointment' ? 'APPT' : 'TASK'}</Text></View><View style={styles.agendaBody}><Text style={styles.agendaTitle}>{item.title}</Text><Text style={styles.helper}>{item.startsAt ? new Date(item.startsAt).toLocaleString() : 'No due date'}{item.location ? ` · ${item.location}` : ''}</Text></View></View>) : <Text style={styles.helper}>No upcoming appointments or open tasks were found.</Text>}</View><Text style={styles.sectionTitle}>Choose a job</Text><View style={styles.card}><Text style={styles.cardTitle}>Attach this inspection to a lead</Text>{leads.length ? leads.map((lead) => <Pressable key={lead.id} style={[styles.leadOption, selectedLeadId === lead.id && styles.leadOptionSelected]} onPress={() => { setSelectedLeadId(lead.id); setAddress(lead.address); saveDraft(lead.address, photos, point, lead.id) }}><View><Text style={styles.leadName}>{lead.name}</Text><Text style={styles.helper}>{lead.address} · {lead.status}</Text></View><Text style={styles.leadCheck}>{selectedLeadId === lead.id ? 'Selected' : 'Use job'}</Text></Pressable>) : <Text style={styles.helper}>No leads were found for this workspace. You can still create an unassigned inspection.</Text>}</View><Text style={styles.sectionTitle}>Property location</Text><View style={styles.card}><Text style={styles.cardTitle}>Confirm address and GPS</Text><TextInput value={address} onChangeText={setAddress} onBlur={() => saveDraft()} placeholder="Enter job address" placeholderTextColor="#8b99aa" style={styles.input} accessibilityLabel="Job address"/><View style={styles.row}><Pressable style={styles.secondaryHalf} onPress={captureLocation}><Text style={styles.secondaryText}>Capture GPS</Text></Pressable><Pressable style={styles.secondaryHalf} onPress={() => address.trim() ? Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`) : setError('Enter a job address first.')}><Text style={styles.secondaryText}>Open directions</Text></Pressable></View><Text style={styles.helper}>{point ? `GPS captured: ${point.latitude.toFixed(5)}, ${point.longitude.toFixed(5)}` : 'GPS shows where the inspector stood; it does not prove ownership or damage.'}</Text></View><Text style={styles.sectionTitle}>Photo album</Text><View style={styles.card}><Text style={styles.cardTitle}>New photos will be saved under</Text><View style={styles.albumRow}>{photoAlbums.map((album) => <Pressable key={album} style={[styles.albumChip, photoAlbum === album && styles.albumChipSelected]} onPress={() => setPhotoAlbum(album)}><Text style={[styles.albumText, photoAlbum === album && styles.albumTextSelected]}>{album}</Text></Pressable>)}</View><Text style={styles.helper}>Albums keep evidence organized for office review and future search.</Text></View><Text style={styles.sectionTitle}>Manual measurement review</Text><View style={styles.card}><Text style={styles.cardTitle}>Draft inputs — unverified</Text><View style={styles.row}><TextInput value={squares} onChangeText={setSquares} keyboardType="decimal-pad" placeholder="Roof squares" placeholderTextColor="#8b99aa" style={styles.inputHalf} accessibilityLabel="Roof squares"/><TextInput value={gutters} onChangeText={setGutters} keyboardType="decimal-pad" placeholder="Gutter LF" placeholderTextColor="#8b99aa" style={styles.inputHalf} accessibilityLabel="Gutter linear feet"/></View><Pressable style={styles.secondary} onPress={saveMeasurements}><Text style={styles.secondaryText}>Save measurements for review</Text></Pressable><Pressable style={styles.reportButton} onPress={() => Linking.openURL(`${webAppUrl}/reports`)}><Text style={styles.reportButtonText}>Open inspection report builder</Text></Pressable></View><Text style={styles.sectionTitle}>Field checklist</Text><View style={styles.card}><Checklist label="Confirm customer and property" checked={checks.property} onPress={() => toggle('property')}/><Checklist label="Capture roof elevations and damage" checked={checks.elevations} onPress={() => toggle('elevations')}/><Checklist label="Add notes and next action" checked={checks.notes} onPress={() => toggle('notes')}/><Checklist label="Upload when online" checked={checks.upload} onPress={() => toggle('upload')}/></View><Pressable style={styles.syncButton} onPress={() => void syncNow()} disabled={syncing}><Text style={styles.syncText}>{syncing ? 'Syncing securely…' : 'Sync queued work now'}</Text></Pressable>{notice ? <Text style={styles.notice}>{notice}</Text> : null}{error ? <Text style={styles.error}>{error}</Text> : null}<Text style={styles.footer}>Field release 0.2.0 · local drafts remain until server confirmation.</Text></ScrollView></SafeAreaView>
}

function AuthScreen({ email, password, setEmail, setPassword, signIn, busy, error, configured }: { email: string; password: string; setEmail: (value: string) => void; setPassword: (value: string) => void; signIn: () => void; busy: boolean; error: string; configured: boolean }) { return <SafeAreaView style={styles.center}><View style={styles.authCard}><Text style={styles.eyebrow}>ROOF/OS FIELD</Text><Text style={styles.authTitle}>Secure field access</Text><Text style={styles.helper}>Sign in before accessing inspections or evidence.</Text><TextInput value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="Work email" placeholderTextColor="#8b99aa" style={styles.input}/><TextInput value={password} onChangeText={setPassword} secureTextEntry placeholder="Password" placeholderTextColor="#8b99aa" style={styles.input}/><Pressable style={styles.primary} onPress={signIn} disabled={busy}><Text style={styles.primaryText}>{busy ? 'Signing in…' : 'Sign in'}</Text></Pressable>{!configured ? <Text style={styles.error}>Mobile Supabase environment variables are not configured.</Text> : null}{error ? <Text style={styles.error}>{error}</Text> : null}</View></SafeAreaView> }
function Metric({ value, label }: { value: string; label: string }) { return <View style={styles.metric}><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View> }
function Checklist({ label, checked, onPress }: { label: string; checked: boolean; onPress: () => void }) { return <Pressable style={styles.check} onPress={onPress} accessibilityRole="checkbox" accessibilityState={{ checked }}><View style={[styles.checkDot, checked && styles.checkDotChecked]}/><Text style={styles.checkText}>{label}</Text></Pressable> }
const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: '#f7f9fc' }, center: { flex: 1, backgroundColor: '#f7f9fc', justifyContent: 'center', padding: 24 }, content: { padding: 20, paddingBottom: 40 }, header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }, eyebrow: { color: colors.blue, fontSize: 12, fontWeight: '800', letterSpacing: 1.5 }, title: { color: colors.ink, fontSize: 30, fontWeight: '800', marginTop: 4 }, subtitle: { color: colors.muted, marginTop: 4, fontSize: 14 }, avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' }, avatarText: { color: colors.white, fontWeight: '800' }, hero: { backgroundColor: colors.ink, borderRadius: 22, padding: 22, marginBottom: 14 }, heroLabel: { color: '#9dc4ff', fontWeight: '800', fontSize: 11, letterSpacing: 1.4 }, heroTitle: { color: colors.white, fontSize: 24, fontWeight: '800', marginTop: 8 }, heroText: { color: '#cad7e8', lineHeight: 21, marginTop: 8, marginBottom: 18 }, primary: { backgroundColor: '#3e8cff', paddingVertical: 14, borderRadius: 12, alignItems: 'center' }, primaryText: { color: colors.white, fontWeight: '800', fontSize: 16 }, metrics: { flexDirection: 'row', gap: 10, marginBottom: 22 }, metric: { flex: 1, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 14 }, metricValue: { color: colors.ink, fontSize: 20, fontWeight: '800' }, metricLabel: { color: colors.muted, fontSize: 12, marginTop: 3 }, sectionTitle: { color: colors.ink, fontSize: 17, fontWeight: '800', marginBottom: 10, marginTop: 6 }, card: { backgroundColor: colors.white, borderColor: colors.border, borderWidth: 1, borderRadius: 16, padding: 16, marginBottom: 18 }, authCard: { backgroundColor: colors.white, borderColor: colors.border, borderWidth: 1, borderRadius: 18, padding: 22 }, authTitle: { color: colors.ink, fontSize: 28, fontWeight: '800', marginVertical: 10 }, cardTitle: { color: colors.ink, fontSize: 16, fontWeight: '700', marginBottom: 10 }, input: { borderColor: colors.border, borderWidth: 1, borderRadius: 10, padding: 12, color: colors.ink, marginBottom: 10 }, row: { flexDirection: 'row', gap: 10 }, inputHalf: { flex: 1, borderColor: colors.border, borderWidth: 1, borderRadius: 10, padding: 12, color: colors.ink, marginBottom: 10 }, secondary: { backgroundColor: colors.pale, paddingVertical: 12, borderRadius: 10, alignItems: 'center' }, secondaryHalf: { flex: 1, backgroundColor: colors.pale, paddingVertical: 12, borderRadius: 10, alignItems: 'center' }, reportButton: { backgroundColor: '#dff7eb', paddingVertical: 12, borderRadius: 10, alignItems: 'center', marginTop: 10 }, reportButtonText: { color: colors.green, fontWeight: '800' }, agendaRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: colors.border }, agendaBadge: { backgroundColor: colors.pale, borderRadius: 8, paddingVertical: 5, paddingHorizontal: 7, marginRight: 10 }, agendaBadgeText: { color: colors.blue, fontSize: 10, fontWeight: '800' }, agendaBody: { flex: 1 }, agendaTitle: { color: colors.ink, fontWeight: '700' }, leadOption: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 11, marginBottom: 8 }, leadOptionSelected: { borderColor: colors.blue, backgroundColor: colors.pale }, leadName: { color: colors.ink, fontWeight: '800' }, leadCheck: { color: colors.blue, fontWeight: '800', fontSize: 12 }, albumRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, albumChip: { borderWidth: 1, borderColor: colors.border, borderRadius: 16, paddingVertical: 8, paddingHorizontal: 11 }, albumChipSelected: { backgroundColor: colors.blue, borderColor: colors.blue }, albumText: { color: colors.muted, fontWeight: '700', textTransform: 'capitalize' }, albumTextSelected: { color: colors.white }, secondaryText: { color: colors.blue, fontWeight: '800' }, helper: { color: colors.muted, fontSize: 12, lineHeight: 17, marginTop: 8 }, check: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9 }, checkDot: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: colors.green, marginRight: 10 }, checkDotChecked: { backgroundColor: colors.green }, checkText: { color: colors.ink, fontSize: 14 }, syncButton: { borderColor: colors.blue, borderWidth: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center', marginBottom: 14 }, syncText: { color: colors.blue, fontWeight: '800' }, notice: { color: colors.green, backgroundColor: '#e7f7ef', padding: 12, borderRadius: 10, marginBottom: 14 }, error: { color: colors.red, backgroundColor: '#fff1f0', padding: 12, borderRadius: 10, marginTop: 12 }, footer: { color: colors.muted, fontSize: 12, lineHeight: 17, textAlign: 'center' } })
