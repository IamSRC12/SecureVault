import React, { useState, useEffect, useCallback } from 'react'
import { CheckCircle2, XCircle, Search, Trash2, ChevronLeft, ChevronRight } from 'lucide-react'
import type { AuditLog, AuditAction } from '../../types'

const PAGE_SIZE = 50

const ACTION_COLORS: Record<string, string> = {
  LOGIN_SUCCESS:          'text-[#22c55e]',
  LOGIN_FAILED:           'text-[#ef4444]',
  ADD_PASSWORD:           'text-[#6366f1]',
  EDIT_PASSWORD:          'text-[#8b5cf6]',
  DELETE_PASSWORD:        'text-[#ef4444]',
  ADD_API_KEY:            'text-[#6366f1]',
  EDIT_API_KEY:           'text-[#8b5cf6]',
  DELETE_API_KEY:         'text-[#ef4444]',
  EXTENSION_SAVE:         'text-[#22c55e]',
  EXTENSION_AUTOFILL:     'text-[#22c55e]',
  LOCK:                   'text-[#f59e0b]',
  UNLOCK:                 'text-[#22c55e]',
  SETUP_COMPLETE:         'text-[#6366f1]',
  CHANGE_MASTER_PASSWORD: 'text-[#f59e0b]',
  EXPORT_VAULT:           'text-[#94a3b8]',
  IMPORT_VAULT:           'text-[#94a3b8]',
  CLEAR_DATA:             'text-[#ef4444]',
  REGENERATE_TOKEN:       'text-[#f59e0b]',
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
      const all = await window.electronAPI.db.getAuditLogs(10_000, 0)   // Load all for client-side filtering

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
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[#f1f5f9]">Audit Log</h1>
        <button onClick={handleClear}
          className={`btn-danger ${clearConfirm ? 'bg-[#ef4444]/20' : ''}`}>
          <Trash2 className="w-4 h-4" />
          {clearConfirm ? 'Confirm Clear' : 'Clear Log'}
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#475569]" />
          <input type="text" value={search} onChange={e => { setSearch(e.target.value); setPage(0) }}
            placeholder="Search logs..." className="input-field pl-10" />
        </div>
        <select value={actionFilter} onChange={e => { setActionFilter(e.target.value as AuditAction | 'all'); setPage(0) }}
          className="input-field w-auto text-sm">
          <option value="all">All Actions</option>
          <option value="LOGIN_SUCCESS">Login Success</option>
          <option value="LOGIN_FAILED">Login Failed</option>
          <option value="ADD_PASSWORD">Add Password</option>
          <option value="DELETE_PASSWORD">Delete Password</option>
          <option value="ADD_API_KEY">Add API Key</option>
          <option value="EXTENSION_SAVE">Extension Save</option>
          <option value="EXTENSION_AUTOFILL">Extension Autofill</option>
          <option value="LOCK">Lock</option>
          <option value="UNLOCK">Unlock</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#2a2a2a]">
              <th className="text-left text-xs font-medium text-[#475569] px-4 py-3">Action</th>
              <th className="text-left text-xs font-medium text-[#475569] px-4 py-3">Details</th>
              <th className="text-left text-xs font-medium text-[#475569] px-4 py-3">Time</th>
              <th className="text-center text-xs font-medium text-[#475569] px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#2a2a2a]">
            {logs.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-center text-[#475569] text-sm py-12">No audit logs found</td>
              </tr>
            ) : (
              logs.map(log => (
                <tr key={log.id} className={`hover:bg-[#0f0f0f] transition-colors ${log.success ? '' : 'bg-[#ef4444]/3'}`}>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-mono font-medium ${ACTION_COLORS[log.action] ?? 'text-[#94a3b8]'}`}>
                      {log.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-[#94a3b8] max-w-xs truncate">{log.details || '—'}</td>
                  <td className="px-4 py-3 text-xs text-[#475569] whitespace-nowrap">
                    {new Date(log.timestamp).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {log.success ? (
                      <CheckCircle2 className="w-4 h-4 text-[#22c55e] inline" />
                    ) : (
                      <XCircle className="w-4 h-4 text-[#ef4444] inline" />
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <span className="text-xs text-[#475569]">
            Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total}
          </span>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
              className="p-1.5 rounded-lg text-[#475569] hover:text-[#f1f5f9] hover:bg-[#2a2a2a] disabled:opacity-50 disabled:cursor-not-allowed">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs text-[#94a3b8]">Page {page + 1} / {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
              className="p-1.5 rounded-lg text-[#475569] hover:text-[#f1f5f9] hover:bg-[#2a2a2a] disabled:opacity-50 disabled:cursor-not-allowed">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
