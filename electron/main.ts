import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { join } from 'path'
import { startServer, stopServer, setServerLocked } from './server'
import * as db from '../src/services/database'
import * as auth from '../src/services/auth'
import { encryptVaultExport, decryptVaultExport } from '../src/services/encryption'
import jwt from 'jsonwebtoken'

let mainWindow: BrowserWindow | null = null

// ─── Window ───────────────────────────────────────────────────────────────

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width:  1200,
    height: 800,
    minWidth:  900,
    minHeight: 600,
    webPreferences: {
      preload:          join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration:  false,
      sandbox:          false,
    },
    show:          false,
    backgroundColor: '#0f0f0f',
    titleBarStyle: 'default',
    frame:         true,
  })

  mainWindow.on('ready-to-show', () => mainWindow?.show())

  // Open external links in OS browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  // Auto-lock on window blur (2-minute grace period)
  let blurTimer: ReturnType<typeof setTimeout> | null = null

  mainWindow.on('blur', () => {
    blurTimer = setTimeout(() => {
      mainWindow?.webContents.send('force-lock')
    }, 2 * 60 * 1000)
  })

  mainWindow.on('focus', () => {
    if (blurTimer) { clearTimeout(blurTimer); blurTimer = null }
  })

  // Load renderer
  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// ─── App Lifecycle ────────────────────────────────────────────────────────

app.whenReady().then(async () => {
  // Initialize Database in main process
  try {
    const appPath = app.getPath('userData')
    db.initDatabase(appPath)
    console.log('[SecureVault Main] Database initialized at', appPath)
  } catch (err) {
    console.error('[SecureVault Main] Database initialization failed:', err)
  }

  // Start API server
  try {
    await startServer()
  } catch (err) {
    console.error('[SecureVault Main] Failed to start API server:', err)
  }

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', async () => {
  await stopServer()
  db.closeDatabase()
  if (process.platform !== 'darwin') app.quit()
})

// ─── IPC Handlers ─────────────────────────────────────────────────────────

ipcMain.handle('get-app-path', () => app.getPath('userData'))
ipcMain.handle('app-version',  () => app.getVersion())

ipcMain.on('lock-app', () => {
  setServerLocked(true, null)
  mainWindow?.webContents.send('force-lock')
})

// Called by renderer after successful unlock to sync key with server
ipcMain.handle('set-unlocked', (_event, encKeyHex: string) => {
  const key = Buffer.from(encKeyHex, 'hex')
  setServerLocked(false, key)
})

// Called by renderer on lock
ipcMain.handle('set-locked', () => {
  setServerLocked(true, null)
})

// ─── Database IPC Handlers ────────────────────────────────────────────────

ipcMain.handle('db-get-setting', (_event, key: string) => db.getSetting(key))
ipcMain.handle('db-set-setting', (_event, key: string, value: string) => db.setSetting(key, value))

// Credentials
ipcMain.handle('db-get-all-credentials', (_event, encKeyHex: string) => {
  const key = Buffer.from(encKeyHex, 'hex')
  return db.getAllCredentials(key)
})
ipcMain.handle('db-get-credential-by-id', (_event, id: string, encKeyHex: string) => {
  const key = Buffer.from(encKeyHex, 'hex')
  return db.getCredentialById(id, key)
})
ipcMain.handle('db-create-credential', (_event, data: any, encKeyHex: string) => {
  const key = Buffer.from(encKeyHex, 'hex')
  return db.createCredential(data, key)
})
ipcMain.handle('db-update-credential', (_event, id: string, data: any, encKeyHex: string) => {
  const key = Buffer.from(encKeyHex, 'hex')
  return db.updateCredential(id, data, key)
})
ipcMain.handle('db-delete-credential', (_event, id: string) => {
  db.deleteCredential(id)
})
ipcMain.handle('db-toggle-favorite-credential', (_event, id: string) => {
  db.toggleFavoriteCredential(id)
})
ipcMain.handle('db-update-last-used', (_event, id: string) => {
  db.updateLastUsed(id)
})

// API Keys
ipcMain.handle('db-get-all-api-keys', (_event, encKeyHex: string) => {
  const key = Buffer.from(encKeyHex, 'hex')
  return db.getAllApiKeys(key)
})
ipcMain.handle('db-get-api-key-by-id', (_event, id: string, encKeyHex: string) => {
  const key = Buffer.from(encKeyHex, 'hex')
  return db.getApiKeyById(id, key)
})
ipcMain.handle('db-create-api-key', (_event, data: any, encKeyHex: string) => {
  const key = Buffer.from(encKeyHex, 'hex')
  return db.createApiKey(data, key)
})
ipcMain.handle('db-update-api-key', (_event, id: string, data: any, encKeyHex: string) => {
  const key = Buffer.from(encKeyHex, 'hex')
  return db.updateApiKey(id, data, key)
})
ipcMain.handle('db-delete-api-key', (_event, id: string) => {
  db.deleteApiKey(id)
})
ipcMain.handle('db-toggle-favorite-api-key', (_event, id: string) => {
  db.toggleFavoriteApiKey(id)
})

// Audit Logs
ipcMain.handle('db-add-audit-log', (_event, action: any, details: string | null, success: boolean) => {
  db.addAuditLog(action, details, success)
})
ipcMain.handle('db-get-audit-logs', (_event, limit: number, offset: number) => {
  return db.getAuditLogs(limit, offset)
})
ipcMain.handle('db-clear-audit-log', () => {
  db.clearAuditLog()
})
ipcMain.handle('db-get-audit-log-count', () => {
  return db.getAuditLogCount()
})

// Dashboard Stats & Clear
ipcMain.handle('db-get-dashboard-stats', (_event, encKeyHex: string) => {
  const key = Buffer.from(encKeyHex, 'hex')
  return db.getDashboardStats(key)
})
ipcMain.handle('db-clear-all-data', () => {
  db.clearAllData()
})

// ─── Auth IPC Handlers ────────────────────────────────────────────────────

ipcMain.handle('auth-hash-master-password', (_event, password: string) => {
  return auth.hashMasterPassword(password)
})
ipcMain.handle('auth-verify-master-password', (_event, password: string, storedHash: string) => {
  return auth.verifyMasterPassword(password, storedHash)
})
ipcMain.handle('auth-derive-key', (_event, password: string, salt: string) => {
  return auth.deriveKey(password, salt)
})
ipcMain.handle('auth-change-master-password', (_event, currentPassword: string, newPassword: string, storedHash: string) => {
  return auth.changeMasterPassword(currentPassword, newPassword, storedHash)
})

ipcMain.handle('enc-encrypt-vault-export', (_event, data: string, masterPassword: string) => {
  return encryptVaultExport(data, masterPassword)
})
ipcMain.handle('enc-decrypt-vault-export', (_event, encryptedData: string, masterPassword: string) => {
  return decryptVaultExport(encryptedData, masterPassword)
})

ipcMain.handle('auth-sign-jwt', (_event, payload: any, secret: string, options: any) => {
  return jwt.sign(payload, secret, options)
})

