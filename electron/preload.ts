import { contextBridge, ipcRenderer } from 'electron'
import type {
  Credential,
  ApiKey,
  AuditLog,
  AuditAction,
  DashboardStats,
  CredentialCategory,
  ApiKeyCategory,
} from '../src/types'

contextBridge.exposeInMainWorld('electronAPI', {
  getAppPath:    (): Promise<string>  => ipcRenderer.invoke('get-app-path'),
  getAppVersion: (): Promise<string>  => ipcRenderer.invoke('app-version'),
  lockApp:       (): void             => ipcRenderer.send('lock-app'),
  setUnlocked:   (encKeyHex: string): Promise<void> => ipcRenderer.invoke('set-unlocked', encKeyHex),
  setLocked:     (): Promise<void>    => ipcRenderer.invoke('set-locked'),

  onForceLock: (callback: () => void): void => {
    ipcRenderer.on('force-lock', callback)
  },
  removeForceLockListener: (): void => {
    ipcRenderer.removeAllListeners('force-lock')
  },

  // ─── Database Operations IPC ─────────────────────────────────────────────
  db: {
    getSetting: (key: string): Promise<string | null> =>
      ipcRenderer.invoke('db-get-setting', key),
    setSetting: (key: string, value: string): Promise<void> =>
      ipcRenderer.invoke('db-set-setting', key, value),
    
    getAllCredentials: (encKeyHex: string): Promise<Credential[]> =>
      ipcRenderer.invoke('db-get-all-credentials', encKeyHex),
    getCredentialById: (id: string, encKeyHex: string): Promise<Credential | null> =>
      ipcRenderer.invoke('db-get-credential-by-id', id, encKeyHex),
    createCredential: (data: any, encKeyHex: string): Promise<Credential> =>
      ipcRenderer.invoke('db-create-credential', data, encKeyHex),
    updateCredential: (id: string, data: any, encKeyHex: string): Promise<void> =>
      ipcRenderer.invoke('db-update-credential', id, data, encKeyHex),
    deleteCredential: (id: string): Promise<void> =>
      ipcRenderer.invoke('db-delete-credential', id),
    toggleFavoriteCredential: (id: string): Promise<void> =>
      ipcRenderer.invoke('db-toggle-favorite-credential', id),
    updateLastUsed: (id: string): Promise<void> =>
      ipcRenderer.invoke('db-update-last-used', id),

    getAllApiKeys: (encKeyHex: string): Promise<ApiKey[]> =>
      ipcRenderer.invoke('db-get-all-api-keys', encKeyHex),
    getApiKeyById: (id: string, encKeyHex: string): Promise<ApiKey | null> =>
      ipcRenderer.invoke('db-get-api-key-by-id', id, encKeyHex),
    createApiKey: (data: any, encKeyHex: string): Promise<ApiKey> =>
      ipcRenderer.invoke('db-create-api-key', data, encKeyHex),
    updateApiKey: (id: string, data: any, encKeyHex: string): Promise<void> =>
      ipcRenderer.invoke('db-update-api-key', id, data, encKeyHex),
    deleteApiKey: (id: string): Promise<void> =>
      ipcRenderer.invoke('db-delete-api-key', id),
    toggleFavoriteApiKey: (id: string): Promise<void> =>
      ipcRenderer.invoke('db-toggle-favorite-api-key', id),

    addAuditLog: (action: AuditAction, details: string | null, success: boolean): Promise<void> =>
      ipcRenderer.invoke('db-add-audit-log', action, details, success),
    getAuditLogs: (limit: number, offset: number): Promise<AuditLog[]> =>
      ipcRenderer.invoke('db-get-audit-logs', limit, offset),
    clearAuditLog: (): Promise<void> =>
      ipcRenderer.invoke('db-clear-audit-log'),
    getAuditLogCount: (): Promise<number> =>
      ipcRenderer.invoke('db-get-audit-log-count'),

    getDashboardStats: (encKeyHex: string): Promise<DashboardStats> =>
      ipcRenderer.invoke('db-get-dashboard-stats', encKeyHex),
    clearAllData: (): Promise<void> =>
      ipcRenderer.invoke('db-clear-all-data'),
  },

  // ─── Auth Operations IPC ──────────────────────────────────────────────────
  auth: {
    hashMasterPassword: (password: string): Promise<{ hash: string; salt: string }> =>
      ipcRenderer.invoke('auth-hash-master-password', password),
    verifyMasterPassword: (password: string, storedHash: string): Promise<boolean> =>
      ipcRenderer.invoke('auth-verify-master-password', password, storedHash),
    deriveKey: (password: string, salt: string): Promise<Uint8Array> =>
      ipcRenderer.invoke('auth-derive-key', password, salt),
    changeMasterPassword: (currentPassword: string, newPassword: string, storedHash: string): Promise<{ newHash: string; newSalt: string; newKey: Uint8Array } | null> =>
      ipcRenderer.invoke('auth-change-master-password', currentPassword, newPassword, storedHash),
    
    encryptVaultExport: (data: string, masterPassword: string): Promise<string> =>
      ipcRenderer.invoke('enc-encrypt-vault-export', data, masterPassword),
    decryptVaultExport: (encryptedData: string, masterPassword: string): Promise<string> =>
      ipcRenderer.invoke('enc-decrypt-vault-export', encryptedData, masterPassword),
    signJwt: (payload: any, secret: string, options: any): Promise<string> =>
      ipcRenderer.invoke('auth-sign-jwt', payload, secret, options),
  }
})

