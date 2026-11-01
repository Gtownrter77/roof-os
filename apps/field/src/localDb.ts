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
);`

export function initLocalDb() {
  db.execSync(CREATE_TABLES_SQL)
}
