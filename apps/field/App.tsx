import { StatusBar } from 'expo-status-bar'
import * as ImagePicker from 'expo-image-picker'
import * as FileSystem from 'expo-file-system/legacy'
import * as Linking from 'expo-linking'
import * as Location from 'expo-location'
import * as SQLite from 'expo-sqlite'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient, SupabaseClient, User } from '@supabase/supabase-js'
import { useEffect, useMemo, useState } from 'react'
import { Alert, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'

const colors = { ink: '#102033', blue: '#1769e0', pale: '#eef5ff', green: '#138a5b', border: '#dbe4ef', muted: '#607086', white: '#ffffff', red: '#b42318' }
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? ''
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? ''
const supabase: SupabaseClient | null = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey, { auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false } }) : null
const db = SQLite.openDatabaseSync('roofos-field.db')

type Job = { id: string; address: string; status: string; updatedAt: string; photoCount: number }
type Photo = { id: string; jobId: string; localUri: string; mimeType: string; synced: number }
type LocationPoint = { latitude: number; longitude: number }

function ensureDatabase() {
  db.execSync(`CREATE TABLE IF NOT EXISTS field_jobs (id TEXT PRIMARY KEY NOT NULL, user_id TEXT NOT NULL, workspace_id TEXT, address TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'draft', updated_at TEXT NOT NULL, photo_count INTEGER NOT NULL DEFAULT 0); CREATE TABLE IF NOT EXISTS field_photos (id TEXT PRIMARY KEY NOT NULL, job_id TEXT NOT NULL, local_uri TEXT NOT NULL, mime_type TEXT NOT NULL, synced INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL); CREATE TABLE IF NOT EXISTS field_measurements (id TEXT PRIMARY KEY NOT NULL, job_id TEXT NOT NULL, eave_lf REAL, rafter_lf REAL, pitch REAL, soffit_width_ft REAL, fascia_width_ft REAL, roof_type TEXT, roof_squares REAL, gutter_lf REAL, latitude REAL, longitude REAL, synced INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL);`)
}
function newId() { return `${Date.now()}-${Math.random().toString(36).slice(2)}` }

