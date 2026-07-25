import React, { useState, useEffect, useCallback } from 'react'
import { Plus, Search, Heart, Key } from 'lucide-react'
import { useAppStore } from '../../store/appStore'
import ApiKeyCard from './ApiKeyCard'
import AddApiKey from './AddApiKey'
import type { ApiKey, ApiKeyCategory } from '../../types'

export default function ApiKeyList(): React.ReactElement {
  const { encryptionKey } = useAppStore()
  const [apiKeys,    setApiKeys]   = useState<ApiKey[]>([])
  const [search,     setSearch]    = useState('')
  const [category,   setCategory]  = useState<ApiKeyCategory | 'all'>('all')
  const [favOnly,    setFavOnly]   = useState(false)
  const [showModal,  setShowModal] = useState(false)
  const [editTarget, setEditTarget] = useState<ApiKey | undefined>()

  const load = useCallback(async () => {
    if (!encryptionKey) return
    try {
      const data = await window.electronAPI.db.getAllApiKeys(encryptionKey.toString('hex'))
      setApiKeys(data)
    } catch { /* ignore */ }
  }, [encryptionKey])

  useEffect(() => { load() }, [load])

  const filtered = apiKeys.filter(k => {
    if (favOnly && !k.is_favorite) return false
    if (category !== 'all' && k.category !== category) return false
    if (search) {
      const q = search.toLowerCase()
      return k.service_name.toLowerCase().includes(q) || (k.description?.toLowerCase().includes(q) ?? false)
    }
    return true
  })

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-[#f1f5f9]">API Keys</h1>
          <span className="badge bg-[#8b5cf6]/10 text-[#8b5cf6] border border-[#8b5cf6]/20 text-xs px-2 py-0.5 rounded-full">
            {apiKeys.length}
          </span>
        </div>
        <button id="add-apikey-btn" onClick={() => setShowModal(true)} className="btn-primary">
          <Plus className="w-4 h-4" /> Add New
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#475569]" />
          <input id="apikey-search" type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search API keys..." className="input-field pl-10" />
        </div>
        <select value={category} onChange={e => setCategory(e.target.value as ApiKeyCategory | 'all')} className="input-field w-auto text-sm">
          <option value="all">All Categories</option>
          <option value="ai">AI</option>
          <option value="cloud">Cloud</option>
          <option value="payment">Payment</option>
          <option value="communication">Communication</option>
          <option value="development">Development</option>
          <option value="other">Other</option>
        </select>
        <button onClick={() => setFavOnly(v => !v)}
          className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-all ${
            favOnly ? 'bg-[#f59e0b]/10 text-[#f59e0b] border-[#f59e0b]/30' : 'bg-[#1a1a1a] text-[#94a3b8] border-[#2a2a2a]'}`}>
          <Heart className={`w-4 h-4 ${favOnly ? 'fill-[#f59e0b]' : ''}`} /> Favorites
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#1a1a1a] border border-[#2a2a2a] flex items-center justify-center mb-4">
            <Key className="w-8 h-8 text-[#475569]" />
          </div>
          <h3 className="text-[#94a3b8] font-medium mb-2">
            {apiKeys.length === 0 ? 'No API keys saved yet' : 'No results found'}
          </h3>
          {apiKeys.length === 0 && (
            <button onClick={() => setShowModal(true)} className="btn-primary mt-4">
              <Plus className="w-4 h-4" /> Add API Key
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {filtered.map(k => (
            <ApiKeyCard key={k.id} apiKey={k} onEdit={ak => { setEditTarget(ak); setShowModal(true) }} onRefresh={load} />
          ))}
        </div>
      )}

      {showModal && (
        <AddApiKey apiKey={editTarget} onClose={() => { setShowModal(false); setEditTarget(undefined) }} onSaved={load} />
      )}
    </div>
  )
}
