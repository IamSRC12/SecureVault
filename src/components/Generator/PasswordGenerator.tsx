import React, { useState, useEffect, useCallback, useRef } from 'react'
import { RefreshCw, Copy, Check, Save, Minus, Plus as PlusIcon } from 'lucide-react'
import { generatePassword, evaluatePasswordStrength } from '../../services/passwordUtils'
import { useAppStore } from '../../store/appStore'
import AddPassword from '../Passwords/AddPassword'
import type { GeneratorSettings } from '../../types'

const DEFAULT_SETTINGS: GeneratorSettings = {
  length:        20,
  uppercase:     true,
  lowercase:     true,
  numbers:       true,
  symbols:       true,
  excludeSimilar: false,
}

export default function PasswordGenerator(): React.ReactElement {
  const [settings, setSettings]   = useState<GeneratorSettings>(DEFAULT_SETTINGS)
  const [password, setPassword]   = useState('')
  const [history,  setHistory]    = useState<string[]>([])
  const [copied,   setCopied]     = useState(false)
  const [showSave, setShowSave]   = useState(false)
  const copiedTimers              = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const [historyCopied, setHistoryCopied] = useState<Record<string, boolean>>({})

  const generate = useCallback(() => {
    const pwd = generatePassword(settings)
    setPassword(pwd)
    setHistory(h => [pwd, ...h.slice(0, 9)])   // Keep last 10
  }, [settings])

  // Generate on mount and settings change
  useEffect(() => { generate() }, [generate])

  const handleCopy = async (pwd: string, isMain = false) => {
    await navigator.clipboard.writeText(pwd)
    if (isMain) {
      setCopied(true)
      setTimeout(() => { navigator.clipboard.writeText(''); setCopied(false) }, 30_000)
    } else {
      setHistoryCopied(h => ({ ...h, [pwd]: true }))
      const t = setTimeout(() => {
        setHistoryCopied(h => { const n = { ...h }; delete n[pwd]; return n })
        navigator.clipboard.writeText('')
      }, 30_000)
      copiedTimers.current.set(pwd, t)
    }
  }

  const toggleSetting = (key: keyof GeneratorSettings) => {
    setSettings(s => {
      const newVal = !s[key as keyof typeof s]
      // Ensure at least one character type is always on
      const updated = { ...s, [key]: newVal }
      if (!updated.uppercase && !updated.lowercase && !updated.numbers && !updated.symbols) {
        return s  // Reject — would leave no charset
      }
      return updated
    })
  }

  const strength = evaluatePasswordStrength(password)
  const strengthColor =
    strength.strength === 'strong' ? '#22c55e' :
    strength.strength === 'medium' ? '#f59e0b' : '#ef4444'

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-2xl font-bold text-[#f1f5f9] mb-6">Password Generator</h1>

      {/* Generated password display */}
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-5 mb-6">
        <div className="flex items-center gap-3 mb-3">
          <code className="flex-1 text-lg font-mono text-[#f1f5f9] break-all leading-relaxed">
            {password || '...'}
          </code>
        </div>

        {/* Strength bar */}
        <div className="mb-4">
          <div className="flex justify-between text-xs mb-1">
            <span className="text-[#475569]">Strength</span>
            <span style={{ color: strengthColor }} className="font-medium capitalize">
              {strength.strength} ({strength.score}/100)
            </span>
          </div>
          <div className="h-2 bg-[#0f0f0f] rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-500"
              style={{ width: `${strength.score}%`, backgroundColor: strengthColor }} />
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-3">
          <button onClick={() => handleCopy(password, true)}
            className={`btn-primary flex-1 justify-center ${copied ? 'bg-[#22c55e] hover:bg-[#22c55e]' : ''}`}>
            {copied ? <><Check className="w-4 h-4" /> Copied!</> : <><Copy className="w-4 h-4" /> Copy</>}
          </button>
          <button onClick={generate} className="btn-secondary px-4" title="Generate new password">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button onClick={() => setShowSave(true)} className="btn-secondary">
            <Save className="w-4 h-4" /> Save
          </button>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-5 mb-6">
        <h2 className="text-sm font-semibold text-[#f1f5f9] mb-4">Settings</h2>

        {/* Length slider */}
        <div className="mb-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-[#94a3b8]">Length</span>
            <div className="flex items-center gap-2">
              <button onClick={() => setSettings(s => ({ ...s, length: Math.max(8, s.length - 1) }))}
                className="w-7 h-7 rounded-lg bg-[#2a2a2a] flex items-center justify-center text-[#94a3b8] hover:text-[#f1f5f9] hover:bg-[#3a3a3a]">
                <Minus className="w-3 h-3" />
              </button>
              <span className="text-[#6366f1] font-bold text-lg w-10 text-center">{settings.length}</span>
              <button onClick={() => setSettings(s => ({ ...s, length: Math.min(128, s.length + 1) }))}
                className="w-7 h-7 rounded-lg bg-[#2a2a2a] flex items-center justify-center text-[#94a3b8] hover:text-[#f1f5f9] hover:bg-[#3a3a3a]">
                <PlusIcon className="w-3 h-3" />
              </button>
            </div>
          </div>
          <input type="range" min={8} max={128} value={settings.length}
            onChange={e => setSettings(s => ({ ...s, length: parseInt(e.target.value) }))}
            className="w-full accent-[#6366f1]" />
          <div className="flex justify-between text-xs text-[#475569] mt-1">
            <span>8</span><span>128</span>
          </div>
        </div>

        {/* Toggles */}
        <div className="space-y-3">
          {[
            { key: 'uppercase',      label: 'Uppercase letters (A–Z)' },
            { key: 'lowercase',      label: 'Lowercase letters (a–z)' },
            { key: 'numbers',        label: 'Numbers (0–9)' },
            { key: 'symbols',        label: 'Symbols (!@#$%^&*)' },
            { key: 'excludeSimilar', label: 'Exclude similar characters (0, O, l, 1, I)' },
          ].map(({ key, label }) => (
            <div key={key} className="flex items-center justify-between">
              <span className="text-sm text-[#94a3b8]">{label}</span>
              <Toggle
                checked={settings[key as keyof GeneratorSettings] as boolean}
                onChange={() => toggleSetting(key as keyof GeneratorSettings)}
              />
            </div>
          ))}
        </div>
      </div>

      {/* History */}
      {history.length > 1 && (
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-5">
          <h2 className="text-sm font-semibold text-[#f1f5f9] mb-4">Session History</h2>
          <div className="space-y-2">
            {history.slice(1).map((pwd, i) => (
              <div key={i} className="flex items-center gap-3 bg-[#0f0f0f] rounded-lg px-3 py-2">
                <code className="flex-1 text-xs font-mono text-[#94a3b8] truncate">{pwd}</code>
                <button onClick={() => handleCopy(pwd)}
                  className={`text-[#475569] hover:text-[#94a3b8] flex-shrink-0 ${historyCopied[pwd] ? 'text-[#22c55e]' : ''}`}>
                  {historyCopied[pwd] ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Save to vault modal */}
      {showSave && (
        <AddPassword
          prefillPassword={password}
          onClose={() => setShowSave(false)}
          onSaved={() => setShowSave(false)}
        />
      )}
    </div>
  )
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }): React.ReactElement {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200 ${
        checked ? 'bg-[#6366f1]' : 'bg-[#2a2a2a]'
      }`}
    >
      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform duration-200 ${
        checked ? 'translate-x-4' : 'translate-x-0.5'
      }`} />
    </button>
  )
}
