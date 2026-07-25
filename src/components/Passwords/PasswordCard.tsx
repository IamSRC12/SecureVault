import React, { useState, useCallback } from 'react'
import {
  Star, Copy, Edit2, Trash2, Globe, Check, Eye, EyeOff, ShieldCheck, ShieldAlert
} from 'lucide-react'
import { evaluatePasswordStrength } from '../../services/passwordUtils'
import type { Credential } from '../../types'

// ─── Category badge styles ────────────────────────────────────────────────
const CATEGORY_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  social:   { bg: 'bg-blue-500/10',   text: 'text-blue-400',   border: 'border-blue-500/25' },
  banking:  { bg: 'bg-emerald-500/10',text: 'text-emerald-400',border: 'border-emerald-500/25' },
  work:     { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/25' },
  shopping: { bg: 'bg-amber-500/10',  text: 'text-amber-400',  border: 'border-amber-500/25' },
  email:    { bg: 'bg-sky-500/10',    text: 'text-sky-400',    border: 'border-sky-500/25' },
  other:    { bg: 'bg-slate-500/10',  text: 'text-slate-400',  border: 'border-slate-500/25' },
}

const CLIPBOARD_TIMEOUT = 30_000 // 30 seconds

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
  const [copied, setCopied]         = useState(false)
  const [showPass, setShowPass]     = useState(false)
  const [delConfirm, setDelConfirm] = useState(false)
  const [imgError, setImgError]     = useState(false)

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
      // Clipboard fallback
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
    `https://www.google.com/s2/favicons?domain=${credential.domain}&sz=64`

  const catStyle = CATEGORY_STYLES[credential.category] ?? CATEGORY_STYLES.other
  const initial = (credential.website_name[0] || 'W').toUpperCase()

  return (
    <div className="bg-[#141622]/80 backdrop-blur-xl border border-white/10 hover:border-indigo-500/40 rounded-2xl p-5 card-hover flex flex-col justify-between relative group shadow-xl shadow-black/40 overflow-hidden">
      {/* Glow highlight on hover */}
      <div className="absolute -right-12 -top-12 w-28 h-28 bg-indigo-500/10 rounded-full blur-2xl group-hover:bg-indigo-500/20 transition-all pointer-events-none" />

      <div>
        {/* Header row: Favicon, Title, Favorite Button */}
        <div className="flex items-start gap-3.5 mb-4">
          <div className="w-11 h-11 rounded-xl bg-[#0e1017] border border-white/10 flex items-center justify-center flex-shrink-0 shadow-inner overflow-hidden relative">
            {!imgError ? (
              <img
                src={faviconUrl}
                alt=""
                className="w-6 h-6 object-contain"
                onError={() => setImgError(true)}
              />
            ) : (
              <span className="text-base font-extrabold text-gradient">
                {initial}
              </span>
            )}
          </div>

          <div className="flex-1 min-w-0 pr-2">
            <h3 className="font-bold text-white text-base truncate tracking-tight group-hover:text-indigo-300 transition-colors">
              {credential.website_name}
            </h3>
            <div className="flex items-center gap-1.5 mt-0.5 text-xs text-slate-400">
              <Globe className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
              <span className="truncate">{credential.domain}</span>
            </div>
          </div>

          <button
            onClick={handleFavorite}
            className="flex-shrink-0 p-2 rounded-xl hover:bg-white/10 transition-colors text-slate-400 hover:text-amber-400"
            title={credential.is_favorite ? 'Remove from favorites' : 'Add to favorites'}
          >
            <Star
              className={`w-4 h-4 transition-all ${
                credential.is_favorite ? 'fill-amber-400 text-amber-400 scale-110 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]' : ''
              }`}
            />
          </button>
        </div>

        {/* Username / Email Row */}
        <div className="mb-4 bg-white/[0.03] border border-white/5 rounded-xl px-3.5 py-2.5">
          <span className="text-xs text-slate-400 block font-mono truncate">
            {credential.email || credential.username || 'No username specified'}
          </span>
        </div>

        {/* Category & Strength Badges */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <span className={`badge ${catStyle.bg} ${catStyle.text} ${catStyle.border}`}>
            {credential.category}
          </span>
          <span className={`badge ${
            strength.strength === 'strong' ? 'strength-strong' :
            strength.strength === 'medium' ? 'strength-medium' : 'strength-weak'
          }`}>
            {strength.strength}
          </span>
        </div>

        {/* Password Preview Bar */}
        <div className="flex items-center gap-2 bg-[#0d0e16] border border-white/10 rounded-xl px-3.5 py-2.5 mb-4 group/pass">
          <span className="flex-1 text-xs font-mono text-slate-300 truncate tracking-wider">
            {showPass ? credential.password : '••••••••••••••••'}
          </span>
          <button
            onClick={() => setShowPass(v => !v)}
            className="text-slate-400 hover:text-indigo-400 transition-colors p-1 flex-shrink-0"
            title={showPass ? 'Hide password' : 'Show password'}
          >
            {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Action Footer Buttons */}
      <div className="flex items-center gap-2 pt-3 border-t border-white/5">
        <button
          onClick={handleCopy}
          className={`flex-1 flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all duration-200 ${
            copied
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-lg shadow-emerald-500/10'
              : 'bg-white/5 hover:bg-indigo-600/20 text-slate-300 hover:text-white border border-white/10 hover:border-indigo-500/30'
          }`}
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copied ? 'Copied (30s)' : 'Copy Password'}</span>
        </button>

        <button
          onClick={() => onEdit(credential)}
          className="p-2 rounded-xl text-slate-400 hover:text-indigo-300 hover:bg-indigo-500/10 border border-transparent hover:border-indigo-500/20 transition-all"
          title="Edit Credential"
        >
          <Edit2 className="w-4 h-4" />
        </button>

        <button
          onClick={handleDelete}
          className={`p-2 rounded-xl transition-all border ${
            delConfirm
              ? 'text-rose-400 bg-rose-500/20 border-rose-500/40'
              : 'text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border-transparent hover:border-rose-500/20'
          }`}
          title={delConfirm ? 'Click again to confirm delete' : 'Delete Credential'}
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
