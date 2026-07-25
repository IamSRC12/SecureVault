import React, { useState, useCallback } from 'react'
import { X, Eye, EyeOff, Copy, Check, Calendar } from 'lucide-react'
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
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm(f => ({ ...f, [k]: e.target.value }))

  const handleCopyKey = async () => {
    await navigator.clipboard.writeText(form.api_key)
    setCopiedKey(true)
    setTimeout(() => { navigator.clipboard.writeText(''); setCopiedKey(false) }, 30_000)
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
      <div className="modal-content max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[#2a2a2a]">
          <h2 className="text-lg font-semibold text-[#f1f5f9]">{isEdit ? 'Edit API Key' : 'Add API Key'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-[#475569] hover:text-[#f1f5f9] hover:bg-[#2a2a2a]">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Service Name */}
          <div>
            <label className="block text-sm font-medium text-[#94a3b8] mb-1.5">
              Service Name <span className="text-[#ef4444]">*</span>
            </label>
            <input id="apikey-service" type="text" value={form.service_name} onChange={update('service_name')}
              placeholder="e.g. OpenAI, AWS, Stripe" className="input-field" />
            {errors.service_name && <p className="text-[#ef4444] text-xs mt-1">{errors.service_name}</p>}
          </div>

          {/* API Key */}
          <div>
            <label className="block text-sm font-medium text-[#94a3b8] mb-1.5">
              API Key <span className="text-[#ef4444]">*</span>
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input id="apikey-key" type={showKey ? 'text' : 'password'} value={form.api_key} onChange={update('api_key')}
                  placeholder="sk-..." className="input-field pr-10 font-mono text-xs" />
                <button type="button" onClick={() => setShowKey(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#475569] hover:text-[#94a3b8]">
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <button onClick={handleCopyKey}
                className={`btn-secondary px-3 flex-shrink-0 ${copiedKey ? 'border-[#22c55e]/30 text-[#22c55e]' : ''}`}>
                {copiedKey ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            {errors.api_key && <p className="text-[#ef4444] text-xs mt-1">{errors.api_key}</p>}
          </div>

          {/* Secret Key */}
          <div>
            <label className="block text-sm font-medium text-[#94a3b8] mb-1.5">Secret Key (optional)</label>
            <div className="relative">
              <input id="apikey-secret" type={showSecret ? 'text' : 'password'} value={form.secret_key} onChange={update('secret_key')}
                placeholder="Secret access key" className="input-field pr-10 font-mono text-xs" />
              <button type="button" onClick={() => setShowSecret(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#475569] hover:text-[#94a3b8]">
                {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Endpoint URL + Category */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#94a3b8] mb-1.5">Endpoint URL</label>
              <input id="apikey-endpoint" type="url" value={form.endpoint_url} onChange={update('endpoint_url')}
                placeholder="https://api.example.com" className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#94a3b8] mb-1.5">Category</label>
              <select id="apikey-category" value={form.category} onChange={update('category')} className="input-field capitalize">
                {CATEGORIES.map(c => (
                  <option key={c} value={c} className="capitalize">{c}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Description + Expiry */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#94a3b8] mb-1.5">Description</label>
              <input id="apikey-desc" type="text" value={form.description} onChange={update('description')}
                placeholder="What is this key for?" className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#94a3b8] mb-1.5">
                <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" />Expiry Date</span>
              </label>
              <input id="apikey-expiry" type="date" value={form.expiry_date} onChange={update('expiry_date')} className="input-field" />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-5 border-t border-[#2a2a2a]">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button id="save-apikey-btn" onClick={handleSave} disabled={isSaving} className="btn-primary">
            {isSaving ? 'Saving...' : isEdit ? 'Save Changes' : 'Add API Key'}
          </button>
        </div>
      </div>
    </div>
  )
}
