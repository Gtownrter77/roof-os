import { StatusBar } from 'expo-status-bar'
import * as ImagePicker from 'expo-image-picker'
import * as Linking from 'expo-linking'
import * as Location from 'expo-location'
import NetInfo from '@react-native-community/netinfo'
import * as SecureStore from 'expo-secure-store'
import { createClient, type Session } from '@supabase/supabase-js'
import { useEffect, useRef, useState } from 'react'
import { File } from 'expo-file-system'
import {
  ActivityIndicator,
  Alert,
  AppState,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'

const colors = {
  ink: '#102033',
  blue: '#1769e0',
  pale: '#eef5ff',
  green: '#138a5b',
  border: '#dbe4ef',
  muted: '#607086',
  white: '#fff',
  red: '#b42318',
}

const defaultSupabaseUrl = 'https://xksumagfbegdlapwysps.supabase.co'
const defaultSupabaseAnonKey = 'sb_publishable_IY9l9DATPN0Qnsm_Vu15NA_kQC095hI'

const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  defaultSupabaseUrl
const supabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  defaultSupabaseAnonKey
const webAppUrl = process.env.EXPO_PUBLIC_WEB_APP_URL ?? 'https://roof-os-lemon.vercel.app'

import { db } from './src/localDb'
import RadarCinema from './src/RadarCinema'
import {
  activeAlertHeadline,
  draftNeedsSync,
  fieldCoach,
  formatGeocodedAddress,
  measurementNotes,
  suggestAlbum,
  suggestCaption,
} from './src/fieldCoach'

const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          storage: {
            getItem: SecureStore.getItemAsync,
            setItem: SecureStore.setItemAsync,
            removeItem: SecureStore.deleteItemAsync,
          },
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false,
        },
      })
    : null

type Draft = {
  id: number
  remoteId: string | null
  ownerUserId: string
  workspaceId: string | null
  clientId: string
  leadId: string | null
  address: string
  photoCount: number
  status: string
  updatedAt: string
  latitude: number | null
  longitude: number | null
  technicianName: string | null
  technicianLicense: string | null
  verifiedAt: string | null
  verificationNotes: string | null
  verificationSynced: number
}

type Lead = { id: string; name: string; address: string; status: string }
type AgendaItem = {
  id: string
  kind: 'appointment' | 'task'
  title: string
  startsAt: string | null
  location: string | null
  status: string
}
const photoAlbums = ['general', 'before', 'damage', 'measurements', 'completed'] as const
type PhotoAlbum = typeof photoAlbums[number]
type Point = { latitude: number; longitude: number }

