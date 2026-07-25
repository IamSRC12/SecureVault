import Database from 'better-sqlite3'
import { join } from 'path'
import { v4 as uuidv4 } from 'uuid'
import { encrypt, decrypt } from './encryption'
import type {
  Credential,
  ApiKey,
  AppSetting,
  AuditLog,
  AuditAction,
  CredentialCategory,
  ApiKeyCategory,
} from '../types'

// ─── Database Singleton ───────────────────────────────────────────────────

let db: Database.Database | null = null

export function getDatabase(): Database.Database {
  if (!db) throw new Error('Database not initialized. Call initDatabase() first.')
  return db
}

// ─── Initialization ───────────────────────────────────────────────────────

/**
 * Opens (or creates) the SQLite database and creates all tables.
 * Called once from the Electron main process at startup.
 */
export function initDatabase(appDataPath: string): void {
  const dbPath = join(appDataPath, 'securevault.db')
  db = new Database(dbPath)

  // Enable WAL for better performance
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  createTables()
  seedSettings()
}

export function closeDatabase(): void {
  if (db) {
    db.close()
    db = null
  }
}

// ─── Table Creation ───────────────────────────────────────────────────────

function createTables(): void {
  const database = getDatabase()

  database.exec(`
    CREATE TABLE IF NOT EXISTS credentials (
      id               TEXT PRIMARY KEY,
      domain           TEXT NOT NULL,
      website_name     TEXT NOT NULL,
      username         TEXT,
      email            TEXT,
      password         TEXT NOT NULL,
      notes            TEXT,
      category         TEXT DEFAULT 'other',
      favicon_url      TEXT,
      is_favorite      INTEGER DEFAULT 0,
      password_strength TEXT,
      date_created     TEXT NOT NULL,
      date_modified    TEXT NOT NULL,
      last_used        TEXT
    );

    CREATE TABLE IF NOT EXISTS api_keys (
      id               TEXT PRIMARY KEY,
      service_name     TEXT NOT NULL,
      api_key          TEXT NOT NULL,
      secret_key       TEXT,
      endpoint_url     TEXT,
      description      TEXT,
      category         TEXT DEFAULT 'other',
      expiry_date      TEXT,
      is_favorite      INTEGER DEFAULT 0,
      date_created     TEXT NOT NULL,
      date_modified    TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key              TEXT PRIMARY KEY,
      value            TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id               TEXT PRIMARY KEY,
      action           TEXT NOT NULL,
      details          TEXT,
      timestamp        TEXT NOT NULL,
      success          INTEGER
    );
  `)
}

function seedSettings(): void {
  const database = getDatabase()
  const insert = database.prepare(`
    INSERT OR IGNORE INTO app_settings (key, value) VALUES (?, ?)
  `)

  const defaults: [string, string][] = [
    ['master_password_hash',  ''],
    ['master_password_salt',  ''],
    ['auto_lock_timeout',     '5'],
    ['theme',                 'dark'],
    ['extension_token',       ''],
    ['is_setup_complete',     'false'],
    ['app_version',           '1.0.0'],
  ]

  const seedMany = database.transaction(() => {
    for (const [key, value] of defaults) {
      insert.run(key, value)
    }
  })

  seedMany()
}

// ─── App Settings ─────────────────────────────────────────────────────────

export function getSetting(key: string): string | null {
  const row = getDatabase()
    .prepare('SELECT value FROM app_settings WHERE key = ?')
    .get(key) as { value: string } | undefined

  return row?.value ?? null
}

export function setSetting(key: string, value: string): void {
  getDatabase()
    .prepare('INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)')
    .run(key, value)
}

export function getAllSettings(): Record<string, string> {
  const rows = getDatabase()
    .prepare('SELECT key, value FROM app_settings')
    .all() as AppSetting[]

  return Object.fromEntries(rows.map(r => [r.key, r.value]))
}

// ─── Credentials CRUD ─────────────────────────────────────────────────────

export function getAllCredentials(encKey: Buffer): Credential[] {
  const rows = getDatabase()
    .prepare('SELECT * FROM credentials ORDER BY website_name ASC')
    .all() as Credential[]

  return rows.map(row => decryptCredential(row, encKey))
}

export function getCredentialById(id: string, encKey: Buffer): Credential | null {
  const row = getDatabase()
    .prepare('SELECT * FROM credentials WHERE id = ?')
    .get(id) as Credential | undefined

  if (!row) return null
  return decryptCredential(row, encKey)
}

export function getCredentialsByDomain(domain: string, encKey: Buffer): Credential[] {
  const rows = getDatabase()
    .prepare('SELECT * FROM credentials WHERE domain = ? OR domain LIKE ?')
    .all(domain, `%.${domain}`) as Credential[]

  return rows.map(row => decryptCredential(row, encKey))
}

