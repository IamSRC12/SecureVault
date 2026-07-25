import React, { useState, useCallback, useEffect } from 'react'
import {
  Shield, Key, Eye, EyeOff, Copy, Check, RefreshCw, AlertTriangle,
  Download, Upload, Trash2, Circle, Save, Info,
} from 'lucide-react'
import { evaluatePasswordStrength } from '../../services/passwordUtils'
import { useAppStore } from '../../store/appStore'

type Tab = 'security' | 'extension' | 'data' | 'info'

export default function SettingsView(): React.ReactElement {
  const {
    encryptionKey, setAutoLockTimeout, autoLockTimeout,
    appVersion, extensionToken, setExtensionToken, lock,
  } = useAppStore()

  const [activeTab,    setActiveTab]    = useState<Tab>('security')
  const [toast,        setToast]        = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  // Change Master Password state
  const [cpCurrent,   setCpCurrent]    = useState('')
  const [cpNew,       setCpNew]        = useState('')
  const [cpConfirm,   setCpConfirm]    = useState('')
  const [cpLoading,   setCpLoading]    = useState(false)
  const [showCpCur,   setShowCpCur]    = useState(false)
  const [showCpNew,   setShowCpNew]    = useState(false)

  // Extension
  const [tokenVisible, setTokenVisible] = useState(false)
  const [tokenCopied,  setTokenCopied]  = useState(false)

  // Data
  const [clearInput,  setClearInput]   = useState('')
  const [clearConfirm, setClearConfirm] = useState(false)

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  // ─── Change Master Password ─────────────────────────────────────────────
  const handleChangePwd = useCallback(async () => {
    if (!cpCurrent || !cpNew || !cpConfirm) return showToast('All fields required', 'error')
    if (cpNew !== cpConfirm) return showToast('New passwords do not match', 'error')

    const str = evaluatePasswordStrength(cpNew)
    if (str.strength === 'weak') return showToast('New password is too weak', 'error')

    setCpLoading(true)
    try {
      const storedHash = await window.electronAPI.db.getSetting('master_password_hash') ?? ''
      const result = await window.electronAPI.auth.changeMasterPassword(cpCurrent, cpNew, storedHash)

      if (!result) return showToast('Current password is incorrect', 'error')

      // Save new hash + salt
      await window.electronAPI.db.setSetting('master_password_hash', result.newHash)
      await window.electronAPI.db.setSetting('master_password_salt', result.newSalt)

      // Re-encrypt all credentials with new key
      if (encryptionKey) {
        const keyHex = encryptionKey.toString('hex')
        const creds = await window.electronAPI.db.getAllCredentials(keyHex)
        const newKeyHex = Buffer.from(result.newKey).toString('hex')
        
        for (const c of creds) {
          await window.electronAPI.db.updateCredential(c.id, { password: c.password, notes: c.notes ?? undefined }, newKeyHex)
        }
        const keys = await window.electronAPI.db.getAllApiKeys(keyHex)
        for (const k of keys) {
          await window.electronAPI.db.updateApiKey(k.id, { api_key: k.api_key, secret_key: k.secret_key ?? undefined }, newKeyHex)
        }
      }

      await window.electronAPI.db.addAuditLog('CHANGE_MASTER_PASSWORD', null, true)
      showToast('Master password changed successfully. Please log in again.')
      setCpCurrent(''); setCpNew(''); setCpConfirm('')

      // Force re-login
      setTimeout(() => lock(), 1500)
    } catch (err) {
      showToast('Failed to change password', 'error')
    } finally {
      setCpLoading(false)
    }
  }, [cpCurrent, cpNew, cpConfirm, encryptionKey, lock])

  // ─── Regenerate Extension Token ─────────────────────────────────────────
  const handleRegenerateToken = async () => {
    try {
      const saltSetting = await window.electronAPI.db.getSetting('master_password_salt')
      const secret = saltSetting ?? 'securevault-secret'
      const token = await window.electronAPI.auth.signJwt({ app: 'securevault', ts: Date.now() }, secret, { expiresIn: '24h' })
      await window.electronAPI.db.setSetting('extension_token', token)
      setExtensionToken(token)
      await window.electronAPI.db.addAuditLog('REGENERATE_TOKEN', null, true)
      showToast('Extension token regenerated')
    } catch {
      showToast('Failed to regenerate token', 'error')
    }
  }

  const handleCopyToken = async () => {
    try {
      const tokenSetting = await window.electronAPI.db.getSetting('extension_token')
      const t = extensionToken || tokenSetting || ''
      await navigator.clipboard.writeText(t)
      setTokenCopied(true)
      setTimeout(() => setTokenCopied(false), 2000)
    } catch {
      // ignore
    }
  }

  // ─── Extension Token Setup ──────────────────────────────────────────────
  const [tokenVal, setTokenVal] = useState('')
  useEffect(() => {
    async function loadToken() {
      const t = await window.electronAPI.db.getSetting('extension_token')
      setTokenVal(t || '')
    }
    loadToken()
  }, [extensionToken])

  // ─── Export Vault ───────────────────────────────────────────────────────
  const handleExport = async () => {
    if (!encryptionKey) return showToast('Vault is locked', 'error')

    try {
      const keyHex = encryptionKey.toString('hex')
      const creds   = await window.electronAPI.db.getAllCredentials(keyHex)
      const apiKeys = await window.electronAPI.db.getAllApiKeys(keyHex)

      const masterPwd = prompt('Enter master password to encrypt backup:')
      if (!masterPwd) return

      const exportData = JSON.stringify({ version: appVersion, exportDate: new Date().toISOString(), credentials: creds, apiKeys })
      const encrypted  = await window.electronAPI.auth.encryptVaultExport(exportData, masterPwd)

      const blob = new Blob([encrypted], { type: 'text/plain' })
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `securevault-backup-${new Date().toISOString().split('T')[0]}.json`
      a.click()
      URL.revokeObjectURL(url)

      await window.electronAPI.db.addAuditLog('EXPORT_VAULT', null, true)
      showToast('Vault exported successfully')
    } catch {
      showToast('Export failed', 'error')
    }
  }

  // ─── Clear All Data ─────────────────────────────────────────────────────
  const handleClearData = async () => {
    if (clearInput !== 'DELETE') return showToast('Type DELETE to confirm', 'error')
    await window.electronAPI.db.clearAllData()
    await window.electronAPI.db.addAuditLog('CLEAR_DATA', 'All data cleared', true)
    setTimeout(() => lock(), 500)
  }

  const strengthOfNew = evaluatePasswordStrength(cpNew)
  const strengthColor = strengthOfNew.strength === 'strong' ? '#22c55e' : strengthOfNew.strength === 'medium' ? '#f59e0b' : '#ef4444'

  const TABS: { id: Tab; label: string }[] = [
    { id: 'security', label: 'Security' },
    { id: 'extension', label: 'Extension' },
    { id: 'data', label: 'Data' },
    { id: 'info', label: 'Info' },
  ]

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-2xl font-bold text-[#f1f5f9] mb-6">Settings</h1>

      {/* Tab nav */}
      <div className="flex items-center gap-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-1 mb-6">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
              activeTab === t.id ? 'bg-[#6366f1] text-white' : 'text-[#94a3b8] hover:text-[#f1f5f9]'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Security Tab ──────────────────────────────────────────────────── */}
      {activeTab === 'security' && (
        <div className="space-y-6">
          {/* Change Master Password */}
          <Section title="Change Master Password" icon={<Shield className="w-4 h-4 text-[#6366f1]" />}>
            <div className="space-y-3">
              <PasswordInput id="s-cur-pwd" label="Current Password" value={cpCurrent} onChange={setCpCurrent} show={showCpCur} onToggle={() => setShowCpCur(v => !v)} />
              <PasswordInput id="s-new-pwd" label="New Password" value={cpNew} onChange={setCpNew} show={showCpNew} onToggle={() => setShowCpNew(v => !v)} />
              {cpNew && (
                <div className="mt-1">
                  <div className="h-1 bg-[#2a2a2a] rounded-full">
                    <div className="h-full rounded-full transition-all" style={{ width: `${strengthOfNew.score}%`, backgroundColor: strengthColor }} />
                  </div>
                </div>
              )}
              <PasswordInput id="s-conf-pwd" label="Confirm New Password" value={cpConfirm} onChange={setCpConfirm} show={showCpNew} onToggle={() => setShowCpNew(v => !v)} />
              <button onClick={handleChangePwd} disabled={cpLoading} className="btn-primary">
                {cpLoading ? 'Changing...' : <><Save className="w-4 h-4" /> Change Password</>}
              </button>
            </div>
          </Section>

          {/* Auto-lock */}
          <Section title="Auto-Lock Timeout" icon={<Shield className="w-4 h-4 text-[#f59e0b]" />}>
            <select
              value={autoLockTimeout}
              onChange={async (e) => {
                const val = parseInt(e.target.value)
                setAutoLockTimeout(val)
                await window.electronAPI.db.setSetting('auto_lock_timeout', String(val))
              }}
              className="input-field w-auto"
            >
              <option value={0}>Never</option>
              <option value={1}>1 minute</option>
              <option value={5}>5 minutes</option>
              <option value={15}>15 minutes</option>
              <option value={30}>30 minutes</option>
              <option value={60}>1 hour</option>
            </select>
          </Section>
        </div>
      )}

      {/* ── Extension Tab ─────────────────────────────────────────────────── */}
      {activeTab === 'extension' && (
        <div className="space-y-6">
          <Section title="Extension Connection" icon={<Key className="w-4 h-4 text-[#6366f1]" />}>
            <div className="space-y-4">
              <div className="flex items-center gap-2 p-3 bg-[#0f0f0f] rounded-lg border border-[#2a2a2a]">
                <Circle className="w-2.5 h-2.5" fill="#22c55e" color="#22c55e" />
                <span className="text-sm text-[#94a3b8]">App is running — extension can connect</span>
              </div>

              {/* Token display */}
              <div>
                <label className="block text-sm font-medium text-[#94a3b8] mb-1.5">Extension Token</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type={tokenVisible ? 'text' : 'password'}
                      readOnly
                      value={extensionToken || tokenVal || '(unlock vault to generate)'}
                      className="input-field pr-10 font-mono text-xs"
                    />
                    <button onClick={() => setTokenVisible(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#475569] hover:text-[#94a3b8]">
                      {tokenVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <button onClick={handleCopyToken} className={`btn-secondary px-3 ${tokenCopied ? 'border-[#22c55e]/30 text-[#22c55e]' : ''}`}>
                    {tokenCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button onClick={handleRegenerateToken} className="btn-secondary">
                <RefreshCw className="w-4 h-4" /> Regenerate Token
              </button>

              <div className="p-3 bg-[#6366f1]/5 border border-[#6366f1]/20 rounded-lg text-xs text-[#94a3b8]">
                <p className="font-medium text-[#6366f1] mb-1">How to connect:</p>
                <ol className="space-y-1 list-decimal list-inside">
                  <li>Copy the token above</li>
                  <li>Click the SecureVault icon in your browser</li>
                  <li>Paste the token in the extension settings</li>
                </ol>
              </div>
            </div>
          </Section>
        </div>
      )}

      {/* ── Data Tab ──────────────────────────────────────────────────────── */}
      {activeTab === 'data' && (
        <div className="space-y-6">
          <Section title="Export Vault" icon={<Download className="w-4 h-4 text-[#6366f1]" />}>
            <p className="text-sm text-[#94a3b8] mb-3">
              Download an encrypted backup of your vault. You&apos;ll need your master password to restore it.
            </p>
            <button onClick={handleExport} className="btn-secondary">
              <Download className="w-4 h-4" /> Export Vault
            </button>
          </Section>

          <Section title="Import Vault" icon={<Upload className="w-4 h-4 text-[#6366f1]" />}>
            <p className="text-sm text-[#94a3b8] mb-3">
              Restore from a SecureVault backup file.
            </p>
            <button
              onClick={() => {
                const input = document.createElement('input')
                input.type = 'file'
                input.accept = '.json'
                input.onchange = async (e) => {
                  const file = (e.target as HTMLInputElement).files?.[0]
                  if (!file) return
                  const text = await file.text()
                  const pwd  = prompt('Enter master password for this backup:')
                  if (!pwd) return
                  try {
                    const decrypted = await window.electronAPI.auth.decryptVaultExport(text, pwd)
                    const parsed = JSON.parse(decrypted)
                    
                    if (encryptionKey) {
                      const keyHex = encryptionKey.toString('hex')
                      if (parsed.credentials && Array.isArray(parsed.credentials)) {
                        for (const c of parsed.credentials) {
                          await window.electronAPI.db.createCredential(c, keyHex)
                        }
                      }
                      if (parsed.apiKeys && Array.isArray(parsed.apiKeys)) {
                        for (const k of parsed.apiKeys) {
                          await window.electronAPI.db.createApiKey(k, keyHex)
                        }
                      }
                    }
                    
                    showToast('Import successful!')
                    await window.electronAPI.db.addAuditLog('IMPORT_VAULT', file.name, true)
                  } catch (err) {
                    showToast('Failed to decrypt backup — wrong password?', 'error')
                  }
                }
                input.click()
              }}
              className="btn-secondary"

            >
              <Upload className="w-4 h-4" /> Import Vault
            </button>
          </Section>

          <Section title="Clear All Data" icon={<Trash2 className="w-4 h-4 text-[#ef4444]" />}>
            <div className="p-4 bg-[#ef4444]/5 border border-[#ef4444]/20 rounded-lg">
              <p className="text-sm text-[#94a3b8] mb-3">
                <span className="text-[#ef4444] font-medium">Warning:</span> This permanently deletes ALL data including passwords, API keys, and settings. This cannot be undone.
              </p>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={clearInput}
                  onChange={e => setClearInput(e.target.value)}
                  placeholder='Type "DELETE" to confirm'
                  className="input-field flex-1 border-[#ef4444]/30"
                />
                <button
                  onClick={handleClearData}
                  disabled={clearInput !== 'DELETE'}
                  className="btn-danger disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Trash2 className="w-4 h-4" /> Clear Everything
                </button>
              </div>
            </div>
          </Section>
        </div>
      )}

      {/* ── Info Tab ──────────────────────────────────────────────────────── */}
      {activeTab === 'info' && (
        <div className="space-y-4">
          <Section title="About SecureVault" icon={<Info className="w-4 h-4 text-[#6366f1]" />}>
            <div className="space-y-3 text-sm text-[#94a3b8]">
              <p>Version: <span className="text-[#f1f5f9] font-medium">v{appVersion}</span></p>
              <p>Encryption: <span className="text-[#f1f5f9]">AES-256-GCM</span></p>
              <p>Key Derivation: <span className="text-[#f1f5f9]">PBKDF2-SHA256 (100,000 iterations)</span></p>
              <p>Password Hashing: <span className="text-[#f1f5f9]">argon2id</span></p>
              <p>Database: <span className="text-[#f1f5f9]">SQLite (local only)</span></p>
            </div>
          </Section>
        </div>
      )}

      {/* Toast notification */}
      {toast && (
        <div className={`fixed bottom-6 right-6 flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium shadow-xl animate-in ${
          toast.type === 'success'
            ? 'bg-[#22c55e] text-white'
            : 'bg-[#ef4444] text-white'
        }`}>
          {toast.type === 'success' ? <Check className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}
    </div>
  )
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }): React.ReactElement {
  return (
    <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-5">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-[#f1f5f9] mb-4">
        {icon} {title}
      </h2>
      {children}
    </div>
  )
}

function PasswordInput({
  id, label, value, onChange, show, onToggle,
}: {
  id: string; label: string; value: string; onChange: (v: string) => void; show: boolean; onToggle: () => void
}): React.ReactElement {
  return (
    <div>
      <label className="block text-xs font-medium text-[#94a3b8] mb-1">{label}</label>
      <div className="relative">
        <input id={id} type={show ? 'text' : 'password'} value={value}
          onChange={e => onChange(e.target.value)} className="input-field pr-10" />
        <button type="button" onClick={onToggle}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-[#475569] hover:text-[#94a3b8]">
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
    </div>
  )
}
