import React, { useState, useEffect, useCallback } from 'react'
import {
  X, Eye, EyeOff, Copy, Globe, Wand2, Check, Lock, Tag, FileText, User, Mail, ShieldAlert
} from 'lucide-react'
import {
  evaluatePasswordStrength,
  generatePassword,
} from '../../services/passwordUtils'
import { useAppStore } from '../../store/appStore'
import type { Credential, CredentialCategory, CredentialFormData } from '../../types'

// ─── Default generator settings ───────────────────────────────────────────
const DEFAULT_GEN = { length: 20, uppercase: true, lowercase: true, numbers: true, symbols: true, excludeSimilar: false }

const CATEGORIES: CredentialCategory[] = ['social', 'banking', 'work', 'shopping', 'email', 'other']

interface AddPasswordProps {
  credential?: Credential   // Edit mode if provided
  prefillPassword?: string
  onClose:   () => void
  onSaved:   () => void
}

export default function AddPassword({
  credential,
  prefillPassword,
  onClose,
  onSaved,
}: AddPasswordProps): React.ReactElement {
  const { encryptionKey } = useAppStore()
  const isEdit = Boolean(credential)

  const [form, setForm] = useState<CredentialFormData>({
    website_name: credential?.website_name ?? '',
    domain:       credential?.domain       ?? '',
    username:     credential?.username     ?? '',
    email:        credential?.email        ?? '',
    password:     prefillPassword ?? credential?.password ?? '',
    category:     credential?.category     ?? 'other',
    notes:        credential?.notes        ?? '',
    is_favorite:  Boolean(credential?.is_favorite),
  })

  const [showPass, setShowPass] = useState(false)
  const [errors, setErrors]     = useState<Partial<CredentialFormData>>({})
  const [isSaving, setIsSaving] = useState(false)
  const [copied, setCopied]     = useState(false)

  const strength = evaluatePasswordStrength(form.password)

  // Auto-detect domain from website name
  useEffect(() => {
    if (!isEdit && form.website_name && !form.domain) {
      const lower = form.website_name.toLowerCase().replace(/\s+/g, '') + '.com'
      setForm(f => ({ ...f, domain: lower }))
    }
  }, [form.website_name, isEdit])

  const update = (key: keyof CredentialFormData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm(f => ({ ...f, [key]: e.target.value }))

  const handleGenerate = () => {
    const pwd = generatePassword(DEFAULT_GEN)
    setForm(f => ({ ...f, password: pwd }))
  }

  const handleCopy = async () => {
    if (!form.password) return
    await navigator.clipboard.writeText(form.password)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const validate = (): boolean => {
    const errs: Partial<CredentialFormData> = {}
    if (!form.website_name.trim()) errs.website_name = 'Required'
    if (!form.domain.trim())       errs.domain       = 'Required'
    if (!form.password)            errs.password     = 'Required'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSave = useCallback(async () => {
    if (!validate() || !encryptionKey || isSaving) return
    setIsSaving(true)

    try {
      const data = {
        domain:        form.domain.trim().toLowerCase().replace(/^www\./, ''),
        website_name:  form.website_name.trim(),
        username:      form.username || null,
        email:         form.email || null,
        password:      form.password,
        notes:         form.notes || null,
        category:      form.category,
        favicon_url:   null,
        is_favorite:   form.is_favorite ? 1 : 0,
        password_strength: strength.strength,
      }

      const keyHex = encryptionKey.toString('hex')

      if (isEdit && credential) {
        await window.electronAPI.db.updateCredential(credential.id, data, keyHex)
        await window.electronAPI.db.addAuditLog('EDIT_PASSWORD', `Edited: ${data.website_name}`, true)
      } else {
        await window.electronAPI.db.createCredential(data, keyHex)
        await window.electronAPI.db.addAuditLog('ADD_PASSWORD', `Added: ${data.website_name}`, true)
      }

      onSaved()
      onClose()
    } catch {
      setErrors({ website_name: 'Failed to save. Please try again.' })
    } finally {
      setIsSaving(false)
    }
  }, [form, credential, isEdit, encryptionKey, isSaving, onSaved, onClose, strength.strength])

  const strengthColor =
    strength.strength === 'strong' ? '#4ade80' :
    strength.strength === 'medium' ? '#fbbf24' : '#f87171'

  // Close on Escape
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content">
        {/* Fixed Header */}
        <div className="flex items-center justify-between p-5 sm:p-6 border-b border-white/10 bg-[#12131f] flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-wide">
                {isEdit ? 'Edit Password' : 'Add Password'}
              </h2>
              <p className="text-xs text-slate-400">Store encrypted credential in your vault</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5 custom-scrollbar bg-[#141622]">
          {/* Website Name & Domain */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Website Name" required error={errors.website_name}>
              <input
                id="field-website-name"
                type="text"
                value={form.website_name}
                onChange={update('website_name')}
                placeholder="e.g. Google, GitHub"
                className="input-field"
              />
            </Field>

            <Field label="Domain" required error={errors.domain}>
              <div className="relative">
                <Globe className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-400 pointer-events-none" />
                <input
                  id="field-domain"
                  type="text"
                  value={form.domain}
                  onChange={update('domain')}
                  placeholder="google.com"
                  className="input-field pl-10"
                />
              </div>
            </Field>
          </div>

          {/* Username + Email */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Username">
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                <input
                  id="field-username"
                  type="text"
                  value={form.username}
                  onChange={update('username')}
                  placeholder="johndoe"
                  className="input-field pl-10"
                />
              </div>
            </Field>

            <Field label="Email Address">
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                <input
                  id="field-email"
                  type="email"
                  value={form.email}
                  onChange={update('email')}
                  placeholder="john@example.com"
                  className="input-field pl-10"
                />
              </div>
            </Field>
          </div>

          {/* Password Input & Generator & Actions */}
          <Field label="Password" required error={errors.password}>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  id="field-password"
                  type={showPass ? 'text' : 'password'}
                  value={form.password}
                  onChange={update('password')}
                  placeholder="Enter or generate password"
                  className="input-field pr-11 font-mono text-sm tracking-wide"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(v => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                  title={showPass ? 'Hide password' : 'Show password'}
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              <button
                type="button"
                onClick={handleGenerate}
                title="Generate strong password"
                className="btn-secondary px-3.5 flex-shrink-0 border-indigo-500/30 hover:border-indigo-500/60 hover:text-indigo-300"
              >
                <Wand2 className="w-4 h-4 text-indigo-400" />
              </button>

              <button
                type="button"
                onClick={handleCopy}
                title="Copy password"
                className={`btn-secondary px-3.5 flex-shrink-0 transition-all ${
                  copied ? 'border-emerald-500/50 text-emerald-400 bg-emerald-500/10' : ''
                }`}
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>

            {/* Password Strength Indicator */}
            {form.password && (
              <div className="mt-3 bg-white/[0.03] border border-white/5 rounded-xl p-3">
                <div className="flex justify-between items-center text-xs mb-1.5">
                  <span className="text-slate-400 font-medium">Password Strength</span>
                  <span style={{ color: strengthColor }} className="font-bold capitalize tracking-wider text-xs">
                    {strength.strength} ({strength.score}%)
                  </span>
                </div>
                <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{ width: `${strength.score}%`, backgroundColor: strengthColor }}
                  />
                </div>
              </div>
            )}
          </Field>

          {/* Category */}
          <Field label="Category">
            <div className="relative">
              <Tag className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
              <select
                id="field-category"
                value={form.category}
                onChange={update('category')}
                className="input-field pl-10 capitalize cursor-pointer"
              >
                {CATEGORIES.map(c => (
                  <option key={c} value={c} className="bg-[#141622] capitalize">{c}</option>
                ))}
              </select>
            </div>
          </Field>

          {/* Notes */}
          <Field label="Encrypted Notes">
            <div className="relative">
              <textarea
                id="field-notes"
                value={form.notes}
                onChange={update('notes')}
                placeholder="Optional notes or security questions (encrypted)"
                rows={3}
                className="input-field resize-none py-3"
              />
            </div>
          </Field>
        </div>

        {/* Fixed Footer */}
        <div className="flex items-center justify-end gap-3 p-4 sm:p-5 border-t border-white/10 bg-[#12131f] flex-shrink-0">
          <button type="button" onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button
            id="save-password-btn"
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="btn-primary"
          >
            {isSaving ? (
              <><LoadingSpinner /> Saving...</>
            ) : (
              isEdit ? 'Save Changes' : 'Add Password'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({
  label, required, error, children,
}: {
  label: string
  required?: boolean
  error?: string
  children: React.ReactNode
}): React.ReactElement {
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
        {label} {required && <span className="text-rose-500">*</span>}
      </label>
      {children}
      {error && (
        <p className="text-rose-400 text-xs mt-1.5 flex items-center gap-1">
          <ShieldAlert className="w-3.5 h-3.5 flex-shrink-0" /> {error}
        </p>
      )}
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
