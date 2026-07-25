import React, { useState, useCallback, useEffect } from 'react'
import { Shield, Eye, EyeOff, Check, X, AlertTriangle } from 'lucide-react'
import { evaluatePasswordStrength } from '../../services/passwordUtils'
import { useAppStore } from '../../store/appStore'
import type { PasswordStrengthResult } from '../../types'

// ─── Setup Screen ─────────────────────────────────────────────────────────

export default function Setup(): React.ReactElement {
  const { unlock, setSetupComplete } = useAppStore()

  const [password, setPassword]     = useState('')
  const [confirm, setConfirm]       = useState('')
  const [showPass, setShowPass]     = useState(false)
  const [showConf, setShowConf]     = useState(false)
  const [isLoading, setIsLoading]   = useState(false)
  const [error, setError]           = useState('')

  const strength: PasswordStrengthResult = evaluatePasswordStrength(password)

  const passwordsMatch  = password === confirm && confirm.length > 0
  const meetsMinReqs    = strength.checks.minLength &&
                          strength.checks.uppercase &&
                          strength.checks.numbers &&
                          strength.checks.symbols
  const canCreate       = meetsMinReqs && passwordsMatch && !isLoading

  const handleCreate = useCallback(async () => {
    if (!canCreate) return
    setIsLoading(true)
    setError('')

    try {
      const { hash, salt } = await window.electronAPI.auth.hashMasterPassword(password)

      // Store hash + salt (NOT the password itself)
      await window.electronAPI.db.setSetting('master_password_hash', hash)
      await window.electronAPI.db.setSetting('master_password_salt', salt)
      await window.electronAPI.db.setSetting('is_setup_complete', 'true')

      // Derive encryption key and unlock
      const encKeyUint8 = await window.electronAPI.auth.deriveKey(password, salt)
      const encKey = Buffer.from(encKeyUint8)

      await window.electronAPI.db.addAuditLog('SETUP_COMPLETE', 'Initial vault setup completed', true)

      setSetupComplete(true)
      unlock(encKey)
    } catch (err) {
      setError('Setup failed. Please try again.')
      setIsLoading(false)
    }
  }, [canCreate, password, unlock, setSetupComplete])

  // Allow Enter key to submit
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && canCreate) handleCreate()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [canCreate, handleCreate])

  const strengthColor =
    strength.strength === 'strong'  ? '#22c55e' :
    strength.strength === 'medium'  ? '#f59e0b' : '#ef4444'

  const strengthLabel =
    strength.strength === 'strong'  ? 'Strong' :
    strength.strength === 'medium'  ? 'Medium' : 'Weak'

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
          <p className="text-[#94a3b8] mt-2">Your passwords, protected forever</p>
        </div>

        {/* Card */}
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl p-8">
          <h2 className="text-xl font-semibold text-[#f1f5f9] mb-1">Create Your Vault</h2>
          <p className="text-[#94a3b8] text-sm mb-6">
            Choose a strong master password. This cannot be recovered if lost.
          </p>

          {/* Master Password */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-[#94a3b8] mb-2">
              Create Master Password
            </label>
            <div className="relative">
              <input
                id="setup-password"
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter master password"
                className="input-field pr-12"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPass(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#475569] hover:text-[#94a3b8] transition-colors"
              >
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {/* Strength bar */}
            {password.length > 0 && (
              <div className="mt-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-[#475569]">Strength</span>
                  <span className="text-xs font-medium" style={{ color: strengthColor }}>
                    {strengthLabel}
                  </span>
                </div>
                <div className="h-1.5 bg-[#2a2a2a] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{ width: `${strength.score}%`, backgroundColor: strengthColor }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Confirm Password */}
          <div className="mb-5">
            <label className="block text-sm font-medium text-[#94a3b8] mb-2">
              Confirm Master Password
            </label>
            <div className="relative">
              <input
                id="setup-confirm"
                type={showConf ? 'text' : 'password'}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Confirm master password"
                className={`input-field pr-12 ${
                  confirm.length > 0 && !passwordsMatch
                    ? 'border-[#ef4444] focus:border-[#ef4444] focus:ring-[#ef4444]/30'
                    : ''
                }`}
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowConf(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#475569] hover:text-[#94a3b8] transition-colors"
              >
                {showConf ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {confirm.length > 0 && !passwordsMatch && (
              <p className="text-[#ef4444] text-xs mt-1">Passwords do not match</p>
            )}
          </div>

          {/* Requirements checklist */}
          {password.length > 0 && (
            <div className="mb-5 bg-[#0f0f0f] rounded-lg p-3 space-y-1.5">
              <RequirementCheck met={strength.checks.minLength} label="At least 8 characters" />
              <RequirementCheck met={strength.checks.uppercase}  label="Contains uppercase letter" />
              <RequirementCheck met={strength.checks.numbers}    label="Contains a number" />
              <RequirementCheck met={strength.checks.symbols}    label="Contains special character" />
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mb-4 flex items-center gap-2 text-[#ef4444] text-sm bg-[#ef4444]/10 rounded-lg p-3">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Create Button */}
          <button
            id="create-vault-btn"
            onClick={handleCreate}
            disabled={!canCreate}
            className="btn-primary w-full justify-center py-3 text-base"
          >
            {isLoading ? (
              <>
                <LoadingSpinner />
                Creating Vault...
              </>
            ) : (
              <>
                <Shield className="w-5 h-5" />
                Create Vault
              </>
            )}
          </button>

          {/* Warning */}
          <div className="mt-5 flex items-start gap-2 text-[#f59e0b] text-xs bg-[#f59e0b]/10 rounded-lg p-3">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <span>
              This password <strong>cannot be recovered</strong>. If you forget it, all data will
              be permanently lost. Store it somewhere safe.
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────

function RequirementCheck({ met, label }: { met: boolean; label: string }): React.ReactElement {
  return (
    <div className="flex items-center gap-2">
      {met ? (
        <Check className="w-3.5 h-3.5 text-[#22c55e] flex-shrink-0" />
      ) : (
        <X className="w-3.5 h-3.5 text-[#475569] flex-shrink-0" />
      )}
      <span className={`text-xs ${met ? 'text-[#22c55e]' : 'text-[#475569]'}`}>{label}</span>
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
