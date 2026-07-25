import React, { useState, useCallback } from 'react'
import { X, Eye, EyeOff, Copy, Check, Calendar, Key, Tag, Link2, FileText, ShieldAlert } from 'lucide-react'
import { useAppStore } from '../../store/appStore'
import type { ApiKey, ApiKeyCategory, ApiKeyFormData } from '../../types'

const CATEGORIES: ApiKeyCategory[] = ['ai', 'cloud', 'payment', 'communication', 'development', 'other']

interface AddApiKeyProps {
  apiKey?:  ApiKey
  onClose:  () => void
  onSaved:  () => void
}

export default function AddApiKey({ apiKey, onClose, onSaved }: AddApiKeyProps): React.ReactElement {
  const { encryptionKey } = useAppStore()
  const isEdit = Boolean(apiKey)

  const [form, setForm] = useState<ApiKeyFormData>({
    service_name:  apiKey?.service_name  ?? '',
    api_key:       apiKey?.api_key       ?? '',
    secret_key:    apiKey?.secret_key    ?? '',
    endpoint_url:  apiKey?.endpoint_url  ?? '',
    description:   apiKey?.description   ?? '',
    category:      apiKey?.category      ?? 'other',
    expiry_date:   apiKey?.expiry_date   ?? '',
    is_favorite:   Boolean(apiKey?.is_favorite),
  })

  const [showKey,    setShowKey]    = useState(false)
  const [showSecret, setShowSecret] = useState(false)
  const [errors,     setErrors]     = useState<Partial<ApiKeyFormData>>({})
  const [isSaving,   setIsSaving]   = useState(false)
  const [copiedKey,  setCopiedKey]  = useState(false)

  const update = (k: keyof ApiKeyFormData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [k]: e.target.value }))

  const handleCopyKey = async () => {
    if (!form.api_key) return
    await navigator.clipboard.writeText(form.api_key)
    setCopiedKey(true)
    setTimeout(() => setCopiedKey(false), 2000)
  }

  const validate = (): boolean => {
    const errs: Partial<ApiKeyFormData> = {}
    if (!form.service_name.trim()) errs.service_name = 'Required'
    if (!form.api_key.trim())      errs.api_key      = 'Required'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSave = useCallback(async () => {
    if (!validate() || !encryptionKey || isSaving) return
    setIsSaving(true)
    try {
      const data = {
        service_name:  form.service_name.trim(),
        api_key:       form.api_key.trim(),
        secret_key:    form.secret_key?.trim() || null,
        endpoint_url:  form.endpoint_url?.trim() || null,
        description:   form.description?.trim() || null,
        category:      form.category,
        expiry_date:   form.expiry_date || null,
        is_favorite:   form.is_favorite ? 1 : 0,
      }

      const keyHex = encryptionKey.toString('hex')

      if (isEdit && apiKey) {
        await window.electronAPI.db.updateApiKey(apiKey.id, data, keyHex)
        await window.electronAPI.db.addAuditLog('EDIT_API_KEY', `Edited: ${data.service_name}`, true)
      } else {
        await window.electronAPI.db.createApiKey(data, keyHex)
        await window.electronAPI.db.addAuditLog('ADD_API_KEY', `Added: ${data.service_name}`, true)
      }

      onSaved()
      onClose()
    } catch {
      setErrors({ service_name: 'Failed to save. Please try again.' })
    } finally {
      setIsSaving(false)
    }
  }, [form, apiKey, isEdit, encryptionKey, isSaving, onSaved, onClose])

  React.useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-content">
        {/* Fixed Header */}
        <div className="flex items-center justify-between p-5 sm:p-6 border-b border-white/10 bg-[#12131f] flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-wide">
                {isEdit ? 'Edit API Key' : 'Add API Key'}
              </h2>
              <p className="text-xs text-slate-400">Store API keys and secrets securely</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-all">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5 custom-scrollbar bg-[#141622]">
          {/* Service Name */}
          <Field label="Service Name" required error={errors.service_name}>
            <input
              id="apikey-service"
              type="text"
              value={form.service_name}
              onChange={update('service_name')}
              placeholder="e.g. OpenAI, AWS, Stripe, Anthropic"
              className="input-field"
            />
          </Field>

          {/* API Key */}
          <Field label="API Key Value" required error={errors.api_key}>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  id="apikey-key"
                  type={showKey ? 'text' : 'password'}
                  value={form.api_key}
                  onChange={update('api_key')}
                  placeholder="sk-..."
                  className="input-field pr-11 font-mono text-xs"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(v => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                >
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <button
                type="button"
                onClick={handleCopyKey}
                className={`btn-secondary px-3.5 flex-shrink-0 transition-all ${
                  copiedKey ? 'border-emerald-500/50 text-emerald-400 bg-emerald-500/10' : ''
                }`}
              >
                {copiedKey ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </Field>

          {/* Secret Key */}
          <Field label="Secret Key (Optional)">
            <div className="relative">
              <input
                id="apikey-secret"
                type={showSecret ? 'text' : 'password'}
                value={form.secret_key}
                onChange={update('secret_key')}
                placeholder="Secret access key (if applicable)"
                className="input-field pr-11 font-mono text-xs"
              />
              <button
                type="button"
                onClick={() => setShowSecret(v => !v)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
              >
                {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </Field>

          {/* Endpoint URL + Category */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Endpoint URL">
              <div className="relative">
                <Link2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                <input
                  id="apikey-endpoint"
                  type="url"
                  value={form.endpoint_url}
                  onChange={update('endpoint_url')}
                  placeholder="https://api.openai.com/v1"
                  className="input-field pl-10"
                />
              </div>
            </Field>

            <Field label="Category">
              <div className="relative">
                <Tag className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                <select
                  id="apikey-category"
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
          </div>

          {/* Description + Expiry */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Description">
              <input
                id="apikey-desc"
                type="text"
                value={form.description}
                onChange={update('description')}
                placeholder="What is this key used for?"
                className="input-field"
              />
            </Field>

            <Field label="Expiration Date">
              <div className="relative">
                <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                <input
                  id="apikey-expiry"
                  type="date"
                  value={form.expiry_date}
                  onChange={update('expiry_date')}
                  className="input-field pl-10 cursor-pointer"
                />
              </div>
            </Field>
          </div>
        </div>

        {/* Fixed Footer */}
        <div className="flex items-center justify-end gap-3 p-4 sm:p-5 border-t border-white/10 bg-[#12131f] flex-shrink-0">
          <button type="button" onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button
            id="save-apikey-btn"
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="btn-primary"
          >
            {isSaving ? 'Saving...' : isEdit ? 'Save Changes' : 'Add API Key'}
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
