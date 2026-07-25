import React, { useState, useEffect, useCallback } from 'react'
import { CheckCircle2, XCircle, Search, Trash2, ChevronLeft, ChevronRight, ClipboardList } from 'lucide-react'
import type { AuditLog, AuditAction } from '../../types'

const PAGE_SIZE = 50

const ACTION_COLORS: Record<string, string> = {
  LOGIN_SUCCESS:          'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  LOGIN_FAILED:           'text-rose-400 bg-rose-500/10 border-rose-500/20',
  ADD_PASSWORD:           'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
  EDIT_PASSWORD:          'text-purple-400 bg-purple-500/10 border-purple-500/20',
  DELETE_PASSWORD:        'text-rose-400 bg-rose-500/10 border-rose-500/20',
  ADD_API_KEY:            'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
  EDIT_API_KEY:           'text-purple-400 bg-purple-500/10 border-purple-500/20',
  DELETE_API_KEY:         'text-rose-400 bg-rose-500/10 border-rose-500/20',
  EXTENSION_SAVE:         'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  EXTENSION_AUTOFILL:     'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  LOCK:                   'text-amber-400 bg-amber-500/10 border-amber-500/20',
  UNLOCK:                 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  SETUP_COMPLETE:         'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
  CHANGE_MASTER_PASSWORD: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  EXPORT_VAULT:           'text-slate-400 bg-slate-500/10 border-slate-500/20',
  IMPORT_VAULT:           'text-slate-400 bg-slate-500/10 border-slate-500/20',
  CLEAR_DATA:             'text-rose-400 bg-rose-500/10 border-rose-500/20',
  REGENERATE_TOKEN:       'text-amber-400 bg-amber-500/10 border-amber-500/20',
}

export default function AuditLogView(): React.ReactElement {
  const [logs,         setLogs]         = useState<AuditLog[]>([])
  const [total,        setTotal]        = useState(0)
  const [page,         setPage]         = useState(0)
  const [search,       setSearch]       = useState('')
  const [actionFilter, setActionFilter] = useState<AuditAction | 'all'>('all')
  const [clearConfirm, setClearConfirm] = useState(false)

  const load = useCallback(async () => {
    try {
      const all = await window.electronAPI.db.getAuditLogs(10_000, 0)

      let filtered = all
      if (actionFilter !== 'all') filtered = filtered.filter(l => l.action === actionFilter)
      if (search) {
        const q = search.toLowerCase()
        filtered = filtered.filter(l =>
          l.action.toLowerCase().includes(q) ||
          (l.details?.toLowerCase().includes(q) ?? false)
        )
      }

      setTotal(filtered.length)
      setLogs(filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE))
    } catch { /* ignore */ }
  }, [page, search, actionFilter])

  useEffect(() => { load() }, [load])

  const handleClear = async () => {
    if (!clearConfirm) { setClearConfirm(true); setTimeout(() => setClearConfirm(false), 3000); return }
    await window.electronAPI.db.clearAuditLog()
    setPage(0)
    load()
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="p-6 sm:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black text-white tracking-tight">Audit Log</h1>
            <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-bold">
              {total} Events
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">Immutable security activity and extension log entries</p>
        </div>

        <button
          onClick={handleClear}
          className={`btn-danger flex-shrink-0 ${clearConfirm ? 'bg-rose-500/30 border-rose-500/50' : ''}`}
        >
          <Trash2 className="w-4 h-4" />
          <span>{clearConfirm ? 'Click to Confirm Clear' : 'Clear Audit Log'}</span>
        </button>
      </div>

      {/* Search & Filter */}
      <div className="bg-[#121420]/80 border border-white/10 rounded-2xl p-4 flex flex-wrap items-center gap-3 shadow-lg">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0) }}
            placeholder="Search audit details or actions..."
            className="input-field pl-10"
          />
        </div>

        <div className="relative">
          <select
            value={actionFilter}
            onChange={e => { setActionFilter(e.target.value as AuditAction | 'all'); setPage(0) }}
            className="input-field w-auto text-xs font-semibold py-2.5 cursor-pointer"
          >
            <option value="all" className="bg-[#141622]">All Action Types</option>
            <option value="LOGIN_SUCCESS" className="bg-[#141622]">Login Success</option>
            <option value="LOGIN_FAILED" className="bg-[#141622]">Login Failed</option>
            <option value="ADD_PASSWORD" className="bg-[#141622]">Add Password</option>
            <option value="DELETE_PASSWORD" className="bg-[#141622]">Delete Password</option>
            <option value="ADD_API_KEY" className="bg-[#141622]">Add API Key</option>
            <option value="EXTENSION_SAVE" className="bg-[#141622]">Extension Save</option>
            <option value="EXTENSION_AUTOFILL" className="bg-[#141622]">Extension Autofill</option>
            <option value="LOCK" className="bg-[#141622]">Vault Lock</option>
            <option value="UNLOCK" className="bg-[#141622]">Vault Unlock</option>
          </select>
        </div>
      </div>

      {/* Log Table */}
      <div className="bg-[#121420]/80 border border-white/10 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.02] text-slate-400 text-[11px] font-bold uppercase tracking-wider">
                <th className="px-5 py-3.5">Action Event</th>
                <th className="px-5 py-3.5">Details</th>
                <th className="px-5 py-3.5">Timestamp</th>
                <th className="px-5 py-3.5 text-center">Result Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-xs">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center text-slate-500 py-16">
                    <ClipboardList className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                    No audit records match your query
                  </td>
                </tr>
              ) : (
                logs.map(log => {
                  const style = ACTION_COLORS[log.action] ?? 'text-slate-300 bg-slate-500/10 border-slate-500/20'
                  return (
                    <tr key={log.id} className={`hover:bg-white/[0.03] transition-colors ${!log.success ? 'bg-rose-500/[0.03]' : ''}`}>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex px-2.5 py-1 rounded-full font-mono text-[11px] font-bold border ${style}`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 font-medium text-slate-300 max-w-sm truncate">
                        {log.details || '—'}
                      </td>
                      <td className="px-5 py-3.5 text-slate-400 font-mono text-[11px] whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        {log.success ? (
                          <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold">
                            <CheckCircle2 className="w-4 h-4" /> Success
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-rose-400 font-semibold">
                            <XCircle className="w-4 h-4" /> Failed
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table Pagination Footer */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3.5 border-t border-white/10 bg-[#0d0e16]">
            <span className="text-xs text-slate-400 font-medium">
              Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total} events
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="btn-secondary p-2 disabled:opacity-30"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-bold text-slate-300 font-mono px-2">
                Page {page + 1} / {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="btn-secondary p-2 disabled:opacity-30"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