const timestamp = () => new Date().toISOString()
const clientId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`

function ensureDatabase() {
  db.execSync(`CREATE TABLE IF NOT EXISTS inspection_drafts (id INTEGER PRIMARY KEY AUTOINCREMENT, remote_id TEXT, owner_user_id TEXT, workspace_id TEXT, client_id TEXT, lead_id TEXT, address TEXT NOT NULL DEFAULT '', photo_count INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'draft', latitude REAL, longitude REAL, technician_name TEXT, technician_license TEXT, verified_at TEXT, verification_notes TEXT, updated_at TEXT NOT NULL); CREATE TABLE IF NOT EXISTS inspection_measurements_local (id INTEGER PRIMARY KEY AUTOINCREMENT, draft_id INTEGER NOT NULL, client_id TEXT, roof_squares REAL NOT NULL, gutter_lf REAL NOT NULL, eave_lf REAL NOT NULL, rafter_lf REAL NOT NULL, pitch REAL NOT NULL, soffit_lf REAL NOT NULL, fascia_lf REAL NOT NULL, roof_type TEXT NOT NULL, latitude REAL, longitude REAL, captured_at TEXT NOT NULL, sync_status TEXT NOT NULL DEFAULT 'queued', retry_count INTEGER NOT NULL DEFAULT 0, next_retry_at TEXT, last_error TEXT); CREATE TABLE IF NOT EXISTS inspection_photo_queue (id INTEGER PRIMARY KEY AUTOINCREMENT, draft_id INTEGER NOT NULL, client_id TEXT, local_uri TEXT NOT NULL, album TEXT NOT NULL DEFAULT 'general', caption TEXT, mime_type TEXT NOT NULL DEFAULT 'image/jpeg', file_size_bytes INTEGER, width INTEGER, height INTEGER, captured_at TEXT NOT NULL, sync_status TEXT NOT NULL DEFAULT 'queued', remote_id TEXT, error TEXT, retry_count INTEGER NOT NULL DEFAULT 0, next_retry_at TEXT, last_error TEXT);`)
  for (const statement of ['ALTER TABLE inspection_drafts ADD COLUMN owner_user_id TEXT', 'ALTER TABLE inspection_drafts ADD COLUMN technician_name TEXT', 'ALTER TABLE inspection_drafts ADD COLUMN technician_license TEXT', 'ALTER TABLE inspection_drafts ADD COLUMN verified_at TEXT', 'ALTER TABLE inspection_drafts ADD COLUMN verification_notes TEXT', 'ALTER TABLE inspection_drafts ADD COLUMN lead_id TEXT', 'ALTER TABLE inspection_drafts ADD COLUMN workspace_id TEXT', 'ALTER TABLE inspection_drafts ADD COLUMN client_id TEXT', 'ALTER TABLE inspection_measurements_local ADD COLUMN client_id TEXT', 'ALTER TABLE inspection_measurements_local ADD COLUMN eave_lf REAL NOT NULL DEFAULT 0', 'ALTER TABLE inspection_measurements_local ADD COLUMN rafter_lf REAL NOT NULL DEFAULT 0', 'ALTER TABLE inspection_measurements_local ADD COLUMN pitch REAL NOT NULL DEFAULT 0', 'ALTER TABLE inspection_measurements_local ADD COLUMN soffit_lf REAL NOT NULL DEFAULT 0', 'ALTER TABLE inspection_measurements_local ADD COLUMN fascia_lf REAL NOT NULL DEFAULT 0', "ALTER TABLE inspection_measurements_local ADD COLUMN roof_type TEXT NOT NULL DEFAULT 'unknown'", 'ALTER TABLE inspection_measurements_local ADD COLUMN retry_count INTEGER NOT NULL DEFAULT 0', 'ALTER TABLE inspection_measurements_local ADD COLUMN next_retry_at TEXT', 'ALTER TABLE inspection_measurements_local ADD COLUMN last_error TEXT', 'ALTER TABLE inspection_photo_queue ADD COLUMN client_id TEXT', 'ALTER TABLE inspection_photo_queue ADD COLUMN caption TEXT', "ALTER TABLE inspection_photo_queue ADD COLUMN mime_type TEXT NOT NULL DEFAULT 'image/jpeg'", 'ALTER TABLE inspection_photo_queue ADD COLUMN file_size_bytes INTEGER', 'ALTER TABLE inspection_photo_queue ADD COLUMN width INTEGER', 'ALTER TABLE inspection_photo_queue ADD COLUMN height INTEGER', 'ALTER TABLE inspection_photo_queue ADD COLUMN album TEXT NOT NULL DEFAULT \'general\'', 'ALTER TABLE inspection_photo_queue ADD COLUMN retry_count INTEGER NOT NULL DEFAULT 0', 'ALTER TABLE inspection_photo_queue ADD COLUMN next_retry_at TEXT', 'ALTER TABLE inspection_photo_queue ADD COLUMN last_error TEXT', 'ALTER TABLE inspection_drafts ADD COLUMN verification_synced INTEGER NOT NULL DEFAULT 0']) {
    try { db.execSync(statement) } catch { /* Existing installs already have this column. */ }
  }
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [booting, setBooting] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authBusy, setAuthBusy] = useState(false)
  const [authNotice, setAuthNotice] = useState('')
  const [authMode, setAuthMode] = useState<'password' | 'code' | 'forgot'>('password')
  const [otpCode, setOtpCode] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const [showPassword, setShowPassword] = useState(false)
  const [showRadar, setShowRadar] = useState(false)

  const [address, setAddress] = useState('')
  const [photos, setPhotos] = useState(0)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [point, setPoint] = useState<Point | null>(null)
  const [squares, setSquares] = useState('')
  const [gutters, setGutters] = useState('')
  const [eave, setEave] = useState('')
  const [rafter, setRafter] = useState('')
  const [pitch, setPitch] = useState('')
  const [soffit, setSoffit] = useState('')
  const [fascia, setFascia] = useState('')
  const [roofType, setRoofType] = useState('')
  const [photoCaption, setPhotoCaption] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [syncing, setSyncing] = useState(false)
  const [leads, setLeads] = useState<Lead[]>([])
  const [agenda, setAgenda] = useState<AgendaItem[]>([])
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null)
  const [photoAlbum, setPhotoAlbum] = useState<PhotoAlbum>('general')
  const [technicianName, setTechnicianName] = useState('')
  const [technicianLicense, setTechnicianLicense] = useState('')
  const [verificationNotes, setVerificationNotes] = useState('')
  const [online, setOnline] = useState(true)
  const [stormHeadline, setStormHeadline] = useState('')
  const [pendingUploads, setPendingUploads] = useState(0)
  const draftRef = useRef<Draft | null>(null)
  const syncLock = useRef(false)

  useEffect(() => {
    ensureDatabase()
    SecureStore.getItemAsync('roof_os_field_email')
      .then((saved) => {
        if (saved && !email) setEmail(saved)
      })
      .catch(() => {})

    if (!supabase) {
      setError(
        'Mobile Supabase environment is not configured. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to the Expo/EAS build environment, then rebuild the app.'
      )
      setBooting(false)
      return
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setBooting(false)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next))
    return () => data.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!cooldown) return
    const timer = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000)
    return () => clearInterval(timer)
  }, [cooldown])

  useEffect(() => {
    if (session) {
      loadDrafts()
      void loadFieldData()
    }
  }, [session])

  useEffect(() => {
    if (!session) return
    const unsubscribe = NetInfo.addEventListener((state) => {
      const connected = Boolean(state.isConnected && state.isInternetReachable !== false)
      setOnline(connected)
      if (connected) void syncQueuedDrafts()
    })
    return () => unsubscribe()
  }, [session])

  useEffect(() => {
    if (!session) return
    const retry = () => { void syncQueuedDrafts() }
    const subscription = AppState.addEventListener('change', (state) => { if (state === 'active') retry() })
    const interval = setInterval(retry, 30_000)
    return () => { subscription.remove(); clearInterval(interval) }
  }, [session])

  function readLocalDrafts(): Draft[] {
    const userId = session?.user.id
    if (!userId) return []
    return db.getAllSync<Draft>('SELECT id, remote_id as remoteId, owner_user_id as ownerUserId, workspace_id as workspaceId, client_id as clientId, lead_id as leadId, address, photo_count as photoCount, status, updated_at as updatedAt, latitude, longitude, technician_name as technicianName, technician_license as technicianLicense, verified_at as verifiedAt, verification_notes as verificationNotes, verification_synced as verificationSynced FROM inspection_drafts WHERE owner_user_id = ? ORDER BY updated_at DESC', userId)
  }

  function loadDrafts(preferredId?: number, preserveSelection = false) {
    const rows = readLocalDrafts()
    setDrafts(rows)
    const activeId = draftRef.current?.id ?? (preserveSelection ? undefined : preferredId)
    const row = rows.find((item) => item.id === activeId) ?? rows[0]
    if (row) selectDraft(row)
  }

  function pendingRowCount(draftId: number) {
    const row = db.getFirstSync<{ n: number }>(
      `SELECT (
        (SELECT COUNT(*) FROM inspection_measurements_local WHERE draft_id = ? AND sync_status IN ('queued', 'retrying'))
        + (SELECT COUNT(*) FROM inspection_photo_queue WHERE draft_id = ? AND sync_status IN ('queued', 'retrying'))
      ) AS n`,
      draftId,
      draftId,
    )
    return Number(row?.n ?? 0)
  }

  async function syncQueuedDrafts() {
    if (!session || !online || syncLock.current) return
    for (const queuedDraft of readLocalDrafts()) {
      const pendingRows = pendingRowCount(queuedDraft.id)
      if (draftRef.current?.id === queuedDraft.id) setPendingUploads(pendingRows)
      if (!draftNeedsSync({
        remoteId: queuedDraft.remoteId,
        verifiedAt: queuedDraft.verifiedAt,
        technicianName: queuedDraft.technicianName,
        verificationSynced: queuedDraft.verificationSynced === 1,
        pendingRows,
      })) continue
      await syncNow(queuedDraft)
    }
  }

  function selectDraft(row: Draft) {
    draftRef.current = row; setDraft(row); setSelectedLeadId(row.leadId); setAddress(row.address); setPhotos(row.photoCount); setTechnicianName(row.technicianName ?? ''); setTechnicianLicense(row.technicianLicense ?? ''); setVerificationNotes(row.verificationNotes ?? ''); if (row.latitude !== null && row.longitude !== null) setPoint({ latitude: row.latitude, longitude: row.longitude }); else setPoint(null)
    const measurements = db.getAllSync<{ roof_squares: number; gutter_lf: number; eave_lf: number; rafter_lf: number; pitch: number; soffit_lf: number; fascia_lf: number; roof_type: string }>('SELECT roof_squares, gutter_lf, eave_lf, rafter_lf, pitch, soffit_lf, fascia_lf, roof_type FROM inspection_measurements_local WHERE draft_id = ? ORDER BY captured_at DESC LIMIT 1', row.id)
    const latest = measurements[0]
    if (latest) { setSquares(String(latest.roof_squares)); setGutters(String(latest.gutter_lf)); setEave(String(latest.eave_lf)); setRafter(String(latest.rafter_lf)); setPitch(String(latest.pitch)); setSoffit(String(latest.soffit_lf)); setFascia(String(latest.fascia_lf)); setRoofType(latest.roof_type) }
    else { setSquares(''); setGutters(''); setEave(''); setRafter(''); setPitch(''); setSoffit(''); setFascia(''); setRoofType('') }
    setPendingUploads(pendingRowCount(row.id))
    if (!row.technicianName) {
      void SecureStore.getItemAsync('roof_os_field_tech_name').then((saved) => {
        if (saved && draftRef.current?.id === row.id && !draftRef.current.technicianName) setTechnicianName(saved)
      })
    }
  }

  function startNewInspection() {
    draftRef.current = null; setDraft(null); setAddress(''); setPhotos(0); setSelectedLeadId(null); setPoint(null); setSquares(''); setGutters(''); setEave(''); setRafter(''); setPitch(''); setSoffit(''); setFascia(''); setRoofType(''); setPhotoCaption(''); setTechnicianName(''); setTechnicianLicense(''); setVerificationNotes(''); setNotice('New offline inspection ready. Choose a job or capture evidence.');
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

  function saveDraft(
    nextAddress = address,
    nextPhotos = photos,
    nextPoint = point,
    nextLeadId = selectedLeadId
  ): number | null {
    try {
      const now = timestamp()
      if (draft) {
        db.runSync(
          'UPDATE inspection_drafts SET lead_id = ?, address = ?, photo_count = ?, latitude = ?, longitude = ?, updated_at = ? WHERE id = ?',
          nextLeadId,
          nextAddress,
          nextPhotos,
          nextPoint?.latitude ?? null,
          nextPoint?.longitude ?? null,
          now,
          draft.id
        )
        const nextDraft = {
          ...draft,
          leadId: nextLeadId,
          address: nextAddress,
          photoCount: nextPhotos,
          latitude: nextPoint?.latitude ?? null,
          longitude: nextPoint?.longitude ?? null,
          updatedAt: now,
        }
        draftRef.current = nextDraft
        setDraft(nextDraft)
        setDrafts((current) => [nextDraft, ...current.filter((item) => item.id !== nextDraft.id)])
        return draft.id
      }
      if (!session?.user.id) throw new Error('An authenticated user is required for local drafts.')
      const createdClientId = clientId('inspection')
      const result = db.runSync(
        'INSERT INTO inspection_drafts (owner_user_id, workspace_id, client_id, lead_id, address, photo_count, status, latitude, longitude, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        session.user.id,
        null,
        createdClientId,
        nextLeadId,
        nextAddress,
        nextPhotos,
        'draft',
        nextPoint?.latitude ?? null,
        nextPoint?.longitude ?? null,
        now
      )
      const created = {
        id: result.lastInsertRowId,
        remoteId: null,
        ownerUserId: session.user.id,
        workspaceId: null,
        clientId: createdClientId,
        leadId: nextLeadId,
        address: nextAddress,
        photoCount: nextPhotos,
        status: 'draft',
        latitude: nextPoint?.latitude ?? null,
        longitude: nextPoint?.longitude ?? null,
        technicianName: null,
        technicianLicense: null,
        verifiedAt: null,
        verificationNotes: null,
        verificationSynced: 0,
        updatedAt: now,
      }
      draftRef.current = created
      setDraft(created)
      setDrafts((current) => [created, ...current])
      return created.id
    } catch {
      setError('Could not save the local draft. Keep the app open and try again.')
      return null
    }
  }

  async function signIn() {
    if (!supabase) {
      setError(
        'Mobile Supabase environment is not configured. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to the Expo/EAS build environment, then rebuild the app.'
      )
      return
    }
    const cleanEmail = email.trim().toLowerCase()
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setError('Enter a valid work email address.')
      return
    }
    if (!password) {
      setError('Enter your password, or sign in using a 6-digit email code.')
      return
    }
    setAuthBusy(true)
    setError('')
    setAuthNotice('')
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({ email: cleanEmail, password })
      if (authError) {
        if (/invalid login credentials/i.test(authError.message)) {
          setError('Incorrect email or password. Tap "Forgot password?" below or sign in using a 6-digit email code.')
        } else {
          setError(authError.message)
        }
      } else {
        void SecureStore.setItemAsync('roof_os_field_email', cleanEmail)
      }
    } catch {
      setError('Sign-in request failed. Check your network or try web sign-in.')
    } finally {
      setAuthBusy(false)
    }
  }

  async function sendOtpCode() {
    if (!supabase) {
      setError('Mobile Supabase environment is not configured.')
      return
    }
    const cleanEmail = email.trim().toLowerCase()
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setError('Enter your work email address first.')
      return
    }
    setAuthBusy(true)
    setError('')
    setAuthNotice('')
    try {
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: cleanEmail,
      })
      if (otpError) {
        setError(otpError.message)
      } else {
        setOtpSent(true)
        setCooldown(60)
        setAuthNotice(`A 6-digit sign-in code was sent to ${cleanEmail}. Check your inbox.`)
        void SecureStore.setItemAsync('roof_os_field_email', cleanEmail)
      }
    } catch {
      setError('Could not send code. Check connection or try password.')
    } finally {
      setAuthBusy(false)
    }
  }

  async function verifyOtpCode() {
    if (!supabase) {
      setError('Mobile Supabase environment is not configured.')
      return
    }
    const cleanEmail = email.trim().toLowerCase()
    const cleanCode = otpCode.trim()
    if (!/^\d{6}$/.test(cleanCode)) {
      setError('Enter the exact 6-digit code sent to your email.')
      return
    }
    setAuthBusy(true)
    setError('')
    setAuthNotice('')
    try {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email: cleanEmail,
        token: cleanCode,
        type: 'email',
      })
      if (verifyError) {
        setError(
          /expired|invalid/i.test(verifyError.message)
            ? 'That code was not accepted or has expired. Tap resend for a fresh code.'
            : verifyError.message
        )
      } else {
        void SecureStore.setItemAsync('roof_os_field_email', cleanEmail)
      }
    } catch {
      setError('Could not verify code. Please try again.')
    } finally {
      setAuthBusy(false)
    }
  }

  async function sendPasswordReset() {
    if (!supabase) {
      setError('Mobile Supabase environment is not configured.')
      return
    }
    const cleanEmail = email.trim().toLowerCase()
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setError('Enter your work email above to receive a reset link.')
      return
    }
    setAuthBusy(true)
    setError('')
    setAuthNotice('')
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: `${webAppUrl}/auth/reset`,
      })
      if (resetError) {
        setError(resetError.message)
      } else {
        setAuthNotice(`Password reset instructions sent to ${cleanEmail}. Check your inbox, or tap below to reset on the web.`)
        void SecureStore.setItemAsync('roof_os_field_email', cleanEmail)
      }
    } catch {
      setError('Could not send reset email. Check network or reset on web.')
    } finally {
      setAuthBusy(false)
    }
  }

  async function capturePhoto() {
    const permission = await ImagePicker.requestCameraPermissionsAsync()
    if (!permission.granted) { Alert.alert('Camera permission needed', 'Allow camera access to capture inspection evidence.'); return }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 })
    if (result.canceled) return
    const count = photos + result.assets.length; const draftId = saveDraft(address, count, point, selectedLeadId)
    if (!draftId) return
    const capturedAt = timestamp()
    result.assets.forEach((asset) => db.runSync('INSERT INTO inspection_photo_queue (draft_id, client_id, local_uri, album, caption, mime_type, file_size_bytes, width, height, captured_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', draftId, clientId('photo'), asset.uri, photoAlbum, photoCaption.trim() || null, asset.mimeType ?? 'image/jpeg', asset.fileSize ?? null, asset.width ?? null, asset.height ?? null, capturedAt))
    setPhotos(count); setPhotoCaption(''); setNotice(`${result.assets.length} photo${result.assets.length === 1 ? '' : 's'} saved to the offline upload queue.`)
    if (session) void syncNow()
  }

  async function captureLocation() {
    const permission = await Location.requestForegroundPermissionsAsync()
    if (!permission.granted) {
      setError('Location permission is required to attach a property coordinate.')
      return
    }
    const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
    const next = { latitude: current.coords.latitude, longitude: current.coords.longitude }
    setPoint(next)
    let nextAddress = address
    try {
      const places = await Location.reverseGeocodeAsync(next)
      const formatted = formatGeocodedAddress(places[0])
      if (formatted && !address.trim()) {
        nextAddress = formatted
        setAddress(formatted)
      }
    } catch {
      // GPS is still useful if the device cannot resolve a street address.
    }
    saveDraft(nextAddress, photos, next)
    let alertLine = ''
    if (online) {
      const headline = await activeAlertHeadline(next.latitude, next.longitude)
      setStormHeadline(headline ?? '')
      if (headline) alertLine = ` Active alert: ${headline}.`
    }
    setNotice(
      `Location captured at ${next.latitude.toFixed(5)}, ${next.longitude.toFixed(5)}.${nextAddress.trim() ? ` Address set to ${nextAddress}.` : ''} Confirm it before using it for a claim.${alertLine}`
    )
  }

  function saveMeasurements() {
    const values = { roof: Number(squares), gutter: Number(gutters), eave: Number(eave), rafter: Number(rafter), pitch: Number(pitch), soffit: Number(soffit), fascia: Number(fascia) }
    if (!Object.values(values).every(Number.isFinite) || values.roof <= 0 || values.gutter < 0 || values.eave <= 0 || values.rafter <= 0 || values.pitch < 0 || values.pitch > 24 || values.soffit < 0 || values.fascia < 0 || !roofType.trim()) { setError('Enter valid roof, eave, rafter, pitch, soffit, fascia, and roof-type inputs.'); return }
    const draftId = saveDraft(); if (!draftId) return
    db.runSync('INSERT INTO inspection_measurements_local (draft_id, client_id, roof_squares, gutter_lf, eave_lf, rafter_lf, pitch, soffit_lf, fascia_lf, roof_type, latitude, longitude, captured_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', draftId, clientId('measurement'), values.roof, values.gutter, values.eave, values.rafter, values.pitch, values.soffit, values.fascia, roofType.trim(), point?.latitude ?? null, point?.longitude ?? null, timestamp())
    setNotice('Measurements saved locally as manual, unverified inputs.'); if (session) void syncNow()
  }

  function saveTechnicianVerification() {
    const current = saveDraft();
    if (!current) return
    if (!technicianName.trim()) { setError('Enter the technician name before recording verification.'); return }
    if (!photos || !squares.trim() || !gutters.trim() || !eave.trim() || !rafter.trim() || !pitch.trim() || !soffit.trim() || !fascia.trim() || !roofType.trim()) { setError('Add photos and the complete manual measurement set before recording verification.'); return }
    const verifiedAt = timestamp()
    db.runSync('UPDATE inspection_drafts SET technician_name = ?, technician_license = ?, verified_at = ?, verification_notes = ?, verification_synced = 0, updated_at = ? WHERE id = ?', technicianName.trim(), technicianLicense.trim() || null, verifiedAt, verificationNotes.trim() || null, verifiedAt, current)
    const next = { ...draftRef.current!, technicianName: technicianName.trim(), technicianLicense: technicianLicense.trim() || null, verifiedAt, verificationNotes: verificationNotes.trim() || null, verificationSynced: 0, updatedAt: verifiedAt }
    void SecureStore.setItemAsync('roof_os_field_tech_name', technicianName.trim())
    draftRef.current = next; setDraft(next); setDrafts((items) => items.map((item) => item.id === next.id ? next : item)); setNotice('Technician verification saved locally. Manager approval and signature remain separate gates.'); if (online) void syncNow(next)
  }

  async function syncNow(draftToSync = draftRef.current ?? draft) {
    if (!supabase || !session || !draftToSync || syncLock.current || !online) { if (!online) setNotice('Offline. Local work is saved and will retry when connectivity returns.'); return }
    const activeDraftId = draftRef.current?.id
    syncLock.current = true; setSyncing(true); setError('')
    try {
      const { data: workspaceId, error: workspaceError } = await supabase.rpc('current_workspace_id')
      if (workspaceError || !workspaceId) throw new Error('No workspace is available for this account.')
      if (draftToSync.ownerUserId !== session.user.id) throw new Error('This draft belongs to a different signed-in user.')
      if (draftToSync.workspaceId && draftToSync.workspaceId !== workspaceId) throw new Error('This draft belongs to a different workspace. Switch workspace before syncing.')
      let remoteId = draftToSync.remoteId
      if (!remoteId) {
        const { data, error: insertError } = await supabase.from('inspection_sessions').upsert({ workspace_id: workspaceId, lead_id: draftToSync.leadId, client_id: draftToSync.clientId, created_by: session.user.id, status: 'draft', client_version: 'field-0.4.0' }, { onConflict: 'workspace_id,client_id' }).select('id').single()
        if (insertError) throw insertError
        remoteId = data.id; db.runSync('UPDATE inspection_drafts SET remote_id = ?, workspace_id = ? WHERE id = ?', remoteId, workspaceId, draftToSync.id); const syncedDraft = { ...draftToSync, remoteId, workspaceId }; if (activeDraftId === draftToSync.id) { draftRef.current = syncedDraft; setDraft(syncedDraft) }
      }
      if (draftToSync.verifiedAt && draftToSync.technicianName) {
        const { error: verificationError } = await supabase.from('inspection_verifications').upsert({ workspace_id: workspaceId, inspection_id: remoteId, technician_name: draftToSync.technicianName, technician_license: draftToSync.technicianLicense, verified_at: draftToSync.verifiedAt, notes: draftToSync.verificationNotes?.trim() || null, created_by: session.user.id }, { onConflict: 'workspace_id,inspection_id' })
        if (verificationError) throw verificationError
        db.runSync('UPDATE inspection_drafts SET verification_synced = 1 WHERE id = ?', draftToSync.id)
        if (activeDraftId === draftToSync.id && draftRef.current) {
          draftRef.current = { ...draftRef.current, verificationSynced: 1 }
          setDraft(draftRef.current)
        }
      }
      const now = new Date().toISOString()
      const measurements = db.getAllSync<{ id: number; client_id: string; roof_squares: number; gutter_lf: number; eave_lf: number; rafter_lf: number; pitch: number; soffit_lf: number; fascia_lf: number; roof_type: string; latitude: number | null; longitude: number | null; captured_at: string }>('SELECT id, client_id, roof_squares, gutter_lf, eave_lf, rafter_lf, pitch, soffit_lf, fascia_lf, roof_type, latitude, longitude, captured_at FROM inspection_measurements_local WHERE draft_id = ? AND sync_status IN (?, ?) AND (next_retry_at IS NULL OR next_retry_at <= ?)', draftToSync.id, 'queued', 'retrying', now)
      for (const measurement of measurements) {
        const { error } = await supabase.from('inspection_measurements').upsert({ workspace_id: workspaceId, inspection_id: remoteId, client_id: measurement.client_id, source_type: 'manual', confidence: 'unverified', roof_squares: measurement.roof_squares, gutter_lf: measurement.gutter_lf, eave_lf: measurement.eave_lf, rafter_lf: measurement.rafter_lf, pitch: `${measurement.pitch}/12`, soffit_lf: measurement.soffit_lf, fascia_lf: measurement.fascia_lf, roof_type: measurement.roof_type, latitude: measurement.latitude, longitude: measurement.longitude, source_reference: 'field-mobile-manual', captured_at: measurement.captured_at, created_by: session.user.id }, { onConflict: 'workspace_id,client_id' })
        if (error) throw error
        db.runSync('UPDATE inspection_measurements_local SET sync_status = ?, last_error = NULL, next_retry_at = NULL WHERE id = ?', 'synced', measurement.id)
      }
      const queued = db.getAllSync<{ id: number; client_id: string; local_uri: string; album: string; caption: string | null; mime_type: string; file_size_bytes: number | null; width: number | null; height: number | null; captured_at: string }>('SELECT id, client_id, local_uri, album, caption, mime_type, file_size_bytes, width, height, captured_at FROM inspection_photo_queue WHERE draft_id = ? AND sync_status IN (?, ?) AND (next_retry_at IS NULL OR next_retry_at <= ?)', draftToSync.id, 'queued', 'retrying', now)
      for (const photo of queued) {
        const extension = photo.mime_type.split('/')[1]?.replace('jpeg', 'jpg') || 'bin'; const objectPath = `${workspaceId}/${session.user.id}/${remoteId}/${photo.client_id}.${extension}`
        let body: Blob | ArrayBuffer
        try {
          body = await new File(photo.local_uri).arrayBuffer()
        } catch {
          const response = await fetch(photo.local_uri); body = await response.blob()
        }
        const { error: uploadError } = await supabase.storage.from('inspection-photos').upload(objectPath, body, { contentType: photo.mime_type, upsert: false })
        if (uploadError && !/already exists|duplicate/i.test(uploadError.message)) throw uploadError
        const { data, error: recordError } = await supabase.from('inspection_photos').upsert({ inspection_id: remoteId, client_id: photo.client_id, workspace_id: workspaceId, uploaded_by: session.user.id, bucket_id: 'inspection-photos', object_path: objectPath, album: photo.album, caption: photo.caption, mime_type: photo.mime_type, file_size_bytes: photo.file_size_bytes, width: photo.width, height: photo.height, captured_at: photo.captured_at, upload_status: 'uploaded' }, { onConflict: 'workspace_id,client_id' }).select('id').single()
        if (recordError) throw recordError
        db.runSync('UPDATE inspection_photo_queue SET sync_status = ?, remote_id = ?, last_error = NULL, next_retry_at = NULL WHERE id = ?', 'synced', data.id, photo.id)
      }
      setNotice('Synced securely to the workspace. Evidence and estimates remain review-gated.')
    } catch (syncError) {
      const message = syncError instanceof Error ? syncError.message : 'Unknown sync error'
      const retryRows = db.getAllSync<{ retry_count: number }>('SELECT retry_count FROM inspection_measurements_local WHERE draft_id = ? AND sync_status IN (?, ?)', draftToSync.id, 'queued', 'retrying')
      const photoRetryRows = db.getAllSync<{ retry_count: number }>('SELECT retry_count FROM inspection_photo_queue WHERE draft_id = ? AND sync_status IN (?, ?)', draftToSync.id, 'queued', 'retrying')
      const retryCount = Math.max(0, ...retryRows.map((row) => row.retry_count), ...photoRetryRows.map((row) => row.retry_count))
      const retryDelayMs = Math.min(15 * 60_000, 5_000 * (2 ** retryCount))
      const retryAt = new Date(Date.now() + retryDelayMs).toISOString()
      db.runSync('UPDATE inspection_measurements_local SET sync_status = ?, retry_count = retry_count + 1, next_retry_at = ?, last_error = ? WHERE draft_id = ? AND sync_status IN (?, ?)', 'retrying', retryAt, message, draftToSync.id, 'queued', 'retrying')
      db.runSync('UPDATE inspection_photo_queue SET sync_status = ?, retry_count = retry_count + 1, next_retry_at = ?, last_error = ?, error = ? WHERE draft_id = ? AND sync_status IN (?, ?)', 'retrying', retryAt, message, message, draftToSync.id, 'queued', 'retrying')
      setError(`Sync paused: ${message}. Automatic retry scheduled.`)
    }
    finally { syncLock.current = false; setSyncing(false); loadDrafts(undefined, true) }
  }

  const coachItems = fieldCoach({
    address,
    hasPoint: Boolean(point),
    photoCount: photos,
    hasMeasurements: Boolean(squares.trim() && eave.trim() && roofType.trim()),
    notes: verificationNotes,
    synced: Boolean(draft?.remoteId),
    pendingUploads,
  })
  const measureHints = measurementNotes({
    squares: Number(squares),
    gutter: Number(gutters),
    eave: Number(eave),
    pitch: Number(pitch),
  })
  const captionAlbum = suggestAlbum(photoCaption)

  if (booting) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color={colors.blue} />
      </SafeAreaView>
    )
  }

  if (!session) {
    return (
      <AuthScreen
        email={email}
        password={password}
        setEmail={setEmail}
        setPassword={setPassword}
        signIn={signIn}
        sendOtpCode={sendOtpCode}
        verifyOtpCode={verifyOtpCode}
        sendPasswordReset={sendPasswordReset}
        busy={authBusy}
        error={error}
        notice={authNotice}
        configured={Boolean(supabase)}
        authMode={authMode}
        setAuthMode={(mode) => {
          setAuthMode(mode)
          setError('')
          setAuthNotice('')
        }}
        otpCode={otpCode}
        setOtpCode={setOtpCode}
        otpSent={otpSent}
        setOtpSent={setOtpSent}
        cooldown={cooldown}
        showPassword={showPassword}
        setShowPassword={setShowPassword}
        webAppUrl={webAppUrl}
      />
    )
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <RadarCinema visible={showRadar} onClose={() => setShowRadar(false)} webAppUrl={webAppUrl} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>ROOF/OS FIELD</Text>
            <Text style={styles.title}>Field inspection</Text>
            <Text style={styles.subtitle}>{online ? 'Connected to workspace' : 'Working offline'}</Text>
          </View>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{(session.user.email?.[0] ?? 'R').toUpperCase()}</Text>
          </View>
        </View>

        <View style={styles.hero}>
          <Text style={styles.heroLabel}>UPGRADES ONLY · NO REGRESSIONS</Text>
          <Text style={styles.heroTitle}>Inspect the property</Text>
          <Text style={styles.heroText}>
            Capture photos on-site. Offline evidence queues locally and syncs automatically when signal returns.
          </Text>
          <Pressable style={styles.primary} onPress={capturePhoto}>
            <Text style={styles.primaryText}>Capture inspection photo</Text>
          </Pressable>
          <Pressable style={[styles.secondary, { marginTop: 10 }]} onPress={() => setShowRadar(true)}>
            <Text style={styles.secondaryText}>Radar cinema · watch storms</Text>
          </Pressable>
          {stormHeadline ? (
            <Pressable style={[styles.secondary, { marginTop: 10 }]} onPress={() => setShowRadar(true)}>
              <Text style={styles.secondaryText}>Alert · {stormHeadline}. Open radar</Text>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.metrics}>
          <Metric value={String(photos)} label="Queued photos" />
          <Metric value={draft ? 'Saved' : 'Draft'} label="Local inspection" />
          <Metric value={online ? 'Live' : 'Offline'} label="Sync state" />
        </View>

        <Text style={styles.sectionTitle}>Inspections</Text>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Continue an offline draft</Text>
          <Pressable style={styles.secondary} onPress={startNewInspection}>
            <Text style={styles.secondaryText}>Start new inspection</Text>
          </Pressable>
          {drafts.map((item) => (
            <Pressable
              key={item.id}
              style={[styles.leadOption, draft?.id === item.id && styles.leadOptionSelected]}
              onPress={() => selectDraft(item)}
            >
              <View>
                <Text style={styles.leadName}>{item.address || 'Unassigned inspection'}</Text>
                <Text style={styles.helper}>
                  {item.photoCount} photo{item.photoCount === 1 ? '' : 's'} ·{' '}
                  {item.verifiedAt ? 'Technician verified' : 'Draft'} · {item.remoteId ? 'synced' : 'queued'}
                </Text>
              </View>
              <Text style={styles.leadCheck}>{draft?.id === item.id ? 'Open' : 'Use'}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Today</Text>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Next appointments and tasks</Text>
          {agenda.length ? (
            agenda.map((item) => (
              <Pressable
                key={`${item.kind}-${item.id}`}
                style={styles.agendaRow}
                onPress={() => {
                  if (!item.location) {
                    setNotice('That item has no address. Pick a lead or type the job address.')
                    return
                  }
                  setAddress(item.location)
                  saveDraft(item.location, photos, point, selectedLeadId)
                  setNotice(`Address set from ${item.kind}. Confirm it on site.`)
                }}
              >
                <View style={styles.agendaBadge}>
                  <Text style={styles.agendaBadgeText}>{item.kind === 'appointment' ? 'APPT' : 'TASK'}</Text>
                </View>
                <View style={styles.agendaBody}>
                  <Text style={styles.agendaTitle}>{item.title}</Text>
                  <Text style={styles.helper}>
                    {item.startsAt ? new Date(item.startsAt).toLocaleString() : 'No due date'}
                    {item.location ? ` · ${item.location}` : ''}
                  </Text>
                </View>
              </Pressable>
            ))
          ) : (
            <Text style={styles.helper}>No upcoming appointments or open tasks were found.</Text>
          )}
        </View>

        <Text style={styles.sectionTitle}>Choose a job</Text>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Attach this inspection to a lead</Text>
          {leads.length ? (
            leads.map((lead) => (
              <Pressable
                key={lead.id}
                style={[styles.leadOption, selectedLeadId === lead.id && styles.leadOptionSelected]}
                onPress={() => {
                  setSelectedLeadId(lead.id)
                  setAddress(lead.address)
                  saveDraft(lead.address, photos, point, lead.id)
                }}
              >
                <View>
                  <Text style={styles.leadName}>{lead.name}</Text>
                  <Text style={styles.helper}>
                    {lead.address} · {lead.status}
                  </Text>
                </View>
                <Text style={styles.leadCheck}>{selectedLeadId === lead.id ? 'Selected' : 'Use job'}</Text>
              </Pressable>
            ))
          ) : (
            <Text style={styles.helper}>No leads were found for this workspace. You can still create an unassigned inspection.</Text>
          )}
        </View>

        <Text style={styles.sectionTitle}>Property location</Text>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Confirm address and GPS</Text>
          <TextInput
            value={address}
            onChangeText={setAddress}
            onBlur={() => saveDraft()}
            placeholder="Enter job address"
            placeholderTextColor="#8b99aa"
            style={styles.input}
            accessibilityLabel="Job address"
          />
          <View style={styles.row}>
            <Pressable style={styles.secondaryHalf} onPress={captureLocation}>
              <Text style={styles.secondaryText}>Capture GPS</Text>
            </Pressable>
            <Pressable
              style={styles.secondaryHalf}
              onPress={() =>
                address.trim()
                  ? Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`)
                  : setError('Enter a job address first.')
              }
            >
              <Text style={styles.secondaryText}>Open directions</Text>
            </Pressable>
          </View>
          <Text style={styles.helper}>
            {point
              ? `GPS captured: ${point.latitude.toFixed(5)}, ${point.longitude.toFixed(5)}`
              : 'GPS shows where the inspector stood; it does not prove ownership or damage.'}
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Photo album</Text>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>New photos will be saved under</Text>
          <View style={styles.albumRow}>
            {photoAlbums.map((album) => (
              <Pressable
                key={album}
                style={[styles.albumChip, photoAlbum === album && styles.albumChipSelected]}
                onPress={() => setPhotoAlbum(album)}
              >
                <Text style={[styles.albumText, photoAlbum === album && styles.albumTextSelected]}>{album}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.helper}>Albums keep evidence organized for office review and future search.</Text>
          <TextInput value={photoCaption} onChangeText={setPhotoCaption} placeholder="Photo caption (optional)" placeholderTextColor="#8b99aa" style={styles.input} accessibilityLabel="Photo caption" />
          <Pressable style={styles.secondary} onPress={() => setPhotoCaption(suggestCaption(photoAlbum))}>
            <Text style={styles.secondaryText}>Suggest caption for {photoAlbum}</Text>
          </Pressable>
          {captionAlbum && captionAlbum !== photoAlbum ? (
            <Pressable style={[styles.secondary, { marginTop: 8 }]} onPress={() => setPhotoAlbum(captionAlbum)}>
              <Text style={styles.secondaryText}>Caption fits the {captionAlbum} album. Use it.</Text>
            </Pressable>
          ) : null}
        </View>

        <Text style={styles.sectionTitle}>Manual measurement review</Text>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Draft inputs — unverified</Text>
          <View style={styles.row}>
            <TextInput value={squares} onChangeText={setSquares} keyboardType="decimal-pad" placeholder="Roof squares" placeholderTextColor="#8b99aa" style={styles.inputHalf} accessibilityLabel="Roof squares" />
            <TextInput value={gutters} onChangeText={setGutters} keyboardType="decimal-pad" placeholder="Gutter LF" placeholderTextColor="#8b99aa" style={styles.inputHalf} accessibilityLabel="Gutter linear feet" />
          </View>
          <View style={styles.row}>
            <TextInput value={eave} onChangeText={setEave} keyboardType="decimal-pad" placeholder="Eave LF" placeholderTextColor="#8b99aa" style={styles.inputHalf} accessibilityLabel="Eave linear feet" />
            <TextInput value={rafter} onChangeText={setRafter} keyboardType="decimal-pad" placeholder="Rafter LF" placeholderTextColor="#8b99aa" style={styles.inputHalf} accessibilityLabel="Rafter linear feet" />
          </View>
          <View style={styles.row}>
            <TextInput value={pitch} onChangeText={setPitch} keyboardType="decimal-pad" placeholder="Pitch (x/12)" placeholderTextColor="#8b99aa" style={styles.inputHalf} accessibilityLabel="Roof pitch" />
            <TextInput value={roofType} onChangeText={setRoofType} placeholder="Roof type" placeholderTextColor="#8b99aa" style={styles.inputHalf} accessibilityLabel="Roof type" />
          </View>
          <View style={styles.row}>
            <TextInput value={soffit} onChangeText={setSoffit} keyboardType="decimal-pad" placeholder="Soffit LF" placeholderTextColor="#8b99aa" style={styles.inputHalf} accessibilityLabel="Soffit linear feet" />
            <TextInput value={fascia} onChangeText={setFascia} keyboardType="decimal-pad" placeholder="Fascia LF" placeholderTextColor="#8b99aa" style={styles.inputHalf} accessibilityLabel="Fascia linear feet" />
          </View>
          {measureHints.map((hint) => (
            <Text key={hint} style={styles.helper}>{hint}</Text>
          ))}
          <Pressable style={styles.secondary} onPress={saveMeasurements}>
            <Text style={styles.secondaryText}>Save measurements for review</Text>
          </Pressable>
          <Pressable style={styles.reportButton} onPress={() => Linking.openURL(`${webAppUrl}/reports`)}>
            <Text style={styles.reportButtonText}>Open inspection report builder</Text>
          </Pressable>
        </View>

        <Text style={styles.sectionTitle}>Technician verification</Text>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Record field verification</Text>
          <TextInput
            value={technicianName}
            onChangeText={setTechnicianName}
            placeholder="Technician name"
            placeholderTextColor="#8b99aa"
            style={styles.input}
            accessibilityLabel="Technician name"
          />
          <TextInput
            value={technicianLicense}
            onChangeText={setTechnicianLicense}
            placeholder="License number (if applicable)"
            placeholderTextColor="#8b99aa"
            style={styles.input}
            accessibilityLabel="Technician license"
          />
          <TextInput
            value={verificationNotes}
            onChangeText={setVerificationNotes}
            placeholder="Verified values and corrections"
            placeholderTextColor="#8b99aa"
            style={styles.input}
            accessibilityLabel="Verification notes"
          />
          <Pressable style={styles.secondary} onPress={saveTechnicianVerification}>
            <Text style={styles.secondaryText}>
              {draft?.verifiedAt ? 'Update technician verification' : 'Save technician verification'}
            </Text>
          </Pressable>
          <Text style={styles.helper}>
            {draft?.verifiedAt
              ? `Verified ${new Date(draft.verifiedAt).toLocaleString()}. Signature and manager approval remain required.`
              : 'AI observations and measurements remain non-authoritative until this field review is recorded.'}
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Field coach</Text>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>On-device checklist</Text>
          <Text style={styles.helper}>Rules on this phone. No cloud model. Tap a line to see the next step.</Text>
          {coachItems.map((item) => (
            <Checklist key={item.id} label={item.label} checked={item.done} onPress={() => setNotice(item.hint)} />
          ))}
        </View>

        <Pressable style={styles.syncButton} onPress={() => void syncQueuedDrafts()} disabled={syncing}>
          <Text style={styles.syncText}>{syncing ? 'Syncing securely…' : 'Sync queued work now'}</Text>
        </Pressable>
        {notice ? <Text style={styles.notice}>{notice}</Text> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Text style={styles.footer}>Field release 0.4.0 · local drafts remain until server confirmation.</Text>
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

function AuthScreen({
  email,
  password,
  setEmail,
  setPassword,
  signIn,
  sendOtpCode,
  verifyOtpCode,
  sendPasswordReset,
  busy,
  error,
  notice,
  configured,
  authMode,
  setAuthMode,
  otpCode,
  setOtpCode,
  otpSent,
  setOtpSent,
  cooldown,
  showPassword,
  setShowPassword,
  webAppUrl,
}: {
  email: string
  password: string
  setEmail: (value: string) => void
  setPassword: (value: string) => void
  signIn: () => void
  sendOtpCode: () => void
  verifyOtpCode: () => void
  sendPasswordReset: () => void
  busy: boolean
  error: string
  notice: string
  configured: boolean
  authMode: 'password' | 'code' | 'forgot'
  setAuthMode: (mode: 'password' | 'code' | 'forgot') => void
  otpCode: string
  setOtpCode: (val: string) => void
  otpSent: boolean
  setOtpSent: (val: boolean) => void
  cooldown: number
  showPassword: boolean
  setShowPassword: (val: boolean | ((prev: boolean) => boolean)) => void
  webAppUrl: string
}) {
  return (
    <SafeAreaView style={styles.center}>
      <View style={styles.authCard}>
        <Text style={styles.eyebrow}>ROOF/OS FIELD</Text>
        <Text style={styles.authTitle}>
          {authMode === 'forgot' ? 'Reset password' : 'Secure field access'}
        </Text>
        <Text style={styles.helper}>
          {authMode === 'forgot'
            ? "Enter your work email and we will send a password reset link."
            : authMode === 'code'
            ? 'Sign in with a 6-digit email code. No password required.'
            : 'Sign in before accessing inspections or evidence.'}
        </Text>

        {authMode !== 'forgot' && (
          <View style={styles.authTabRow}>
            <Pressable
              style={[styles.authTab, authMode === 'password' && styles.authTabActive]}
              onPress={() => setAuthMode('password')}
            >
              <Text style={[styles.authTabText, authMode === 'password' && styles.authTabTextActive]}>
                Password
              </Text>
            </Pressable>
            <Pressable
              style={[styles.authTab, authMode === 'code' && styles.authTabActive]}
              onPress={() => setAuthMode('code')}
            >
              <Text style={[styles.authTabText, authMode === 'code' && styles.authTabTextActive]}>
                6-digit code
              </Text>
            </Pressable>
          </View>
        )}

        <Text style={styles.inputLabel}>Work email</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          placeholder="you@company.com"
          placeholderTextColor="#8b99aa"
          style={styles.input}
        />

        {authMode === 'password' && (
          <>
            <View style={styles.passwordLabelRow}>
              <Text style={styles.inputLabel}>Password</Text>
              <Pressable onPress={() => setAuthMode('forgot')} style={styles.forgotLink}>
                <Text style={styles.forgotLinkText}>Forgot password?</Text>
              </Pressable>
            </View>
            <View style={styles.passwordContainer}>
              <TextInput
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="Enter password"
                placeholderTextColor="#8b99aa"
                style={styles.passwordInput}
              />
              <Pressable
                onPress={() => setShowPassword((prev) => !prev)}
                style={styles.passwordToggle}
              >
                <Text style={styles.passwordToggleText}>{showPassword ? 'Hide' : 'Show'}</Text>
              </Pressable>
            </View>

            <Pressable style={styles.primary} onPress={signIn} disabled={busy}>
              <Text style={styles.primaryText}>{busy ? 'Signing in…' : 'Sign in'}</Text>
            </Pressable>
          </>
        )}

        {authMode === 'code' && (
          <>
            {!otpSent ? (
              <Pressable style={styles.primary} onPress={sendOtpCode} disabled={busy || cooldown > 0}>
                <Text style={styles.primaryText}>
                  {busy ? 'Sending code…' : cooldown > 0 ? `Wait ${cooldown}s` : 'Send 6-digit code'}
                </Text>
              </Pressable>
            ) : (
              <>
                <Text style={styles.inputLabel}>6-digit code from email</Text>
                <TextInput
                  value={otpCode}
                  onChangeText={(val) => setOtpCode(val.replace(/\D/g, '').slice(0, 6))}
                  keyboardType="number-pad"
                  autoCapitalize="none"
                  autoCorrect={false}
                  maxLength={6}
                  placeholder="000000"
                  placeholderTextColor="#8b99aa"
                  style={[styles.input, styles.otpInput]}
                />
                <Pressable
                  style={styles.primary}
                  onPress={verifyOtpCode}
                  disabled={busy || otpCode.trim().length !== 6}
                >
                  <Text style={styles.primaryText}>{busy ? 'Verifying…' : 'Verify & sign in'}</Text>
                </Pressable>
                <View style={styles.otpActionRow}>
                  <Pressable
                    onPress={sendOtpCode}
                    disabled={busy || cooldown > 0}
                    style={styles.textButton}
                  >
                    <Text style={styles.textButtonText}>
                      {cooldown > 0 ? `Resend code (${cooldown}s)` : 'Resend code'}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      setOtpSent(false)
                      setOtpCode('')
                    }}
                    style={styles.textButton}
                  >
                    <Text style={styles.textButtonText}>Change email</Text>
                  </Pressable>
                </View>
              </>
            )}
          </>
        )}

        {authMode === 'forgot' && (
          <>
            <Pressable style={styles.primary} onPress={sendPasswordReset} disabled={busy}>
              <Text style={styles.primaryText}>
                {busy ? 'Sending reset link…' : 'Send password reset email'}
              </Text>
            </Pressable>
            <Pressable
              style={styles.secondaryButton}
              onPress={() =>
                Linking.openURL(`${webAppUrl}/auth/reset?email=${encodeURIComponent(email.trim())}`)
              }
            >
              <Text style={styles.secondaryButtonText}>Open password reset on web ↗</Text>
            </Pressable>
            <Pressable onPress={() => setAuthMode('password')} style={styles.backButton}>
              <Text style={styles.backButtonText}>← Back to sign in</Text>
            </Pressable>
          </>
        )}

        {notice ? <Text style={styles.notice}>{notice}</Text> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.browserLinkContainer}>
          <Pressable onPress={() => Linking.openURL(`${webAppUrl}/auth/login`)}>
            <Text style={styles.browserLinkText}>Prefer mobile browser? Sign in on web ↗</Text>
          </Pressable>
        </View>

        {!configured ? (
          <Text style={styles.error}>
            Using fallback production Supabase credentials. Rebuild with EXPO_PUBLIC_* to override.
          </Text>
        ) : null}
      </View>
    </SafeAreaView>
  )
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  )
}