export function createCredential(
  data: Omit<Credential, 'id' | 'date_created' | 'date_modified' | 'last_used'>,
  encKey: Buffer
): Credential {
  const id = uuidv4()
  const now = new Date().toISOString()

  const encrypted = encryptCredentialData(data, encKey)

  getDatabase().prepare(`
    INSERT INTO credentials
      (id, domain, website_name, username, email, password, notes, category,
       favicon_url, is_favorite, password_strength, date_created, date_modified, last_used)
    VALUES
      (@id, @domain, @website_name, @username, @email, @password, @notes, @category,
       @favicon_url, @is_favorite, @password_strength, @date_created, @date_modified, @last_used)
  `).run({
    id,
    ...encrypted,
    date_created: now,
    date_modified: now,
    last_used: null,
  })

  return getCredentialById(id, encKey)!
}

export function updateCredential(
  id: string,
  data: Partial<Omit<Credential, 'id' | 'date_created'>>,
  encKey: Buffer
): void {
  const now = new Date().toISOString()

  // Encrypt updated fields
  const updates: Record<string, unknown> = { id, date_modified: now }

  if (data.password !== undefined)  updates.password = encrypt(data.password, encKey)
  if (data.notes !== undefined)     updates.notes = data.notes ? encrypt(data.notes, encKey) : null
  if (data.domain !== undefined)    updates.domain = data.domain
  if (data.website_name !== undefined) updates.website_name = data.website_name
  if (data.username !== undefined)  updates.username = data.username
  if (data.email !== undefined)     updates.email = data.email
  if (data.category !== undefined)  updates.category = data.category
  if (data.favicon_url !== undefined) updates.favicon_url = data.favicon_url
  if (data.is_favorite !== undefined) updates.is_favorite = data.is_favorite
  if (data.password_strength !== undefined) updates.password_strength = data.password_strength

  const setClauses = Object.keys(updates)
    .filter(k => k !== 'id')
    .map(k => `${k} = @${k}`)
    .join(', ')

  getDatabase()
    .prepare(`UPDATE credentials SET ${setClauses} WHERE id = @id`)
    .run(updates)
}

export function deleteCredential(id: string): void {
  getDatabase()
    .prepare('DELETE FROM credentials WHERE id = ?')
    .run(id)
}

export function toggleFavoriteCredential(id: string): void {
  getDatabase().prepare(`
    UPDATE credentials
    SET is_favorite = CASE WHEN is_favorite = 1 THEN 0 ELSE 1 END
    WHERE id = ?
  `).run(id)
}

export function updateLastUsed(id: string): void {
  getDatabase()
    .prepare('UPDATE credentials SET last_used = ? WHERE id = ?')
    .run(new Date().toISOString(), id)
}

// ─── API Keys CRUD ────────────────────────────────────────────────────────

export function getAllApiKeys(encKey: Buffer): ApiKey[] {
  const rows = getDatabase()
    .prepare('SELECT * FROM api_keys ORDER BY service_name ASC')
    .all() as ApiKey[]

  return rows.map(row => decryptApiKey(row, encKey))
}

export function getApiKeyById(id: string, encKey: Buffer): ApiKey | null {
  const row = getDatabase()
    .prepare('SELECT * FROM api_keys WHERE id = ?')
    .get(id) as ApiKey | undefined

  if (!row) return null
  return decryptApiKey(row, encKey)
}

export function createApiKey(
  data: Omit<ApiKey, 'id' | 'date_created' | 'date_modified'>,
  encKey: Buffer
): ApiKey {
  const id = uuidv4()
  const now = new Date().toISOString()

  getDatabase().prepare(`
    INSERT INTO api_keys
      (id, service_name, api_key, secret_key, endpoint_url, description,
       category, expiry_date, is_favorite, date_created, date_modified)
    VALUES
      (@id, @service_name, @api_key, @secret_key, @endpoint_url, @description,
       @category, @expiry_date, @is_favorite, @date_created, @date_modified)
  `).run({
    id,
    service_name: data.service_name,
    api_key:      encrypt(data.api_key, encKey),
    secret_key:   data.secret_key ? encrypt(data.secret_key, encKey) : null,
    endpoint_url: data.endpoint_url,
    description:  data.description,
    category:     data.category,
    expiry_date:  data.expiry_date,
    is_favorite:  data.is_favorite,
    date_created: now,
    date_modified: now,
  })

  return getApiKeyById(id, encKey)!
}

