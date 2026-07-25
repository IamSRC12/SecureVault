import { Buffer } from 'buffer'
import React, { useState, useCallback, useEffect } from 'react'
import {
  Shield, Key, Eye, EyeOff, Copy, Check, RefreshCw, AlertTriangle,
  Download, Upload, Trash2, Circle, Save, Info, Sparkles, Lock, ShieldCheck
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

      await window.electronAPI.db.setSetting('master_password_hash', result.newHash)
      await window.electronAPI.db.setSetting('master_password_salt', result.newSalt)

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
      showToast('Master password changed successfully. Logging out...')
      setCpCurrent(''); setCpNew(''); setCpConfirm('')

      setTimeout(() => lock(), 1500)
    } catch {
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
      // fallback
    }
  }

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
  const strengthColor = strengthOfNew.strength === 'strong' ? '#4ade80' : strengthOfNew.strength === 'medium' ? '#fbbf24' : '#f87171'

  const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'security', label: 'Security', icon: <Shield className="w-4 h-4" /> },
    { id: 'extension', label: 'Extension', icon: <Key className="w-4 h-4" /> },
    { id: 'data', label: 'Vault Data', icon: <Download className="w-4 h-4" /> },
    { id: 'info', label: 'About', icon: <Info className="w-4 h-4" /> },
  ]

  return (
    <div className="p-6 sm:p-8 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-black text-white tracking-tight">Settings</h1>
        <p className="text-xs text-slate-400 mt-1">Manage security, browser extension, and vault data</p>
      </div>

      {/* Tab Nav */}
      <div className="flex items-center gap-2 bg-[#121420]/80 border border-white/10 rounded-2xl p-1.5 shadow-lg">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex-1 py-2.5 px-3 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${
              activeTab === t.id
                ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-500/20'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            {t.icon}
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* Security Tab */}
      {activeTab === 'security' && (
        <div className="space-y-6">
          <Section title="Change Master Password" icon={<Shield className="w-5 h-5 text-indigo-400" />}>
            <div className="space-y-4 max-w-md">
              <PasswordInput id="s-cur-pwd" label="Current Master Password" value={cpCurrent} onChange={setCpCurrent} show={showCpCur} onToggle={() => setShowCpCur(v => !v)} />
              <PasswordInput id="s-new-pwd" label="New Master Password" value={cpNew} onChange={setCpNew} show={showCpNew} onToggle={() => setShowCpNew(v => !v)} />
              {cpNew && (
                <div className="bg-white/[0.03] p-2.5 rounded-xl border border-white/5">
                  <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${strengthOfNew.score}%`, backgroundColor: strengthColor }} />
                  </div>
                </div>
              )}
              <PasswordInput id="s-conf-pwd" label="Confirm New Master Password" value={cpConfirm} onChange={setCpConfirm} show={showCpNew} onToggle={() => setShowCpNew(v => !v)} />
              <button onClick={handleChangePwd} disabled={cpLoading} className="btn-primary mt-2">
                {cpLoading ? 'Updating Password...' : <><Save className="w-4 h-4" /> Save New Password</>}
              </button>
            </div>
          </Section>

          <Section title="Auto-Lock Inactivity Timeout" icon={<Lock className="w-5 h-5 text-amber-400" />}>
            <p className="text-xs text-slate-400 mb-3">Automatically lock your vault after a period of user inactivity.</p>
            <select
              value={autoLockTimeout}
              onChange={async (e) => {
                const val = parseInt(e.target.value)
                setAutoLockTimeout(val)
                await window.electronAPI.db.setSetting('auto_lock_timeout', String(val))
                showToast('Auto-lock timeout updated')
              }}
              className="input-field max-w-xs cursor-pointer font-semibold"
            >
              <option value={0} className="bg-[#141622]">Never Lock</option>
              <option value={1} className="bg-[#141622]">1 Minute Inactivity</option>
              <option value={5} className="bg-[#141622]">5 Minutes Inactivity</option>
              <option value={15} className="bg-[#141622]">15 Minutes Inactivity</option>
              <option value={30} className="bg-[#141622]">30 Minutes Inactivity</option>
              <option value={60} className="bg-[#141622]">1 Hour Inactivity</option>
            </select>
          </Section>
        </div>
      )}

      {/* Extension Tab */}
      {activeTab === 'extension' && (
        <div className="space-y-6">
          <Section title="Chrome Extension Integration" icon={<Key className="w-5 h-5 text-purple-400" />}>
            <div className="space-y-5">
              <div className="flex items-center gap-3 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                <div className="w-3 h-3 rounded-full bg-emerald-400 shadow-[0_0_8px_#22c55e]" />
                <span className="text-xs font-semibold text-emerald-300">Desktop API server listening on localhost:45678</span>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Extension Secret Token</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type={tokenVisible ? 'text' : 'password'}
                      readOnly
                      value={extensionToken || tokenVal || '(unlock vault to generate)'}
                      className="input-field pr-10 font-mono text-xs"
                    />
                    <button onClick={() => setTokenVisible(v => !v)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors">
                      {tokenVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <button onClick={handleCopyToken} className={`btn-secondary px-3.5 ${tokenCopied ? 'border-emerald-500/50 text-emerald-400 bg-emerald-500/10' : ''}`}>
                    {tokenCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button onClick={handleRegenerateToken} className="btn-secondary">
                <RefreshCw className="w-4 h-4" /> Regenerate Token
              </button>
            </div>
          </Section>
        </div>
      )}

      {/* Data Tab */}
      {activeTab === 'data' && (
        <div className="space-y-6">
          <Section title="Export Encrypted Backup" icon={<Download className="w-5 h-5 text-indigo-400" />}>
            <p className="text-xs text-slate-400 mb-4 max-w-lg">
              Download an encrypted JSON snapshot of your credentials and API keys. Requires your master password to decrypt.
            </p>
            <button onClick={handleExport} className="btn-secondary">
              <Download className="w-4 h-4" /> Export Encrypted Vault
            </button>
          </Section>

          <Section title="Import Vault Snapshot" icon={<Upload className="w-5 h-5 text-indigo-400" />}>
            <p className="text-xs text-slate-400 mb-4 max-w-lg">
              Restore credentials from a previously exported `.json` backup file.
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
                  const pwd  = prompt('Enter master password for backup:')
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
                    showToast('Vault restored successfully!')
                  } catch {
                    showToast('Failed to decrypt backup — invalid password?', 'error')
                  }
                }
                input.click()
              }}
              className="btn-secondary"
            >
              <Upload className="w-4 h-4" /> Import Backup File
            </button>
          </Section>

          <Section title="Danger Zone — Wipe Vault" icon={<Trash2 className="w-5 h-5 text-rose-400" />}>
            <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl space-y-3">
              <p className="text-xs text-rose-300 font-medium">
                Warning: This will permanently purge all credentials, API keys, and settings from this machine.
              </p>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={clearInput}
                  onChange={e => setClearInput(e.target.value)}
                  placeholder='Type "DELETE" to confirm'
                  className="input-field flex-1 border-rose-500/30 text-rose-300"
                />
                <button
                  onClick={handleClearData}
                  disabled={clearInput !== 'DELETE'}
                  className="btn-danger disabled:opacity-40"
                >
                  <Trash2 className="w-4 h-4" /> Wipe All Data
                </button>
              </div>
            </div>
          </Section>
        </div>
      )}

      {/* Info Tab */}
      {activeTab === 'info' && (
        <Section title="Security Specs & Diagnostics" icon={<Info className="w-5 h-5 text-indigo-400" />}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <InfoBox label="App Version" value={`v${appVersion}`} />
            <InfoBox label="Vault Encryption" value="AES-256-GCM" />
            <InfoBox label="Key Derivation" value="PBKDF2-SHA256 (100k rounds)" />
            <InfoBox label="Password Hashing" value="Argon2id" />
            <InfoBox label="Storage Engine" value="Local SQLite (WAL Mode)" />
            <InfoBox label="API Binding" value="127.0.0.1:45678 (Localhost)" />
          </div>
        </Section>
      )}

      {/* Toast popup */}
      {toast && (
        <div className={`fixed bottom-6 right-6 flex items-center gap-2 px-4 py-3 rounded-xl text-xs font-bold shadow-2xl animate-in z-50 ${
          toast.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'
        }`}>
          {toast.type === 'success' ? <Check className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          <span>{toast.msg}</span>
        </div>
      )}
    </div>
  )
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }): React.ReactElement {
  return (
    <div className="bg-[#121420]/80 border border-white/10 rounded-2xl p-6 shadow-xl">
      <h2 className="flex items-center gap-2.5 text-sm font-bold text-white mb-4">
        {icon} <span>{title}</span>
      </h2>
      {children}
    </div>
  )
}

function InfoBox({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/5">
      <span className="text-slate-500 block mb-1 font-semibold">{label}</span>
      <span className="text-slate-200 font-bold font-mono">{value}</span>
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
      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">{label}</label>
      <div className="relative">
        <input id={id} type={show ? 'text' : 'password'} value={value}
          onChange={e => onChange(e.target.value)} className="input-field pr-10" />
        <button type="button" onClick={onToggle}
          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors">
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
    </div>
  )
}