function Checklist({
  label,
  checked,
  onPress,
}: {
  label: string
  checked: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      style={styles.check}
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
    >
      <View style={[styles.checkDot, checked && styles.checkDotChecked]} />
      <Text style={styles.checkText}>{label}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f7f9fc' },
  center: { flex: 1, backgroundColor: '#f7f9fc', justifyContent: 'center', padding: 24 },
  content: { padding: 20, paddingBottom: 40 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 22,
  },
  eyebrow: { color: colors.blue, fontSize: 12, fontWeight: '800', letterSpacing: 1.5 },
  title: { color: colors.ink, fontSize: 30, fontWeight: '800', marginTop: 4 },
  subtitle: { color: colors.muted, marginTop: 4, fontSize: 14 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.white, fontWeight: '800' },
  hero: { backgroundColor: colors.ink, borderRadius: 22, padding: 22, marginBottom: 14 },
  heroLabel: { color: '#9dc4ff', fontWeight: '800', fontSize: 11, letterSpacing: 1.4 },
  heroTitle: { color: colors.white, fontSize: 24, fontWeight: '800', marginTop: 8 },
  heroText: { color: '#cad7e8', lineHeight: 21, marginTop: 8, marginBottom: 18 },
  primary: {
    backgroundColor: '#3e8cff',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryText: { color: colors.white, fontWeight: '800', fontSize: 16 },
  metrics: { flexDirection: 'row', gap: 10, marginBottom: 22 },
  metric: {
    flex: 1,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 14,
  },
  metricValue: { color: colors.ink, fontSize: 20, fontWeight: '800' },
  metricLabel: { color: colors.muted, fontSize: 12, marginTop: 3 },
  sectionTitle: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 10,
    marginTop: 6,
  },
  card: {
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 18,
  },
  authCard: {
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 18,
    padding: 22,
  },
  authTitle: { color: colors.ink, fontSize: 28, fontWeight: '800', marginVertical: 8 },
  authTabRow: {
    flexDirection: 'row',
    backgroundColor: '#eef3f9',
    borderRadius: 10,
    padding: 4,
    marginBottom: 16,
    marginTop: 8,
  },
  authTab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
  authTabActive: {
    backgroundColor: colors.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  authTabText: { fontSize: 13, fontWeight: '600', color: colors.muted },
  authTabTextActive: { color: colors.blue, fontWeight: '800' },
  inputLabel: { fontSize: 12, fontWeight: '700', color: colors.ink, marginBottom: 4 },
  passwordLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  forgotLink: { paddingVertical: 2 },
  forgotLinkText: { fontSize: 12, fontWeight: '700', color: colors.blue },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 10,
    marginBottom: 14,
    backgroundColor: colors.white,
  },
  passwordInput: { flex: 1, padding: 12, color: colors.ink },
  passwordToggle: { paddingHorizontal: 14, paddingVertical: 12 },
  passwordToggleText: { fontSize: 12, fontWeight: '700', color: colors.blue },
  otpInput: { textAlign: 'center', letterSpacing: 8, fontSize: 20, fontWeight: '700' },
  otpActionRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
  textButton: { paddingVertical: 6, paddingHorizontal: 4 },
  textButtonText: { fontSize: 12, fontWeight: '700', color: colors.blue },
  secondaryButton: {
    backgroundColor: colors.pale,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  secondaryButtonText: { color: colors.blue, fontWeight: '800', fontSize: 14 },
  backButton: { paddingVertical: 12, alignItems: 'center', marginTop: 6 },
  backButtonText: { fontSize: 13, fontWeight: '700', color: colors.muted },
  browserLinkContainer: {
    marginTop: 18,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#edf2f7',
    alignItems: 'center',
  },
  browserLinkText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.muted,
    textDecorationLine: 'underline',
  },
  cardTitle: { color: colors.ink, fontSize: 16, fontWeight: '700', marginBottom: 10 },
  input: {
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    color: colors.ink,
    marginBottom: 10,
  },
  row: { flexDirection: 'row', gap: 10 },
  inputHalf: {
    flex: 1,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    color: colors.ink,
    marginBottom: 10,
  },
  secondary: {
    backgroundColor: colors.pale,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  secondaryHalf: {
    flex: 1,
    backgroundColor: colors.pale,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  reportButton: {
    backgroundColor: '#dff7eb',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  reportButtonText: { color: colors.green, fontWeight: '800' },
  agendaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  agendaBadge: {
    backgroundColor: colors.pale,
    borderRadius: 8,
    paddingVertical: 5,
    paddingHorizontal: 7,
    marginRight: 10,
  },
  agendaBadgeText: { color: colors.blue, fontSize: 10, fontWeight: '800' },
  agendaBody: { flex: 1 },
  agendaTitle: { color: colors.ink, fontWeight: '700' },
  leadOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 11,
    marginBottom: 8,
  },
  leadOptionSelected: { borderColor: colors.blue, backgroundColor: colors.pale },
  leadName: { color: colors.ink, fontWeight: '800' },
  leadCheck: { color: colors.blue, fontWeight: '800', fontSize: 12 },
  albumRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  albumChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    paddingVertical: 8,
    paddingHorizontal: 11,
  },
  albumChipSelected: { backgroundColor: colors.blue, borderColor: colors.blue },
  albumText: { color: colors.muted, fontWeight: '700', textTransform: 'capitalize' },
  albumTextSelected: { color: colors.white },
  secondaryText: { color: colors.blue, fontWeight: '800' },
  helper: { color: colors.muted, fontSize: 12, lineHeight: 17, marginTop: 4, marginBottom: 8 },
  check: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9 },
  checkDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: colors.green,
    marginRight: 10,
  },
  checkDotChecked: { backgroundColor: colors.green },
  checkText: { color: colors.ink, fontSize: 14 },
  syncButton: {
    borderColor: colors.blue,
    borderWidth: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 14,
  },
  syncText: { color: colors.blue, fontWeight: '800' },
  notice: {
    color: colors.green,
    backgroundColor: '#e7f7ef',
    padding: 12,
    borderRadius: 10,
    marginBottom: 14,
    marginTop: 6,
  },
  error: {
    color: colors.red,
    backgroundColor: '#fff1f0',
    padding: 12,
    borderRadius: 10,
    marginTop: 10,
    marginBottom: 8,
  },
  footer: { color: colors.muted, fontSize: 12, lineHeight: 17, textAlign: 'center' },
})
