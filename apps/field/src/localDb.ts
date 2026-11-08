import * as SQLite from 'expo-sqlite'
export const db = SQLite.openDatabaseSync('roofos-field.db')

const CREATE_TABLES_SQL = `
CREATE TABLE IF NOT EXISTS inspection_drafts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  remote_id TEXT,
  owner_user_id TEXT,
  workspace_id TEXT,
  client_id TEXT,
  lead_id TEXT,
  address TEXT NOT NULL DEFAULT '',
  photo_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  latitude REAL,
  longitude REAL,
  technician_name TEXT,
  technician_license TEXT,
  verified_at TEXT,
  verification_notes TEXT,
  verification_synced INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS inspection_measurements_local (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  draft_id INTEGER NOT NULL,
  client_id TEXT,
  roof_squares REAL NOT NULL,
  gutter_lf REAL NOT NULL,
  eave_lf REAL NOT NULL,
  rafter_lf REAL NOT NULL,
  pitch REAL NOT NULL,
  soffit_lf REAL NOT NULL,
  fascia_lf REAL NOT NULL,
  roof_type TEXT NOT NULL,
  latitude REAL,
  longitude REAL,
  captured_at TEXT NOT NULL,
  sync_status TEXT NOT NULL DEFAULT 'queued',
  retry_count INTEGER NOT NULL DEFAULT 0,
  next_retry_at TEXT,
  last_error TEXT
);
CREATE TABLE IF NOT EXISTS inspection_photo_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  draft_id INTEGER NOT NULL,
  client_id TEXT,
  local_uri TEXT NOT NULL,
  album TEXT NOT NULL DEFAULT 'general',
  caption TEXT,
  mime_type TEXT NOT NULL DEFAULT 'image/jpeg',
  file_size_bytes INTEGER,
  width INTEGER,
  height INTEGER,
  captured_at TEXT NOT NULL,
  sync_status TEXT NOT NULL DEFAULT 'queued',
  remote_id TEXT,
  error TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  next_retry_at TEXT,
  last_error TEXT
);
CREATE TABLE IF NOT EXISTS inspection_ai_request_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_key TEXT NOT NULL UNIQUE,
  draft_id INTEGER NOT NULL,
  photo_queue_id INTEGER NOT NULL,
  feature_key TEXT NOT NULL CHECK (feature_key IN ('caption_album', 'photo_completeness')),
  status TEXT NOT NULL CHECK (status IN ('waiting_for_upload', 'pending_analysis', 'completed', 'failed')),
  source_photo_id TEXT,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (photo_queue_id, feature_key)
);
CREATE INDEX IF NOT EXISTS inspection_drafts_owner_updated_idx
  ON inspection_drafts (owner_user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS inspection_measurements_draft_sync_idx
  ON inspection_measurements_local (draft_id, sync_status, next_retry_at);
CREATE INDEX IF NOT EXISTS inspection_photos_draft_sync_idx
  ON inspection_photo_queue (draft_id, sync_status, next_retry_at);
CREATE INDEX IF NOT EXISTS inspection_ai_requests_expiry_idx
  ON inspection_ai_request_queue (expires_at);
export function initLocalDb() {
  db.execSync(CREATE_TABLES_SQL)
}
