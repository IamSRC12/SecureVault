import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Shield, Eye, EyeOff, AlertTriangle, Clock } from 'lucide-react'
import { useAppStore } from '../../store/appStore'

const MAX_WRONG_ATTEMPTS = 5
const LOCKOUT_MINUTES   = 5

// ─── Login Screen ─────────────────────────────────────────────────────────

export default function Login(): React.ReactElement {
  const { unlock } = useAppStore()

  const [password, setPassword]       = useState('')
  const [showPass, setShowPass]       = useState(false)
  const [isLoading, setIsLoading]     = useState(false)
  const [error, setError]             = useState('')
  const [shake, setShake]             = useState(false)
  const [attempts, setAttempts]       = useState(0)
  const [lockedUntil, setLockedUntil] = useState<Date | null>(null)
  const [timeLeft, setTimeLeft]       = useState(0)

  const inputRef = useRef<HTMLInputElement>(null)

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Countdown timer for lockout
  useEffect(() => {
    if (!lockedUntil) return

    const tick = setInterval(() => {
      const remaining = Math.ceil((lockedUntil.getTime() - Date.now()) / 1000)
      if (remaining <= 0) {
        setLockedUntil(null)
        setTimeLeft(0)
        setAttempts(0)
        clearInterval(tick)
      } else {
        setTimeLeft(remaining)
      }
    }, 1000)

    return () => clearInterval(tick)
  }, [lockedUntil])

  const triggerShake = useCallback(() => {
    setShake(true)
    setTimeout(() => setShake(false), 600)
  }, [])

  const handleUnlock = useCallback(async () => {
    if (!password || isLoading || lockedUntil) return

    setIsLoading(true)
    setError('')

    try {
      const storedHash = await window.electronAPI.db.getSetting('master_password_hash') ?? ''
      const storedSalt = await window.electronAPI.db.getSetting('master_password_salt') ?? ''

      const correct = await window.electronAPI.auth.verifyMasterPassword(password, storedHash)

      if (correct) {
        const encKeyUint8 = await window.electronAPI.auth.deriveKey(password, storedSalt)
        const encKey = Buffer.from(encKeyUint8)
        await window.electronAPI.db.addAuditLog('LOGIN_SUCCESS', null, true)
        setAttempts(0)
        unlock(encKey)
      } else {
        const newAttempts = attempts + 1
        setAttempts(newAttempts)

        await window.electronAPI.db.addAuditLog('LOGIN_FAILED', `Attempt ${newAttempts}`, false)

        if (newAttempts >= MAX_WRONG_ATTEMPTS) {
          const lockUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000)
          setLockedUntil(lockUntil)
          setError(`Too many failed attempts. Locked for ${LOCKOUT_MINUTES} minutes.`)
        } else if (newAttempts >= 3) {
          setError(`Incorrect password. ${MAX_WRONG_ATTEMPTS - newAttempts} attempts remaining.`)
        } else {
          setError('Incorrect password. Please try again.')
        }

        triggerShake()
        setPassword('')
      }
    } catch (err) {
      setError('An error occurred. Please try again.')
      triggerShake()
    } finally {
      setIsLoading(false)
    }
  }, [password, isLoading, lockedUntil, attempts, unlock, triggerShake])

  // Enter key handler
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && password && !lockedUntil) handleUnlock()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleUnlock, password, lockedUntil])

  const isLocked = Boolean(lockedUntil)

  return (
    <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center p-6">
      <div className="w-full max-w-md animate-in">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-[#6366f1]/10 border border-[#6366f1]/20 mb-5">
            <Shield className="w-10 h-10 text-[#6366f1]" />
          </div>
          <h1 className="text-3xl font-bold text-[#f1f5f9]">
            Secure<span className="text-gradient">Vault</span>
          </h1>
          <p className="text-[#94a3b8] mt-2">Welcome back</p>
        </div>

        {/* Card */}
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl p-8">
          <h2 className="text-xl font-semibold text-[#f1f5f9] mb-1">Unlock Your Vault</h2>
          <p className="text-[#94a3b8] text-sm mb-6">Enter your master password to continue</p>

          {/* Lockout message */}
          {isLocked && (
            <div className="mb-4 flex items-center gap-2 text-[#f59e0b] bg-[#f59e0b]/10 rounded-lg p-3">
              <Clock className="w-4 h-4 flex-shrink-0" />
              <span className="text-sm">
                Locked due to too many failed attempts.
                Try again in <strong>{Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}</strong>
              </span>
            </div>
          )}

          {/* Password field */}
          <div className="mb-5">
            <label className="block text-sm font-medium text-[#94a3b8] mb-2">
              Master Password
            </label>
            <div className={`relative ${shake ? 'animate-[shake_0.5s_ease-in-out]' : ''}`}>
              <input
                ref={inputRef}
                id="login-password"
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError('') }}
                placeholder="Enter master password"
                disabled={isLocked || isLoading}
                className={`input-field pr-12 ${
                  error ? 'border-[#ef4444] focus:border-[#ef4444] focus:ring-[#ef4444]/30' : ''
                } ${isLocked ? 'opacity-50 cursor-not-allowed' : ''}`}
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPass(v => !v)}
                disabled={isLocked}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#475569] hover:text-[#94a3b8] transition-colors disabled:opacity-50"
              >
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {/* Error */}
            {error && !isLocked && (
              <div className="mt-2 flex items-center gap-1.5 text-[#ef4444] text-xs">
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                {error}
              </div>
            )}
          </div>

          {/* Attempts warning */}
          {attempts >= 3 && !isLocked && (
            <div className="mb-4 flex items-center gap-2 text-[#f59e0b] text-xs bg-[#f59e0b]/10 rounded-lg p-3">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
              Warning: {MAX_WRONG_ATTEMPTS - attempts} attempt{MAX_WRONG_ATTEMPTS - attempts !== 1 ? 's' : ''} left before lockout
            </div>
          )}

          {/* Unlock button */}
          <button
            id="unlock-btn"
            onClick={handleUnlock}
            disabled={!password || isLoading || isLocked}
            className="btn-primary w-full justify-center py-3 text-base"
          >
            {isLoading ? (
              <>
                <LoadingSpinner />
                Verifying...
              </>
            ) : (
              <>
                <Shield className="w-5 h-5" />
                Unlock Vault
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

function LoadingSpinner(): React.ReactElement {
  return (
    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}