export default function App() {
  const [user, setUser] = useState<User | null>(null)
  const [email, setEmail] = useState('')
  const [address, setAddress] = useState('')
  const [job, setJob] = useState<Job | null>(null)
  const [photos, setPhotos] = useState<Photo[]>([])
  const [location, setLocation] = useState<LocationPoint | null>(null)
  const [eaveLf, setEaveLf] = useState('')
  const [rafterLf, setRafterLf] = useState('')
  const [pitch, setPitch] = useState('')
  const [soffitWidthFt, setSoffitWidthFt] = useState('1')
  const [fasciaWidthFt, setFasciaWidthFt] = useState('0.5')
  const [roofType, setRoofType] = useState('hip')
  const [roofSquares, setRoofSquares] = useState('')
  const [gutterLf, setGutterLf] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [configured, setConfigured] = useState(Boolean(supabase))

  useEffect(() => {
    ensureDatabase()
    if (!supabase) return
    void supabase.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null))
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null))
    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!user) { setJob(null); setPhotos([]); return }
    try {
      const existing = db.getFirstSync<Job>('SELECT id,address,status,updated_at as updatedAt,photo_count as photoCount FROM field_jobs WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1', user.id)
      if (existing) { setJob(existing); setAddress(existing.address); setPhotos(db.getAllSync<Photo>('SELECT id,job_id as jobId,local_uri as localUri,mime_type as mimeType,synced FROM field_photos WHERE job_id = ? ORDER BY created_at DESC', existing.id)) }
    } catch { setNotice('Local field storage could not be opened.') }
  }, [user])

  async function sendMagicLink() {
    if (!supabase) { setNotice('Configure EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in the mobile build.') ; return }
    if (!email.includes('@')) { setNotice('Enter a valid email address.'); return }
    setBusy(true)
    const redirect = Linking.createURL('auth/callback')
    const { error } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: redirect } })
    setNotice(error ? error.message : 'Magic link sent. Open it on this phone to sign in.')
    setBusy(false)
  }

  function saveJob(nextAddress = address) {
    if (!user) return null
    const id = job?.id ?? newId(); const now = new Date().toISOString()
    db.runSync('INSERT OR REPLACE INTO field_jobs (id,user_id,workspace_id,address,status,updated_at,photo_count) VALUES (?, ?, ?, ?, ?, ?, ?)', id, user.id, null, nextAddress, 'draft', now, photos.length)
    const next = { id, address: nextAddress, status: 'draft', updatedAt: now, photoCount: photos.length }
    setJob(next); setAddress(nextAddress); return next
  }

  async function addPhoto() {
    if (!user) return
    const permission = await ImagePicker.requestCameraPermissionsAsync()
    if (!permission.granted) { Alert.alert('Camera permission needed', 'Allow camera access to capture inspection evidence.'); return }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 })
    if (result.canceled) return
    const currentJob = saveJob()
    if (!currentJob) return
    const added = result.assets.map((asset) => { const photo = { id: newId(), jobId: currentJob.id, localUri: asset.uri, mimeType: asset.mimeType || 'image/jpeg', synced: 0 }; db.runSync('INSERT INTO field_photos (id,job_id,local_uri,mime_type,synced,created_at) VALUES (?, ?, ?, ?, 0, ?)', photo.id, photo.jobId, photo.localUri, photo.mimeType, new Date().toISOString()); return photo })
    setPhotos((current) => [...added, ...current]); db.runSync('UPDATE field_jobs SET photo_count = ?, updated_at = ? WHERE id = ?', photos.length + added.length, new Date().toISOString(), currentJob.id); setNotice(`${added.length} photo saved locally. It will sync when you press Sync.`)
  }

  async function captureLocation() {
    const permission = await Location.requestForegroundPermissionsAsync()
    if (!permission.granted) { setNotice('Location permission is required to attach a field coordinate.'); return }
    const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }); setLocation({ latitude: current.coords.latitude, longitude: current.coords.longitude }); setNotice('GPS captured. It records where the inspector stood; confirm the property separately.')
  }

  function saveMeasurements() {
    const currentJob = saveJob(); const values = [Number(eaveLf), Number(rafterLf), Number(pitch), Number(soffitWidthFt), Number(fasciaWidthFt), Number(roofSquares), Number(gutterLf)]
    if (!currentJob || values.some((value) => !Number.isFinite(value) || value < 0) || Number(eaveLf) <= 0 || Number(rafterLf) <= 0 || Number(pitch) <= 0 || Number(soffitWidthFt) <= 0 || Number(fasciaWidthFt) <= 0) { setNotice('Enter valid eaves, rafter, pitch, soffit, fascia, squares, and gutter values.'); return }
    db.runSync('INSERT INTO field_measurements (id,job_id,eave_lf,rafter_lf,pitch,soffit_width_ft,fascia_width_ft,roof_type,roof_squares,gutter_lf,latitude,longitude,synced,created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)', newId(), currentJob.id, Number(eaveLf), Number(rafterLf), Number(pitch), Number(soffitWidthFt), Number(fasciaWidthFt), roofType, Number(roofSquares), Number(gutterLf), location?.latitude ?? null, location?.longitude ?? null, new Date().toISOString())
    setNotice('Technician measurements saved offline and marked for sync.')
  }

  async function syncJob() {
    if (!supabase || !user || !job) { setNotice('Sign in and create a job before syncing.'); return }
    setBusy(true); setNotice('Syncing evidence…')
    try {
      const { data: workspaceId, error: workspaceError } = await supabase.rpc('current_workspace_id'); if (workspaceError || !workspaceId) throw new Error('No active workspace is available for this account.')
      const { data: inspection, error: inspectionError } = await supabase.from('inspection_sessions').insert({ workspace_id: workspaceId, created_by: user.id, status: 'in_progress' }).select('id').single(); if (inspectionError || !inspection) throw new Error(inspectionError?.message ?? 'Could not create inspection session.')
      for (const photo of photos.filter((item) => !item.synced)) {
        const response = await fetch(photo.localUri); const blob = await response.blob(); const path = `${workspaceId}/${user.id}/${inspection.id}/${photo.id}.jpg`; const { error: uploadError } = await supabase.storage.from('inspection-photos').upload(path, blob, { contentType: photo.mimeType, upsert: false }); if (uploadError) throw new Error(uploadError.message)
        const { error: metadataError } = await supabase.from('inspection_photos').insert({ inspection_id: inspection.id, workspace_id: workspaceId, uploaded_by: user.id, object_path: path, mime_type: photo.mimeType, album: 'field', upload_status: 'uploaded' }); if (metadataError) throw new Error(metadataError.message)
        db.runSync('UPDATE field_photos SET synced = 1 WHERE id = ?', photo.id)
      }
      const measurement = db.getFirstSync<any>('SELECT * FROM field_measurements WHERE job_id = ? AND synced = 0 ORDER BY created_at DESC LIMIT 1', job.id)
      if (measurement) { const { error } = await supabase.from('inspection_measurements').insert({ workspace_id: workspaceId, inspection_id: inspection.id, source_type: 'manual', confidence: 'unverified', roof_area_sqft: measurement.roof_squares * 100, roof_squares: measurement.roof_squares, gutter_lf: measurement.gutter_lf, source_reference: 'field-app', notes: JSON.stringify({ eaveLf: measurement.eave_lf, rafterLf: measurement.rafter_lf, pitch: measurement.pitch, soffitWidthFt: measurement.soffit_width_ft, fasciaWidthFt: measurement.fascia_width_ft, roofType: measurement.roof_type, latitude: measurement.latitude, longitude: measurement.longitude }) }); if (error) throw new Error(error.message); db.runSync('UPDATE field_measurements SET synced = 1 WHERE id = ?', measurement.id) }
      db.runSync('UPDATE field_jobs SET workspace_id = ?, status = ?, updated_at = ? WHERE id = ?', workspaceId, 'synced', new Date().toISOString(), job.id); setJob((current) => current ? { ...current, status: 'synced' } : current); setPhotos((current) => current.map((photo) => ({ ...photo, synced: 1 }))); setNotice('Evidence synced to the workspace inspection. Review and report generation remain server-side.')
    } catch (error) { setNotice(error instanceof Error ? `Sync blocked: ${error.message}` : 'Sync failed. Local evidence is retained.') }
    setBusy(false)
  }

  if (!user) return <SafeAreaView style={styles.safe}><StatusBar style="dark"/><View style={styles.auth}><Text style={styles.eyebrow}>ROOF/OS FIELD</Text><Text style={styles.title}>Secure field sign-in</Text><Text style={styles.subtitle}>Your inspection photos and measurements stay tied to your account and workspace.</Text><TextInput value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="Email address" placeholderTextColor="#8b99aa" style={styles.input}/><Pressable style={styles.primary} onPress={() => void sendMagicLink()} disabled={busy}><Text style={styles.primaryText}>{busy ? 'Sending…' : 'Send magic link'}</Text></Pressable>{!configured && <Text style={styles.warning}>Mobile environment variables are not configured in this build.</Text>}{notice ? <Text style={styles.notice}>{notice}</Text> : null}</View></SafeAreaView>

  return <SafeAreaView style={styles.safe}><StatusBar style="dark"/><ScrollView contentContainerStyle={styles.content}><View style={styles.header}><View><Text style={styles.eyebrow}>ROOF/OS FIELD</Text><Text style={styles.title}>Inspection evidence</Text><Text style={styles.subtitle}>{user.email}</Text></View><Pressable onPress={() => void supabase?.auth.signOut()}><Text style={styles.secondaryText}>Sign out</Text></Pressable></View><View style={styles.hero}><Text style={styles.heroLabel}>OFFLINE-FIRST JOB</Text><Text style={styles.heroTitle}>{job ? 'Continue inspection' : 'Start an inspection'}</Text><Text style={styles.heroText}>Photos, location, and technician measurements are retained locally until an authenticated sync succeeds.</Text><Pressable style={styles.primary} onPress={() => void addPhoto()}><Text style={styles.primaryText}>Take roof photo</Text></Pressable></View><View style={styles.metrics}><Metric value={String(photos.length)} label="Local photos"/><Metric value={job?.status ?? 'New'} label="Job status"/><Metric value={String(photos.filter((photo) => !photo.synced).length)} label="To sync"/></View><Text style={styles.sectionTitle}>Property</Text><View style={styles.card}><TextInput value={address} onChangeText={setAddress} onBlur={() => saveJob()} placeholder="Job address" placeholderTextColor="#8b99aa" style={styles.input}/><View style={styles.row}><Pressable style={styles.secondaryHalf} onPress={() => void captureLocation()}><Text style={styles.secondaryText}>Capture GPS</Text></Pressable><Pressable style={styles.secondaryHalf} onPress={() => address.trim() && Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`)}><Text style={styles.secondaryText}>Directions</Text></Pressable></View><Text style={styles.helper}>{location ? `${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}` : 'Confirm the address; GPS alone is not property proof.'}</Text></View><Text style={styles.sectionTitle}>Field verification</Text><View style={styles.card}><Text style={styles.cardTitle}>Technician check set</Text><View style={styles.row}><Input value={eaveLf} set={setEaveLf} label="Eaves LF"/><Input value={rafterLf} set={setRafterLf} label="Rafter LF"/></View><View style={styles.row}><Input value={pitch} set={setPitch} label="Pitch / 12"/><Input value={roofSquares} set={setRoofSquares} label="Roof squares"/></View><View style={styles.row}><Input value={soffitWidthFt} set={setSoffitWidthFt} label="Soffit width ft"/><Input value={fasciaWidthFt} set={setFasciaWidthFt} label="Fascia width ft"/></View><View style={styles.row}><Input value={gutterLf} set={setGutterLf} label="Gutter LF"/><Pressable style={styles.selector} onPress={() => setRoofType(roofType === 'hip' ? 'gable' : roofType === 'gable' ? 'other' : 'hip')}><Text style={styles.selectorLabel}>Roof type</Text><Text style={styles.selectorValue}>{roofType}</Text></Pressable></View><Pressable style={styles.secondary} onPress={saveMeasurements}><Text style={styles.secondaryText}>Save measurements offline</Text></Pressable><Text style={styles.helper}>Soffit examples: 1, 1.5, or 2 ft. Fascia can be 0.5 ft for 6 inches. Your server-side report applies the slope multiplier and review gate.</Text></View><Pressable style={styles.sync} onPress={() => void syncJob()} disabled={busy}><Text style={styles.primaryText}>{busy ? 'Syncing…' : 'Sync job to ROOF/OS'}</Text></Pressable>{notice ? <Text style={styles.notice}>{notice}</Text> : null}<Text style={styles.footer}>No evidence is deleted when sync fails. Customer reports and approvals remain server-side.</Text></ScrollView></SafeAreaView>
}
function Input({ value, set, label }: { value: string; set: (value: string) => void; label: string }) { return <View style={styles.inputCell}><Text style={styles.inputLabel}>{label}</Text><TextInput value={value} onChangeText={set} keyboardType="decimal-pad" style={styles.smallInput}/></View> }
function Metric({ value, label }: { value: string; label: string }) { return <View style={styles.metric}><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View> }
const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: '#f7f9fc' }, auth: { flex: 1, justifyContent: 'center', padding: 24 }, content: { padding: 20, paddingBottom: 40 }, header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }, eyebrow: { color: colors.blue, fontSize: 12, fontWeight: '800', letterSpacing: 1.5 }, title: { color: colors.ink, fontSize: 28, fontWeight: '800', marginTop: 4 }, subtitle: { color: colors.muted, marginTop: 4, fontSize: 14 }, hero: { backgroundColor: colors.ink, borderRadius: 22, padding: 22, marginBottom: 14 }, heroLabel: { color: '#9dc4ff', fontWeight: '800', fontSize: 11, letterSpacing: 1.4 }, heroTitle: { color: colors.white, fontSize: 24, fontWeight: '800', marginTop: 8 }, heroText: { color: '#cad7e8', lineHeight: 21, marginTop: 8, marginBottom: 18 }, primary: { backgroundColor: '#3e8cff', paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: 14 }, sync: { backgroundColor: colors.green, paddingVertical: 15, borderRadius: 12, alignItems: 'center', marginTop: 4 }, primaryText: { color: colors.white, fontWeight: '800', fontSize: 16 }, metrics: { flexDirection: 'row', gap: 10, marginBottom: 22 }, metric: { flex: 1, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 14 }, metricValue: { color: colors.ink, fontSize: 18, fontWeight: '800' }, metricLabel: { color: colors.muted, fontSize: 12, marginTop: 3 }, sectionTitle: { color: colors.ink, fontSize: 17, fontWeight: '800', marginBottom: 10, marginTop: 6 }, card: { backgroundColor: colors.white, borderColor: colors.border, borderWidth: 1, borderRadius: 16, padding: 16, marginBottom: 18 }, cardTitle: { color: colors.ink, fontSize: 16, fontWeight: '700', marginBottom: 10 }, input: { borderColor: colors.border, borderWidth: 1, borderRadius: 10, padding: 12, color: colors.ink, marginTop: 12 }, row: { flexDirection: 'row', gap: 10, marginTop: 10 }, secondary: { backgroundColor: colors.pale, paddingVertical: 12, borderRadius: 10, alignItems: 'center', marginTop: 12 }, secondaryHalf: { flex: 1, backgroundColor: colors.pale, paddingVertical: 12, borderRadius: 10, alignItems: 'center' }, secondaryText: { color: colors.blue, fontWeight: '800' }, helper: { color: colors.muted, fontSize: 12, lineHeight: 17, marginTop: 8 }, inputCell: { flex: 1 }, inputLabel: { color: colors.muted, fontSize: 11, marginBottom: 4 }, smallInput: { borderColor: colors.border, borderWidth: 1, borderRadius: 10, padding: 10, color: colors.ink }, selector: { flex: 1, borderColor: colors.border, borderWidth: 1, borderRadius: 10, padding: 9 }, selectorLabel: { color: colors.muted, fontSize: 11 }, selectorValue: { color: colors.ink, fontWeight: '700', marginTop: 4 }, notice: { color: colors.green, backgroundColor: '#e7f7ef', padding: 12, borderRadius: 10, marginTop: 14 }, warning: { color: colors.red, backgroundColor: '#fff0ef', padding: 12, borderRadius: 10, marginTop: 14 }, footer: { color: colors.muted, fontSize: 12, lineHeight: 17, textAlign: 'center', marginTop: 16 } })
