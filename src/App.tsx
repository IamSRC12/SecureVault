import React, { useEffect, useRef } from 'react'
import Setup from './components/Auth/Setup'
import Login from './components/Auth/Login'
import MainLayout from './components/Layout/MainLayout'
import { useAppStore } from './store/appStore'

// ─── Auto-lock timer interval ─────────────────────────────────────────────
const LOCK_CHECK_INTERVAL = 30_000 // 30 seconds

// ─── Root App ─────────────────────────────────────────────────────────────

export default function App(): React.ReactElement {
  const {
    screen,
    isLocked,
    lock,
    setAppPath,
    setAppVersion,
    setSetupComplete,
    setAutoLockTimeout,
    setExtensionToken,
    encryptionKey,
    lastActivity,
    autoLockTimeout,
    updateActivity,
  } = useAppStore()

  const lockTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ─── Initialize app on mount ─────────────────────────────────────────────
  useEffect(() => {
    async function init() {
      try {
        // Get app data path from Electron
        const appPath = await window.electronAPI.getAppPath()
        const version = await window.electronAPI.getAppVersion()

        setAppPath(appPath)
        setAppVersion(version)

        // Check if setup is complete
        const isSetupSetting = await window.electronAPI.db.getSetting('is_setup_complete')
        const isSetup = isSetupSetting === 'true'
        setSetupComplete(isSetup)

        if (!isSetup) {
          useAppStore.getState().setScreen('setup')
        } else {
          useAppStore.getState().setScreen('login')
        }

        // Load settings
        const timeoutSetting = await window.electronAPI.db.getSetting('auto_lock_timeout')
        const timeout = parseInt(timeoutSetting ?? '5', 10)
        setAutoLockTimeout(isNaN(timeout) ? 5 : timeout)
      } catch (err) {
        console.error('App initialization failed:', err)
      }
    }

    init()
  }, [setAppPath, setAppVersion, setSetupComplete, setAutoLockTimeout])

  // ─── Sync lock state with API server ──────────────────────────────────────
  useEffect(() => {
    if (!isLocked && screen === 'main' && encryptionKey) {
      window.electronAPI.setUnlocked(encryptionKey.toString('hex')).catch(() => {})
    } else if (isLocked) {
      window.electronAPI.setLocked().catch(() => {})
    }
  }, [isLocked, screen, encryptionKey])

  // ─── Extension token generation on unlock ────────────────────────────────
  useEffect(() => {
    async function generateToken() {
      if (!isLocked && screen === 'main') {
        try {
          const secret = await window.electronAPI.db.getSetting('master_password_salt') ?? 'securevault-secret'
          const token = await window.electronAPI.auth.signJwt(
            { app: 'securevault', ts: Date.now() },
            secret,
            { expiresIn: '24h' }
          )
          await window.electronAPI.db.setSetting('extension_token', token)
          setExtensionToken(token)
        } catch (err) {
          console.error('Failed to generate extension token:', err)
        }
      } else if (isLocked) {
        // Clear token on lock
        try {
          await window.electronAPI.db.setSetting('extension_token', '')
          setExtensionToken(null)
        } catch {
          // ignore
        }
      }
    }
    generateToken()
  }, [isLocked, screen, setExtensionToken])

  // ─── Auto-lock timer ─────────────────────────────────────────────────────
  useEffect(() => {
    if (isLocked || screen !== 'main') {
      if (lockTimerRef.current) clearInterval(lockTimerRef.current)
      return
    }

    lockTimerRef.current = setInterval(() => {
      if (autoLockTimeout === 0) return // Never lock

      const inactiveMs    = Date.now() - lastActivity
      const timeoutMs     = autoLockTimeout * 60 * 1000

      if (inactiveMs >= timeoutMs) {
        window.electronAPI.db.addAuditLog('LOCK', 'Auto-locked due to inactivity', true).catch(() => {})
        lock()
      }
    }, LOCK_CHECK_INTERVAL)

    return () => {
      if (lockTimerRef.current) clearInterval(lockTimerRef.current)
    }
  }, [isLocked, screen, lock, lastActivity, autoLockTimeout])

  // ─── Force lock from Electron main process ────────────────────────────────
  useEffect(() => {
    window.electronAPI.onForceLock(() => {
      window.electronAPI.db.addAuditLog('LOCK', 'Locked by user', true).catch(() => {})
      lock()
    })

    return () => {
      window.electronAPI.removeForceLockListener()
    }
  }, [lock])

  // ─── Global activity tracking ─────────────────────────────────────────────
  useEffect(() => {
    const handler = () => updateActivity()
    const events  = ['mousedown', 'keydown', 'scroll', 'touchstart']
    events.forEach(e => window.addEventListener(e, handler, { passive: true }))
    return () => events.forEach(e => window.removeEventListener(e, handler))
  }, [updateActivity])

  // ─── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ctrl+L = Lock
      if ((e.ctrlKey || e.metaKey) && e.key === 'l' && screen === 'main') {
        e.preventDefault()
        window.electronAPI.db.addAuditLog('LOCK', 'Locked via keyboard shortcut', true).catch(() => {})
        lock()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [screen, lock])

  // ─── Render ───────────────────────────────────────────────────────────────

  if (screen === 'setup') return <Setup />
  if (screen === 'login') return <Login />
  if (screen === 'main')  return <MainLayout />

  // Fallback loading state
  return (
    <div className="flex items-center justify-center h-screen bg-[#0f0f0f]">
      <div className="flex items-center gap-3 text-[#94a3b8]">
        <svg className="animate-spin h-5 w-5 text-[#6366f1]" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        Initializing SecureVault...
      </div>
    </div>
  )
}
