import React, { useState, useCallback } from 'react'
import {
  Star, Copy, Edit2, Trash2, Globe, Check, Eye, EyeOff,
} from 'lucide-react'
import { evaluatePasswordStrength } from '../../services/passwordUtils'
import { useAppStore } from '../../store/appStore'
import type { Credential } from '../../types'

// ─── Category badge colors ────────────────────────────────────────────────
const CATEGORY_COLORS: Record<string, string> = {
  social:   'bg-blue-500/10 text-blue-400 border-blue-500/20',
  banking:  'bg-green-500/10 text-green-400 border-green-500/20',
  work:     'bg-purple-500/10 text-purple-400 border-purple-500/20',
  shopping: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  email:    'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  other:    'bg-gray-500/10 text-gray-400 border-gray-500/20',
}

const CLIPBOARD_TIMEOUT = 30_000 // 30 seconds

// ─── Password Card ────────────────────────────────────────────────────────

interface PasswordCardProps {
  credential: Credential
  onEdit:    (c: Credential) => void
  onRefresh: () => void
}

export default function PasswordCard({
  credential,
  onEdit,
  onRefresh,
}: PasswordCardProps): React.ReactElement {
  const [copied, setCopied]       = useState(false)
  const [showPass, setShowPass]   = useState(false)
  const [delConfirm, setDelConfirm] = useState(false)

  const copyTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const strength = evaluatePasswordStrength(credential.password)

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(credential.password)
      setCopied(true)

      if (copyTimerRef.current) clearTimeout(copyTimerRef.current)
      copyTimerRef.current = setTimeout(async () => {
        await navigator.clipboard.writeText('')  // Clear clipboard
        setCopied(false)
      }, CLIPBOARD_TIMEOUT)
    } catch {
      // Clipboard API may not be available
    }
  }, [credential.password])

  const handleFavorite = useCallback(async () => {
    await window.electronAPI.db.toggleFavoriteCredential(credential.id)
    onRefresh()
  }, [credential.id, onRefresh])

  const handleDelete = useCallback(async () => {
    if (!delConfirm) {
      setDelConfirm(true)
      setTimeout(() => setDelConfirm(false), 3000)
      return
    }
    await window.electronAPI.db.deleteCredential(credential.id)
    onRefresh()
  }, [delConfirm, credential.id, onRefresh])

  const faviconUrl = credential.favicon_url ||
    `https://www.google.com/s2/favicons?domain=${credential.domain}&sz=32`

  const catClass = CATEGORY_COLORS[credential.category] ?? CATEGORY_COLORS.other

  const strengthBadge =
    strength.strength === 'strong' ? 'strength-strong' :
    strength.strength === 'medium' ? 'strength-medium' : 'strength-weak'

  return (
    <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4 card-hover group">
      {/* Header row */}
      <div className="flex items-start gap-3 mb-3">
        {/* Favicon */}
        <div className="w-10 h-10 rounded-lg bg-[#0f0f0f] border border-[#2a2a2a] flex items-center justify-center flex-shrink-0 overflow-hidden">
          <img
            src={faviconUrl}
            alt=""
            className="w-5 h-5"
            onError={(e) => {
              const el = e.currentTarget as HTMLImageElement
              el.style.display = 'none'
              const parent = el.parentElement
              if (parent) {
                parent.innerHTML = `<span class="text-sm font-bold text-[#6366f1]">${credential.website_name[0]?.toUpperCase()}</span>`
              }
            }}
          />
        </div>

        {/* Title + domain */}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-[#f1f5f9] text-sm truncate">{credential.website_name}</p>
          <div className="flex items-center gap-1 mt-0.5">
            <Globe className="w-3 h-3 text-[#475569] flex-shrink-0" />
            <p className="text-xs text-[#475569] truncate">{credential.domain}</p>
          </div>
        </div>

        {/* Favorite */}
        <button
          onClick={handleFavorite}
          className="flex-shrink-0 p-1 rounded hover:bg-[#2a2a2a] transition-colors"
          title={credential.is_favorite ? 'Remove from favorites' : 'Add to favorites'}
        >
          <Star
            className={`w-4 h-4 ${credential.is_favorite ? 'fill-[#f59e0b] text-[#f59e0b]' : 'text-[#475569]'}`}
          />
        </button>
      </div>

      {/* Username / email */}
      <div className="mb-3">
        <p className="text-xs text-[#475569] truncate">
          {credential.email || credential.username || 'No username'}
        </p>
      </div>

      {/* Badges */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span className={`badge border ${catClass}`}>
          {credential.category}
        </span>
        <span className={`badge ${strengthBadge}`}>
          {strength.strength}
        </span>
      </div>

      {/* Password preview */}
      <div className="flex items-center gap-2 bg-[#0f0f0f] rounded-lg px-3 py-2 mb-3">
        <span className="flex-1 text-xs font-mono text-[#94a3b8] truncate">
          {showPass ? credential.password : '••••••••••••'}
        </span>
        <button
          onClick={() => setShowPass(v => !v)}
          className="text-[#475569] hover:text-[#94a3b8] transition-colors flex-shrink-0"
        >
          {showPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2">
        {/* Copy */}
        <button
          onClick={handleCopy}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 ${
            copied
              ? 'bg-[#22c55e]/10 text-[#22c55e] border border-[#22c55e]/20'
              : 'bg-[#2a2a2a] text-[#94a3b8] hover:text-[#f1f5f9] border border-transparent'
          }`}
          title={copied ? 'Copied! Clears in 30s' : 'Copy password'}
        >
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? 'Copied!' : 'Copy'}
        </button>

        <div className="flex-1" />

        {/* Edit */}
        <button
          onClick={() => onEdit(credential)}
          className="p-1.5 rounded-lg text-[#475569] hover:text-[#6366f1] hover:bg-[#6366f1]/10 transition-all"
          title="Edit"
        >
          <Edit2 className="w-4 h-4" />
        </button>

        {/* Delete */}
        <button
          onClick={handleDelete}
          className={`p-1.5 rounded-lg transition-all ${
            delConfirm
              ? 'text-[#ef4444] bg-[#ef4444]/10'
              : 'text-[#475569] hover:text-[#ef4444] hover:bg-[#ef4444]/10'
          }`}
          title={delConfirm ? 'Click again to confirm delete' : 'Delete'}
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
