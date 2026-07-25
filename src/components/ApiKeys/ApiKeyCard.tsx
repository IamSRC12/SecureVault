import React, { useState, useCallback } from 'react'
import { Star, Copy, Edit2, Trash2, Key, Check, Eye, EyeOff, AlertTriangle } from 'lucide-react'
import type { ApiKey } from '../../types'

const CATEGORY_COLORS: Record<string, string> = {
  ai:            'bg-violet-500/10 text-violet-400 border-violet-500/20',
  cloud:         'bg-sky-500/10 text-sky-400 border-sky-500/20',
  payment:       'bg-green-500/10 text-green-400 border-green-500/20',
  communication: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  development:   'bg-orange-500/10 text-orange-400 border-orange-500/20',
  other:         'bg-gray-500/10 text-gray-400 border-gray-500/20',
}

interface ApiKeyCardProps {
  apiKey:    ApiKey
  onEdit:    (k: ApiKey) => void
  onRefresh: () => void
}

export default function ApiKeyCard({ apiKey, onEdit, onRefresh }: ApiKeyCardProps): React.ReactElement {
  const [showKey,     setShowKey]     = useState(false)
  const [copied,      setCopied]      = useState(false)
  const [delConfirm,  setDelConfirm]  = useState(false)

  const isExpired    = apiKey.expiry_date ? new Date(apiKey.expiry_date) < new Date() : false
  const expiresSoon  = apiKey.expiry_date && !isExpired
    ? (new Date(apiKey.expiry_date).getTime() - Date.now()) < 30 * 24 * 60 * 60 * 1000
    : false

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(apiKey.api_key)
    setCopied(true)
    setTimeout(() => { navigator.clipboard.writeText(''); setCopied(false) }, 30_000)
  }, [apiKey.api_key])

  const handleFavorite = useCallback(async () => {
    await window.electronAPI.db.toggleFavoriteApiKey(apiKey.id)
    onRefresh()
  }, [apiKey.id, onRefresh])

  const handleDelete = useCallback(async () => {
    if (!delConfirm) {
      setDelConfirm(true)
      setTimeout(() => setDelConfirm(false), 3000)
      return
    }
    await window.electronAPI.db.deleteApiKey(apiKey.id)
    onRefresh()
  }, [delConfirm, apiKey.id, onRefresh])

  const catClass = CATEGORY_COLORS[apiKey.category] ?? CATEGORY_COLORS.other
  const initials = apiKey.service_name.slice(0, 2).toUpperCase()

  return (
    <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4 card-hover">
      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        <div className="w-10 h-10 rounded-lg bg-[#6366f1]/10 border border-[#6366f1]/20 flex items-center justify-center flex-shrink-0">
          <span className="text-xs font-bold text-[#6366f1]">{initials}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-[#f1f5f9] text-sm truncate">{apiKey.service_name}</p>
          {apiKey.description && (
            <p className="text-xs text-[#475569] truncate">{apiKey.description}</p>
          )}
        </div>
        <button onClick={handleFavorite} className="p-1 rounded hover:bg-[#2a2a2a] transition-colors flex-shrink-0">
          <Star className={`w-4 h-4 ${apiKey.is_favorite ? 'fill-[#f59e0b] text-[#f59e0b]' : 'text-[#475569]'}`} />
        </button>
      </div>

      {/* Badges */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span className={`badge border ${catClass}`}>{apiKey.category}</span>
        {isExpired && (
          <span className="badge bg-[#ef4444]/10 text-[#ef4444] border border-[#ef4444]/20 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> Expired
          </span>
        )}
        {expiresSoon && !isExpired && (
          <span className="badge bg-[#f59e0b]/10 text-[#f59e0b] border border-[#f59e0b]/20 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            Expires {new Date(apiKey.expiry_date!).toLocaleDateString()}
          </span>
        )}
      </div>

      {/* Key preview */}
      <div className="flex items-center gap-2 bg-[#0f0f0f] rounded-lg px-3 py-2 mb-3">
        <Key className="w-3.5 h-3.5 text-[#475569] flex-shrink-0" />
        <span className="flex-1 text-xs font-mono text-[#94a3b8] truncate">
          {showKey ? apiKey.api_key : '••••••••••••••••••••••••'}
        </span>
        <button onClick={() => setShowKey(v => !v)} className="text-[#475569] hover:text-[#94a3b8] flex-shrink-0">
          {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button onClick={handleCopy}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            copied
              ? 'bg-[#22c55e]/10 text-[#22c55e] border border-[#22c55e]/20'
              : 'bg-[#2a2a2a] text-[#94a3b8] hover:text-[#f1f5f9] border border-transparent'
          }`}>
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? 'Copied!' : 'Copy Key'}
        </button>
        <div className="flex-1" />
        <button onClick={() => onEdit(apiKey)} className="p-1.5 rounded-lg text-[#475569] hover:text-[#6366f1] hover:bg-[#6366f1]/10 transition-all" title="Edit">
          <Edit2 className="w-4 h-4" />
        </button>
        <button onClick={handleDelete}
          className={`p-1.5 rounded-lg transition-all ${delConfirm ? 'text-[#ef4444] bg-[#ef4444]/10' : 'text-[#475569] hover:text-[#ef4444] hover:bg-[#ef4444]/10'}`}
          title={delConfirm ? 'Click again to confirm' : 'Delete'}>
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