export function updateApiKey(
  id: string,
  data: Partial<Omit<ApiKey, 'id' | 'date_created'>>,
  encKey: Buffer
): void {
  const now = new Date().toISOString()
  const updates: Record<string, unknown> = { id, date_modified: now }

  if (data.service_name !== undefined) updates.service_name = data.service_name
  if (data.api_key !== undefined)      updates.api_key = encrypt(data.api_key, encKey)
  if (data.secret_key !== undefined)   updates.secret_key = data.secret_key ? encrypt(data.secret_key, encKey) : null
  if (data.endpoint_url !== undefined) updates.endpoint_url = data.endpoint_url
  if (data.description !== undefined)  updates.description = data.description
  if (data.category !== undefined)     updates.category = data.category
  if (data.expiry_date !== undefined)  updates.expiry_date = data.expiry_date
  if (data.is_favorite !== undefined)  updates.is_favorite = data.is_favorite

  const setClauses = Object.keys(updates)
    .filter(k => k !== 'id')
    .map(k => `${k} = @${k}`)
    .join(', ')

  getDatabase()
    .prepare(`UPDATE api_keys SET ${setClauses} WHERE id = @id`)
    .run(updates)
}

export function deleteApiKey(id: string): void {
  getDatabase()
    .prepare('DELETE FROM api_keys WHERE id = ?')
    .run(id)
}

export function toggleFavoriteApiKey(id: string): void {
  getDatabase().prepare(`
    UPDATE api_keys
    SET is_favorite = CASE WHEN is_favorite = 1 THEN 0 ELSE 1 END
    WHERE id = ?
  `).run(id)
}

// ─── Audit Log ────────────────────────────────────────────────────────────

export function addAuditLog(
  action: AuditAction,
  details: string | null,
  success: boolean
): void {
  getDatabase().prepare(`
    INSERT INTO audit_log (id, action, details, timestamp, success)
    VALUES (?, ?, ?, ?, ?)
  `).run(uuidv4(), action, details, new Date().toISOString(), success ? 1 : 0)
}

export function getAuditLogs(limit = 100, offset = 0): AuditLog[] {
  return getDatabase()
    .prepare('SELECT * FROM audit_log ORDER BY timestamp DESC LIMIT ? OFFSET ?')
    .all(limit, offset) as AuditLog[]
}

export function clearAuditLog(): void {
  getDatabase().prepare('DELETE FROM audit_log').run()
}

export function getAuditLogCount(): number {
  const row = getDatabase()
    .prepare('SELECT COUNT(*) as count FROM audit_log')
    .get() as { count: number }
  return row.count
}

// ─── Stats ────────────────────────────────────────────────────────────────

export function getDashboardStats(encKey: Buffer): {
  totalPasswords: number
  totalApiKeys: number
  weakPasswords: number
  strongPasswords: number
  securityScore: number
} {
  const db = getDatabase()

  const totalPasswords = (db.prepare('SELECT COUNT(*) as c FROM credentials').get() as { c: number }).c
  const totalApiKeys   = (db.prepare('SELECT COUNT(*) as c FROM api_keys').get() as { c: number }).c
  const weakPasswords  = (db.prepare("SELECT COUNT(*) as c FROM credentials WHERE password_strength = 'weak'").get() as { c: number }).c
  const strongPasswords = (db.prepare("SELECT COUNT(*) as c FROM credentials WHERE password_strength = 'strong'").get() as { c: number }).c

  const securityScore = totalPasswords > 0
    ? Math.round((strongPasswords / totalPasswords) * 100)
    : 100

  return { totalPasswords, totalApiKeys, weakPasswords, strongPasswords, securityScore }
}

// ─── Clear All Data ───────────────────────────────────────────────────────

export function clearAllData(): void {
  const database = getDatabase()
  database.exec(`
    DELETE FROM credentials;
    DELETE FROM api_keys;
    DELETE FROM audit_log;
    DELETE FROM app_settings;
  `)
  seedSettings()
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function decryptCredential(row: Credential, encKey: Buffer): Credential {
  return {
    ...row,
    password: row.password ? decrypt(row.password, encKey) : '',
    notes:    row.notes    ? decrypt(row.notes, encKey)    : null,
  }
}

function decryptApiKey(row: ApiKey, encKey: Buffer): ApiKey {
  return {
    ...row,
    api_key:    row.api_key    ? decrypt(row.api_key, encKey)    : '',
    secret_key: row.secret_key ? decrypt(row.secret_key, encKey) : null,
  }
}

function encryptCredentialData(
  data: Omit<Credential, 'id' | 'date_created' | 'date_modified' | 'last_used'>,
  encKey: Buffer
): Omit<Credential, 'id' | 'date_created' | 'date_modified' | 'last_used'> {
  return {
    ...data,
    password: encrypt(data.password, encKey),
    notes:    data.notes ? encrypt(data.notes, encKey) : null,
  }
}
