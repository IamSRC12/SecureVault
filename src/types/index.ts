// ─── Database Entities ────────────────────────────────────────────────────

export interface Credential {
  id: string
  domain: string
  website_name: string
  username: string | null
  email: string | null
  password: string          // Stored encrypted, decrypted when needed
  notes: string | null      // Stored encrypted
  category: CredentialCategory
  favicon_url: string | null
  is_favorite: number       // 0 or 1
  password_strength: PasswordStrength | null
  date_created: string      // ISO timestamp
  date_modified: string     // ISO timestamp
  last_used: string | null  // ISO timestamp
}

export interface ApiKey {
  id: string
  service_name: string
  api_key: string           // Stored encrypted
  secret_key: string | null // Stored encrypted
  endpoint_url: string | null
  description: string | null
  category: ApiKeyCategory
  expiry_date: string | null
  is_favorite: number       // 0 or 1
  date_created: string
  date_modified: string
}

export interface AppSetting {
  key: string
  value: string
}

export interface AuditLog {
  id: string
  action: AuditAction
  details: string | null
  timestamp: string
  success: number           // 0 or 1
}

// ─── Enums / Literals ─────────────────────────────────────────────────────

export type CredentialCategory =
  | 'social'
  | 'banking'
  | 'work'
  | 'shopping'
  | 'email'
  | 'other'

export type ApiKeyCategory =
  | 'ai'
  | 'cloud'
  | 'payment'
  | 'communication'
  | 'development'
  | 'other'

export type PasswordStrength = 'weak' | 'medium' | 'strong'

export type AuditAction =
  | 'LOGIN_SUCCESS'
  | 'LOGIN_FAILED'
  | 'ADD_PASSWORD'
  | 'EDIT_PASSWORD'
  | 'DELETE_PASSWORD'
  | 'ADD_API_KEY'
  | 'EDIT_API_KEY'
  | 'DELETE_API_KEY'
  | 'EXTENSION_SAVE'
  | 'EXTENSION_AUTOFILL'
  | 'LOCK'
  | 'UNLOCK'
  | 'SETUP_COMPLETE'
  | 'CHANGE_MASTER_PASSWORD'
  | 'EXPORT_VAULT'
  | 'IMPORT_VAULT'
  | 'CLEAR_DATA'
  | 'REGENERATE_TOKEN'

// ─── API Responses ────────────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface StatusResponse {
  running: boolean
  locked: boolean
  version: string
}

export interface TokenResponse {
  success: boolean
  token?: string
}

export interface CredentialApiItem {
  id: string
  domain: string
  website_name: string
  username: string | null
  email: string | null
  password: string          // DECRYPTED for autofill
  category: CredentialCategory
}

export interface SaveCredentialResponse {
  success: boolean
  action: 'created' | 'exists'
  id?: string
  existingId?: string
}

// ─── UI State ─────────────────────────────────────────────────────────────

export type AppScreen = 'loading' | 'setup' | 'login' | 'main'

export type MainRoute =
  | '/dashboard'
  | '/passwords'
  | '/apikeys'
  | '/generator'
  | '/audit'
  | '/settings'

export interface AppState {
  screen: AppScreen
  isLocked: boolean
  encryptionKey: Buffer | null
  appPath: string | null
  extensionConnected: boolean
  lastActivity: number
  autoLockTimeout: number   // minutes (0 = never)
}

// ─── Form Types ────────────────────────────────────────────────────────────

export interface CredentialFormData {
  website_name: string
  domain: string
  username: string
  email: string
  password: string
  category: CredentialCategory
  notes: string
  is_favorite: boolean
}

export interface ApiKeyFormData {
  service_name: string
  api_key: string
  secret_key: string
  endpoint_url: string
  description: string
  category: ApiKeyCategory
  expiry_date: string
  is_favorite: boolean
}

// ─── Encrypted Storage Format ─────────────────────────────────────────────

// Stored as: "iv_hex:authTag_hex:encryptedData_hex"
export type EncryptedString = string

// ─── Password Strength Result ─────────────────────────────────────────────

export interface PasswordStrengthResult {
  strength: PasswordStrength
  score: number             // 0–100
  checks: {
    minLength:    boolean
    uppercase:    boolean
    lowercase:    boolean
    numbers:      boolean
    symbols:      boolean
    longEnough:   boolean
    length16Plus: boolean
    length24Plus: boolean
  }
}

// ─── Generator Settings ────────────────────────────────────────────────────

export interface GeneratorSettings {
  length: number
  uppercase: boolean
  lowercase: boolean
  numbers: boolean
  symbols: boolean
  excludeSimilar: boolean
}

// ─── Export / Import ───────────────────────────────────────────────────────

export interface VaultExport {
  version: string
  exportDate: string
  credentials: Credential[]
  apiKeys: ApiKey[]
  // Encrypted with master password before writing to disk
}