// Types for window.electronAPI
declare global {
  interface Window {
    electronAPI: {
      getAppPath:              () => Promise<string>
      getAppVersion:           () => Promise<string>
      lockApp:                 () => void
      setUnlocked:             (encKeyHex: string) => Promise<void>
      setLocked:               () => Promise<void>
      onForceLock:             (callback: () => void) => void
      removeForceLockListener: () => void

      db: {
        getSetting: (key: string) => Promise<string | null>
        setSetting: (key: string, value: string) => Promise<void>
        getAllCredentials: (encKeyHex: string) => Promise<Credential[]>
        getCredentialById: (id: string, encKeyHex: string) => Promise<Credential | null>
        createCredential: (data: any, encKeyHex: string) => Promise<Credential>
        updateCredential: (id: string, data: any, encKeyHex: string) => Promise<void>
        deleteCredential: (id: string) => Promise<void>
        toggleFavoriteCredential: (id: string) => Promise<void>
        updateLastUsed: (id: string) => Promise<void>
        getAllApiKeys: (encKeyHex: string) => Promise<ApiKey[]>
        getApiKeyById: (id: string, encKeyHex: string) => Promise<ApiKey | null>
        createApiKey: (data: any, encKeyHex: string) => Promise<ApiKey>
        updateApiKey: (id: string, data: any, encKeyHex: string) => Promise<void>
        deleteApiKey: (id: string) => Promise<void>
        toggleFavoriteApiKey: (id: string) => Promise<void>
        addAuditLog: (action: AuditAction, details: string | null, success: boolean) => Promise<void>
        getAuditLogs: (limit: number, offset: number) => Promise<AuditLog[]>
        clearAuditLog: () => Promise<void>
        getAuditLogCount: () => Promise<number>
        getDashboardStats: (encKeyHex: string) => Promise<DashboardStats>
        clearAllData: () => Promise<void>
      }

      auth: {
        hashMasterPassword: (password: string) => Promise<{ hash: string; salt: string }>
        verifyMasterPassword: (password: string, storedHash: string) => Promise<boolean>
        deriveKey: (password: string, salt: string) => Promise<Uint8Array>
        changeMasterPassword: (currentPassword: string, newPassword: string, storedHash: string) => Promise<{ newHash: string; newSalt: string; newKey: Uint8Array } | null>
        encryptVaultExport: (data: string, masterPassword: string) => Promise<string>
        decryptVaultExport: (encryptedData: string, masterPassword: string) => Promise<string>
        signJwt:            (payload: any, secret: string, options: any) => Promise<string>
      }
    }
  }
}
