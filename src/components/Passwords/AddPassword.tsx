import React, { useState, useEffect, useCallback } from 'react'
import {
  X, Eye, EyeOff, RefreshCw, Copy, Globe, Wand2, Check,
} from 'lucide-react'
import {
  evaluatePasswordStrength,
  generatePassword,
} from '../../services/passwordUtils'
import { useAppStore } from '../../store/appStore'
import type { Credential, CredentialCategory, CredentialFormData } from '../../types'

// ─── Default generator settings for the "generate" button ─────────────────
const DEFAULT_GEN = { length: 20, uppercase: true, lowercase: true, numbers: true, symbols: true, excludeSimilar: false }

const CATEGORIES: CredentialCategory[] = ['social', 'banking', 'work', 'shopping', 'email', 'other']

// ─── Add / Edit Password Modal ────────────────────────────────────────────

interface AddPasswordProps {
  credential?: Credential   // If provided, we're in edit mode
  prefillPassword?: string  // From generator
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
    } catch (err) {
      setErrors({ website_name: 'Failed to save. Please try again.' })
    } finally {
      setIsSaving(false)
    }
  }, [form, credential, isEdit, encryptionKey, isSaving, onSaved, onClose, strength.strength])

  const strengthColor =
    strength.strength === 'strong' ? '#22c55e' :
    strength.strength === 'medium' ? '#f59e0b' : '#ef4444'

  // Close on Escape
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[#2a2a2a]">
          <h2 className="text-lg font-semibold text-[#f1f5f9]">
            {isEdit ? 'Edit Password' : 'Add Password'}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-[#475569] hover:text-[#f1f5f9] hover:bg-[#2a2a2a] transition-all">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <div className="p-5 space-y-4">
          {/* Website Name */}
          <div className="grid grid-cols-2 gap-4">
            <Field label="Website Name" required error={errors.website_name}>
              <input id="field-website-name" type="text" value={form.website_name} onChange={update('website_name')}
                placeholder="Google" className="input-field" />
            </Field>

            {/* Domain */}
            <Field label="Domain" required error={errors.domain}>
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#475569]" />
                <input id="field-domain" type="text" value={form.domain} onChange={update('domain')}
                  placeholder="google.com" className="input-field pl-9" />
              </div>
            </Field>
          </div>

          {/* Username + Email */}
          <div className="grid grid-cols-2 gap-4">
            <Field label="Username">
              <input id="field-username" type="text" value={form.username} onChange={update('username')}
                placeholder="johndoe" className="input-field" />
            </Field>
            <Field label="Email">
              <input id="field-email" type="email" value={form.email} onChange={update('email')}
                placeholder="john@example.com" className="input-field" />
            </Field>
          </div>

          {/* Password */}
          <Field label="Password" required error={errors.password}>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input id="field-password" type={showPass ? 'text' : 'password'} value={form.password}
                  onChange={update('password')} placeholder="Enter password" className="input-field pr-10 font-mono" />
                <button type="button" onClick={() => setShowPass(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#475569] hover:text-[#94a3b8]">
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <button onClick={handleGenerate} title="Generate password"
                className="btn-secondary px-3 flex-shrink-0">
                <Wand2 className="w-4 h-4" />
              </button>
              <button onClick={handleCopy} title="Copy password"
                className={`btn-secondary px-3 flex-shrink-0 ${copied ? 'border-[#22c55e]/30 text-[#22c55e]' : ''}`}>
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>

            {/* Strength bar */}
            {form.password && (
              <div className="mt-2">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-[#475569]">Strength</span>
                  <span style={{ color: strengthColor }} className="font-medium capitalize">
                    {strength.strength}
                  </span>
                </div>
                <div className="h-1.5 bg-[#2a2a2a] rounded-full">
                  <div className="h-full rounded-full transition-all duration-300"
                    style={{ width: `${strength.score}%`, backgroundColor: strengthColor }} />
                </div>
              </div>
            )}
          </Field>

          {/* Category */}
          <Field label="Category">
            <select id="field-category" value={form.category} onChange={update('category')} className="input-field capitalize">
              {CATEGORIES.map(c => (
                <option key={c} value={c} className="capitalize">{c}</option>
              ))}
            </select>
          </Field>

          {/* Notes */}
          <Field label="Notes">
            <textarea id="field-notes" value={form.notes} onChange={update('notes')}
              placeholder="Optional notes (encrypted)"
              rows={3} className="input-field resize-none" />
          </Field>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-5 border-t border-[#2a2a2a]">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button
            id="save-password-btn"
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
      <label className="block text-sm font-medium text-[#94a3b8] mb-1.5">
        {label} {required && <span className="text-[#ef4444]">*</span>}
      </label>
      {children}
      {error && <p className="text-[#ef4444] text-xs mt-1">{error}</p>}
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
