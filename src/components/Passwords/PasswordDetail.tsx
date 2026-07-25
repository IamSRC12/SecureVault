// PasswordDetail.tsx — shown as a side panel or modal for full credential view
import React from 'react'
import { X, Globe, User, Mail, Clock, Tag, FileText, Copy, Check, Eye, EyeOff } from 'lucide-react'
import type { Credential } from '../../types'
import { evaluatePasswordStrength } from '../../services/passwordUtils'

interface PasswordDetailProps {
  credential: Credential
  onClose:    () => void
}

export default function PasswordDetail({ credential, onClose }: PasswordDetailProps): React.ReactElement {
  const [showPass, setShowPass] = React.useState(false)
  const [copied, setCopied]     = React.useState(false)

  const strength = evaluatePasswordStrength(credential.password)
  const strengthColor =
    strength.strength === 'strong' ? '#22c55e' :
    strength.strength === 'medium' ? '#f59e0b' : '#ef4444'

  const handleCopy = async () => {
    await navigator.clipboard.writeText(credential.password)
    setCopied(true)
    setTimeout(() => {
      navigator.clipboard.writeText('')
      setCopied(false)
    }, 30_000)
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-content">
        <div className="flex items-center justify-between p-5 border-b border-[#2a2a2a]">
          <h2 className="text-lg font-semibold text-[#f1f5f9]">{credential.website_name}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-[#475569] hover:text-[#f1f5f9] hover:bg-[#2a2a2a]">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <DetailRow icon={<Globe className="w-4 h-4 text-[#475569]" />} label="Domain" value={credential.domain} />
          {credential.username && <DetailRow icon={<User className="w-4 h-4 text-[#475569]" />} label="Username" value={credential.username} />}
          {credential.email    && <DetailRow icon={<Mail className="w-4 h-4 text-[#475569]" />} label="Email"    value={credential.email} />}
          <DetailRow icon={<Tag  className="w-4 h-4 text-[#475569]" />} label="Category" value={credential.category} capitalize />
          {credential.last_used && (
            <DetailRow icon={<Clock className="w-4 h-4 text-[#475569]" />} label="Last Used"
              value={new Date(credential.last_used).toLocaleString()} />
          )}

          {/* Password row */}
          <div>
            <p className="text-xs font-medium text-[#475569] mb-1.5">Password</p>
            <div className="flex items-center gap-2 bg-[#0f0f0f] rounded-lg px-3 py-2.5">
              <span className="flex-1 text-sm font-mono text-[#f1f5f9]">
                {showPass ? credential.password : '••••••••••••••••'}
              </span>
              <button onClick={() => setShowPass(v => !v)} className="text-[#475569] hover:text-[#94a3b8]">
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
              <button onClick={handleCopy} className={`${copied ? 'text-[#22c55e]' : 'text-[#475569] hover:text-[#94a3b8]'}`}>
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            <div className="mt-1.5 flex items-center gap-2">
              <div className="flex-1 h-1 bg-[#2a2a2a] rounded-full">
                <div className="h-full rounded-full" style={{ width: `${strength.score}%`, backgroundColor: strengthColor }} />
              </div>
              <span className="text-xs capitalize" style={{ color: strengthColor }}>{strength.strength}</span>
            </div>
          </div>

          {credential.notes && (
            <div>
              <p className="text-xs font-medium text-[#475569] mb-1.5 flex items-center gap-1.5">
                <FileText className="w-4 h-4" /> Notes
              </p>
              <p className="text-sm text-[#94a3b8] bg-[#0f0f0f] rounded-lg p-3 whitespace-pre-wrap">
                {credential.notes}
              </p>
            </div>
          )}

          <div className="text-xs text-[#475569] pt-2 border-t border-[#2a2a2a] space-y-1">
            <p>Created: {new Date(credential.date_created).toLocaleString()}</p>
            <p>Modified: {new Date(credential.date_modified).toLocaleString()}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function DetailRow({
  icon, label, value, capitalize,
}: {
  icon: React.ReactNode
  label: string
  value: string
  capitalize?: boolean
}): React.ReactElement {
  return (
    <div>
      <p className="text-xs font-medium text-[#475569] mb-1 flex items-center gap-1.5">{icon}{label}</p>
      <p className={`text-sm text-[#f1f5f9] ${capitalize ? 'capitalize' : ''}`}>{value}</p>
    </div>
  )
}
