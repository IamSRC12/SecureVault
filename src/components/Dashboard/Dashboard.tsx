import React, { useEffect, useState } from 'react'
import {
  KeyRound, Key, ShieldAlert, ShieldCheck,
  Plus, Clock, CheckCircle2, XCircle, TrendingUp, Sparkles, ChevronRight
} from 'lucide-react'
import { useAppStore } from '../../store/appStore'
import type { AuditLog } from '../../types'

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
    stats.securityScore >= 71 ? 'Optimal Security' :
    stats.securityScore >= 41 ? 'Fair Security'  : 'Action Required'

  const scoreColor =
    !stats ? '#f1f5f9' :
    stats.securityScore >= 71 ? '#4ade80' :
    stats.securityScore >= 41 ? '#fbbf24' : '#f87171'

  return (
    <div className="p-6 sm:p-8 max-w-7xl mx-auto space-y-8">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-indigo-900/40 via-purple-900/30 to-[#121420] border border-indigo-500/20 rounded-2xl p-6 sm:p-8 relative overflow-hidden shadow-2xl">
        <div className="absolute right-0 top-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-xs font-bold mb-3">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" /> Vault Security Hub
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              {greeting}, <span className="text-gradient">User</span>
            </h1>
            <p className="text-sm text-slate-300 mt-1 max-w-lg">
              Vault active and protected with AES-256 encryption. Local time: {timeStr}.
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setRoute('/passwords')}
              className="btn-primary"
            >
              <Plus className="w-4 h-4" />
              <span>Add Credential</span>
            </button>
          </div>
        </div>
      </div>

      {/* Stats Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          icon={<KeyRound className="w-5 h-5 text-indigo-400" />}
          gradient="from-indigo-500/20 to-purple-500/20"
          border="border-indigo-500/30"
          label="Total Passwords"
          value={stats?.totalPasswords ?? 0}
          sub="Stored in local database"
        />

        <StatCard
          icon={<Key className="w-5 h-5 text-purple-400" />}
          gradient="from-purple-500/20 to-pink-500/20"
          border="border-purple-500/30"
          label="Total API Keys"
          value={stats?.totalApiKeys ?? 0}
          sub="Encrypted secrets"
        />

        <StatCard
          icon={<ShieldAlert className="w-5 h-5 text-rose-400" />}
          gradient="from-rose-500/20 to-amber-500/20"
          border="border-rose-500/30"
          label="Weak Passwords"
          value={stats?.weakPasswords ?? 0}
          sub={stats?.weakPasswords ? 'Consider strengthening' : 'All passwords strong'}
          warning={stats?.weakPasswords ? stats.weakPasswords > 0 : false}
        />

        <StatCard
          icon={<TrendingUp className="w-5 h-5" style={{ color: scoreColor }} />}
          gradient="from-emerald-500/20 to-teal-500/20"
          border="border-emerald-500/30"
          label="Security Health"
          value={stats ? `${stats.securityScore}%` : '—'}
          valueColor={scoreColor}
          sub={scoreLabel}
        />
      </div>

      {/* Activity & Quick Shortcuts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activity (2 Cols) */}
        <div className="lg:col-span-2 bg-[#121420]/80 border border-white/10 rounded-2xl p-6 shadow-xl flex flex-col">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                <Clock className="w-4 h-4" />
              </div>
              <h2 className="font-bold text-white text-base">Recent Audit Events</h2>
            </div>
            <button
              onClick={() => setRoute('/audit')}
              className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors"
            >
              View Full Log <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {recentLogs.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-10 text-slate-500 text-xs">
              No audit log entries recorded yet.
            </div>
          ) : (
            <div className="space-y-3 flex-1">
              {recentLogs.map(log => (
                <div key={log.id} className="flex items-start gap-3 p-3.5 rounded-xl bg-white/[0.03] border border-white/5 hover:border-white/10 transition-colors">
                  <div className="mt-0.5 flex-shrink-0">
                    {log.success ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <XCircle className="w-4 h-4 text-rose-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold text-slate-200">
                        {formatAction(log.action)}
                      </p>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    {log.details && (
                      <p className="text-xs text-slate-400 mt-0.5 truncate">{log.details}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Actions (1 Col) */}
        <div className="bg-[#121420]/80 border border-white/10 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center gap-2.5 mb-2">
            <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <h2 className="font-bold text-white text-base">Quick Actions</h2>
          </div>

          <QuickAddButton
            icon={<KeyRound className="w-5 h-5 text-indigo-400" />}
            title="Manage Passwords"
            description="View or add website passwords"
            onClick={() => setRoute('/passwords')}
          />
          <QuickAddButton
            icon={<Key className="w-5 h-5 text-purple-400" />}
            title="API Keys Vault"
            description="Manage service keys & tokens"
            onClick={() => setRoute('/apikeys')}
          />
          <QuickAddButton
            icon={<ShieldCheck className="w-5 h-5 text-emerald-400" />}
            title="Password Generator"
            description="Create ultra-strong passwords"
            onClick={() => setRoute('/generator')}
          />
        </div>
      </div>
    </div>
  )
}

function StatCard({
  icon, gradient, border, label, value, valueColor, sub, warning
}: {
  icon: React.ReactNode
  gradient: string
  border: string
  label: string
  value: string | number
  valueColor?: string
  sub?: string
  warning?: boolean
}): React.ReactElement {
  return (
    <div className={`bg-[#121420]/80 border ${warning ? 'border-rose-500/40 bg-rose-500/5' : 'border-white/10'} rounded-2xl p-5 shadow-xl relative overflow-hidden card-hover`}>
      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${gradient} ${border} border flex items-center justify-center mb-3 shadow-inner`}>
        {icon}
      </div>
      <div className="text-3xl font-extrabold tracking-tight mb-1" style={{ color: valueColor || '#ffffff' }}>
        {value}
      </div>
      <div className="text-xs font-semibold text-slate-300">{label}</div>
      {sub && <div className="text-[11px] text-slate-500 mt-1">{sub}</div>}
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
      className="w-full flex items-center justify-between p-4 rounded-xl bg-white/[0.03] border border-white/5
        hover:border-indigo-500/30 hover:bg-white/[0.06] transition-all duration-200 text-left group"
    >
      <div className="flex items-center gap-3.5 min-w-0">
        <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 group-hover:scale-105 transition-transform flex-shrink-0">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-xs font-bold text-white group-hover:text-indigo-300 transition-colors">{title}</p>
          <p className="text-[11px] text-slate-400 truncate">{description}</p>
        </div>
      </div>
      <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-white group-hover:translate-x-0.5 transition-all flex-shrink-0" />
    </button>
  )
}

function formatAction(action: string): string {
  return action.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}
