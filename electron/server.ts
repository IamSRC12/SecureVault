import express, { Request, Response, NextFunction } from 'express'
import cors from 'cors'
import rateLimit from 'express-rate-limit'
import jwt from 'jsonwebtoken'
import { v4 as uuidv4 } from 'uuid'
import http from 'http'

import {
  getSetting,
  getCredentialsByDomain,
  createCredential,
  updateCredential,
  updateLastUsed,
  deleteCredential,
  addAuditLog,
} from '../src/services/database'
import { verifyMasterPassword, deriveKey } from '../src/services/auth'
import { evaluatePasswordStrength } from '../src/services/encryption'

// ─── Types ────────────────────────────────────────────────────────────────

interface AuthenticatedRequest extends Request {
  extensionToken?: string
  encryptionKey?:  Buffer | null
}

// ─── In-memory app state (set by renderer via IPC) ────────────────────────

let appLocked      = true
let encryptionKey: Buffer | null = null

export function setServerLocked(locked: boolean, key: Buffer | null = null): void {
  appLocked     = locked
  encryptionKey = key
}

export function getServerLocked(): boolean {
  return appLocked
}

// ─── Express App ──────────────────────────────────────────────────────────

export function createServer(): http.Server {
  const app = express()

  // Only accept localhost connections (handled by listening on 127.0.0.1)
  app.use((req: Request, res: Response, next: NextFunction) => {
    const ip = req.socket.remoteAddress
    if (ip !== '127.0.0.1' && ip !== '::1' && ip !== '::ffff:127.0.0.1') {
      res.status(403).json({ success: false, error: 'Forbidden: only localhost connections accepted' })
      return
    }
    next()
  })

  // CORS — allow chrome-extension:// origins and localhost
  app.use(cors({
    origin: (origin, callback) => {
      if (
        !origin ||
        origin.startsWith('chrome-extension://') ||
        origin.startsWith('http://localhost') ||
        origin.startsWith('http://127.0.0.1')
      ) {
        callback(null, true)
      } else {
        callback(new Error('Not allowed by CORS'))
      }
    },
    credentials: true,
  }))

  app.use(express.json({ limit: '1mb' }))

  // Rate limiter — 100 req/min
  app.use(rateLimit({
    windowMs: 60_000,
    max:      100,
    standardHeaders: true,
    legacyHeaders:   false,
    message: { success: false, error: 'Too many requests' },
  }))

  // ─── Public routes ─────────────────────────────────────────────────────

  // GET /api/status — no auth required
  app.get('/api/status', (_req: Request, res: Response) => {
    res.json({ running: true, locked: appLocked, version: '1.0.0' })
  })

  // POST /api/auth/token — verify master password and return extension token
  app.post('/api/auth/token', async (req: Request, res: Response) => {
    const { masterPassword } = req.body as { masterPassword?: string }
    if (!masterPassword) {
      res.status(400).json({ success: false, error: 'masterPassword is required' })
      return
    }

    try {
      const storedHash = getSetting('master_password_hash') ?? ''
      const correct    = await verifyMasterPassword(masterPassword, storedHash)

      if (!correct) {
        addAuditLog('LOGIN_FAILED', 'Extension login attempt', false)
        res.status(401).json({ success: false, error: 'Incorrect password' })
        return
      }

      const token = getSetting('extension_token') ?? ''
      addAuditLog('LOGIN_SUCCESS', 'Extension login', true)
      res.json({ success: true, token })
    } catch (err) {
      res.status(500).json({ success: false, error: 'Internal error' })
    }
  })

  // POST /api/lock — lock the app
  app.post('/api/lock', (_req: Request, res: Response) => {
    setServerLocked(true, null)
    addAuditLog('LOCK', 'Locked via API', true)
    res.json({ success: true })
  })

  // ─── Auth middleware ────────────────────────────────────────────────────

  function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
    const authHeader = req.headers.authorization
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ success: false, error: 'Missing authorization token' })
      return
    }

    const token = authHeader.slice(7)

    // Verify JWT
    const storedSalt = getSetting('master_password_salt') ?? 'securevault-secret'
    try {
      jwt.verify(token, storedSalt)
    } catch (err) {
      res.status(401).json({ success: false, error: 'Invalid or expired token' })
      return
    }

    // Check it matches stored token
    const storedToken = getSetting('extension_token') ?? ''
    if (!storedToken || token !== storedToken) {
      res.status(401).json({ success: false, error: 'Token mismatch' })
      return
    }

    // Check app is not locked
    if (appLocked || !encryptionKey) {
      res.status(401).json({ success: false, error: 'App is locked' })
      return
    }

    req.encryptionKey = encryptionKey
    next()
  }

  // ─── Protected routes ───────────────────────────────────────────────────

  // GET /api/credentials?domain=example.com
  app.get('/api/credentials', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
    const domain = req.query['domain'] as string | undefined
    if (!domain) {
      res.status(400).json({ success: false, error: 'domain query param required' })
      return
    }

    try {
      const creds = getCredentialsByDomain(domain, req.encryptionKey!)
      const data  = creds.map(c => ({
        id:           c.id,
        domain:       c.domain,
        website_name: c.website_name,
        username:     c.username,
        email:        c.email,
        password:     c.password,   // Already decrypted by getCredentialsByDomain
        category:     c.category,
      }))

      addAuditLog('EXTENSION_AUTOFILL', `Domain: ${domain}`, true)
      res.json({ success: true, data })
    } catch (err) {
      res.status(500).json({ success: false, error: 'Failed to fetch credentials' })
    }
  })

  // POST /api/credentials/save
  app.post('/api/credentials/save', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
    const { domain, website_name, username, email, password } =
      req.body as {
        domain?: string
        website_name?: string
        username?: string
        email?: string
        password?: string
      }

    if (!domain || !password) {
      res.status(400).json({ success: false, error: 'domain and password are required' })
      return
    }

    try {
      // Check if credential with same domain + username already exists
      const existing = getCredentialsByDomain(domain, req.encryptionKey!)
        .filter(c => (c.username === username || c.email === email) && Boolean(username || email))

      if (existing.length > 0) {
        res.json({ success: true, action: 'exists', existingId: existing[0].id })
        return
      }

      const strength = evaluatePasswordStrength(password)
      const cred = createCredential({
        domain:           domain.replace(/^www\./, ''),
        website_name:     website_name || domain,
        username:         username || null,
        email:            email || null,
        password,
        notes:            null,
        category:         'other',
        favicon_url:      null,
        is_favorite:      0,
        password_strength: strength.strength,
      }, req.encryptionKey!)

      addAuditLog('EXTENSION_SAVE', `Saved: ${domain}`, true)
      res.json({ success: true, action: 'created', id: cred.id })
    } catch (err) {
      res.status(500).json({ success: false, error: 'Failed to save credential' })
    }
  })

  // PUT /api/credentials/update/:id
  app.put('/api/credentials/update/:id', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params
    const { domain, website_name, username, email, password } = req.body as {
      domain?: string
      website_name?: string
      username?: string
      email?: string
      password?: string
    }

    if (!id) {
      res.status(400).json({ success: false, error: 'id is required' })
      return
    }

    try {
      const strength = password ? evaluatePasswordStrength(password) : null
      updateCredential(id, {
        domain:            domain?.replace(/^www\./, ''),
        website_name,
        username:          username || null,
        email:             email || null,
        password,
        password_strength: strength?.strength,
      }, req.encryptionKey!)

      addAuditLog('EXTENSION_SAVE', `Updated: ${id}`, true)
      res.json({ success: true })
    } catch (err) {
      res.status(500).json({ success: false, error: 'Failed to update credential' })
    }
  })

  // POST /api/credentials/last-used/:id
  app.post('/api/credentials/last-used/:id', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
    try {
      updateLastUsed(req.params.id)
      res.json({ success: true })
    } catch {
      res.status(500).json({ success: false, error: 'Failed to update last used' })
    }
  })

  // DELETE /api/credentials/:id
  app.delete('/api/credentials/:id', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
    try {
      deleteCredential(req.params.id)
      addAuditLog('DELETE_PASSWORD', `Deleted via API: ${req.params.id}`, true)
      res.json({ success: true })
    } catch {
      res.status(500).json({ success: false, error: 'Failed to delete credential' })
    }
  })

  // ─── Start Server ───────────────────────────────────────────────────────
  const server = http.createServer(app)
  return server
}

// ─── Start / Stop helpers ─────────────────────────────────────────────────

let httpServer: http.Server | null = null

export function startServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      httpServer = createServer()
      httpServer.listen(45678, '127.0.0.1', () => {
        console.log('[SecureVault API] Server listening on http://127.0.0.1:45678')
        resolve()
      })
      httpServer.on('error', reject)
    } catch (err) {
      reject(err)
    }
  })
}

export function stopServer(): Promise<void> {
  return new Promise((resolve) => {
    if (!httpServer) return resolve()
    httpServer.close(() => resolve())
    httpServer = null
  })
}
