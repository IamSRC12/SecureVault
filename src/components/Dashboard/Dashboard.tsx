import React, { useEffect, useState } from 'react'
import {
  KeyRound, Key, ShieldAlert, ShieldCheck,
  Plus, Clock, CheckCircle2, XCircle, TrendingUp,
} from 'lucide-react'
import { useAppStore } from '../../store/appStore'
import type { AuditLog } from '../../types'

// ─── Dashboard ────────────────────────────────────────────────────────────

interface Stats {
  totalPasswords: number
  totalApiKeys: number
  weakPasswords: number
  strongPasswords: number
  securityScore: number
}

export default function Dashboard(): React.ReactElement {
  const { encryptionKey, setRoute } = useAppStore()
  const [stats, setStats]         = useState<Stats | null>(null)
  const [recentLogs, setRecentLogs] = useState<AuditLog[]>([])

  const hour     = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  const timeStr  = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  useEffect(() => {
    if (!encryptionKey) return
    async function loadData() {
      try {
        const statsData = await window.electronAPI.db.getDashboardStats(encryptionKey.toString('hex'))
        const logsData  = await window.electronAPI.db.getAuditLogs(5, 0)
        setStats(statsData)
        setRecentLogs(logsData)
      } catch (err) {
        console.error('Dashboard load failed:', err)
      }
    }
    loadData()
  }, [encryptionKey])

  const scoreLabel =
    !stats ? '' :
    stats.securityScore >= 71 ? 'Good'  :
    stats.securityScore >= 41 ? 'Fair'  : 'Poor'

  const scoreColor =
    !stats ? '#f1f5f9' :
    stats.securityScore >= 71 ? '#22c55e' :
    stats.securityScore >= 41 ? '#f59e0b' : '#ef4444'

  return (
    <div className="p-8 max-w-6xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[#f1f5f9]">
          {greeting} &mdash; {timeStr}
        </h1>
        <p className="text-[#94a3b8] mt-1">Here&apos;s your security overview</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <StatCard
          icon={<KeyRound className="w-5 h-5 text-[#6366f1]" />}
          bg="bg-[#6366f1]/10"
          label="Total Passwords"
          value={stats?.totalPasswords ?? 0}
          color="#f1f5f9"
        />
        <StatCard
          icon={<Key className="w-5 h-5 text-[#8b5cf6]" />}
          bg="bg-[#8b5cf6]/10"
          label="Total API Keys"
          value={stats?.totalApiKeys ?? 0}
          color="#f1f5f9"
        />
        <StatCard
          icon={<ShieldAlert className="w-5 h-5 text-[#ef4444]" />}
          bg="bg-[#ef4444]/10"
          label="Weak Passwords"
          value={stats?.weakPasswords ?? 0}
          color="#ef4444"
          warning={stats?.weakPasswords ? stats.weakPasswords > 0 : false}
        />
        <StatCard
          icon={<TrendingUp className="w-5 h-5" style={{ color: scoreColor }} />}
          bg=""
          label="Security Score"
          value={stats ? `${stats.securityScore}%` : '—'}
          color={scoreColor}
          subLabel={scoreLabel}
        />
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Recent Activity */}
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-4 h-4 text-[#6366f1]" />
            <h2 className="font-semibold text-[#f1f5f9] text-sm">Recent Activity</h2>
          </div>

          {recentLogs.length === 0 ? (
            <p className="text-[#475569] text-sm text-center py-6">No activity yet</p>
          ) : (
            <div className="space-y-2">
              {recentLogs.map(log => (
                <div key={log.id} className="flex items-start gap-3 p-2.5 rounded-lg bg-[#0f0f0f]">
                  <span className="mt-0.5 flex-shrink-0">
                    {log.success ? (
                      <CheckCircle2 className="w-4 h-4 text-[#22c55e]" />
                    ) : (
                      <XCircle className="w-4 h-4 text-[#ef4444]" />
                    )}
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-[#f1f5f9] truncate">
                      {formatAction(log.action)}
                    </p>
                    {log.details && (
                      <p className="text-xs text-[#475569] truncate">{log.details}</p>
                    )}
                    <p className="text-[10px] text-[#475569] mt-0.5">
                      {new Date(log.timestamp).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Add */}
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Plus className="w-4 h-4 text-[#6366f1]" />
            <h2 className="font-semibold text-[#f1f5f9] text-sm">Quick Add</h2>
          </div>

          <div className="space-y-3">
            <QuickAddButton
              icon={<KeyRound className="w-5 h-5 text-[#6366f1]" />}
              title="Add Password"
              description="Save a website login"
              onClick={() => setRoute('/passwords')}
            />
            <QuickAddButton
              icon={<Key className="w-5 h-5 text-[#8b5cf6]" />}
              title="Add API Key"
              description="Save an API key or secret"
              onClick={() => setRoute('/apikeys')}
            />
            <QuickAddButton
              icon={<ShieldCheck className="w-5 h-5 text-[#22c55e]" />}
              title="Generate Password"
              description="Create a strong password"
              onClick={() => setRoute('/generator')}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────

interface StatCardProps {
  icon:      React.ReactNode
  bg:        string
  label:     string
  value:     string | number
  color:     string
  subLabel?: string
  warning?:  boolean
}

function StatCard({ icon, bg, label, value, color, subLabel, warning }: StatCardProps): React.ReactElement {
  return (
    <div className={`bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-5 ${warning ? 'border-[#ef4444]/30' : ''}`}>
      <div className={`inline-flex p-2 rounded-lg mb-3 ${bg || 'bg-[#2a2a2a]'}`}>
        {icon}
      </div>
      <div className="text-2xl font-bold mb-0.5" style={{ color }}>
        {value}
      </div>
      <div className="text-xs text-[#94a3b8]">{label}</div>
      {subLabel && (
        <div className="text-xs font-medium mt-0.5" style={{ color }}>{subLabel}</div>
      )}
    </div>
  )
}

function QuickAddButton({
  icon, title, description, onClick,
}: {
  icon: React.ReactNode
  title: string
  description: string
  onClick: () => void
}): React.ReactElement {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 p-3 rounded-lg bg-[#0f0f0f] border border-[#2a2a2a]
        hover:border-[#6366f1]/30 hover:bg-[#6366f1]/5 transition-all duration-150 text-left"
    >
      <div className="flex-shrink-0">{icon}</div>
      <div>
        <p className="text-sm font-medium text-[#f1f5f9]">{title}</p>
        <p className="text-xs text-[#475569]">{description}</p>
      </div>
    </button>
  )
}

function formatAction(action: string): string {
  return action.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}
