import React, { useState, useEffect, useCallback } from 'react'
import { Plus, Search, SlidersHorizontal, Heart, KeyRound } from 'lucide-react'
import { useAppStore } from '../../store/appStore'
import PasswordCard from './PasswordCard'
import AddPassword from './AddPassword'
import type { Credential, CredentialCategory, PasswordStrength } from '../../types'

// ─── Password List ────────────────────────────────────────────────────────

export default function PasswordList(): React.ReactElement {
  const { encryptionKey } = useAppStore()

  const [credentials, setCredentials] = useState<Credential[]>([])
  const [search,       setSearch]     = useState('')
  const [category,     setCategory]   = useState<CredentialCategory | 'all'>('all')
  const [strengthFilter, setStrengthFilter] = useState<PasswordStrength | 'all'>('all')
  const [sort,         setSort]       = useState<'name-az' | 'name-za' | 'newest' | 'oldest' | 'last-used'>('name-az')
  const [favOnly,      setFavOnly]    = useState(false)
  const [showModal,    setShowModal]  = useState(false)
  const [editTarget,   setEditTarget] = useState<Credential | undefined>()

  const load = useCallback(async () => {
    if (!encryptionKey) return
    try {
      const data = await window.electronAPI.db.getAllCredentials(encryptionKey.toString('hex'))
      setCredentials(data)
    } catch (err) {
      console.error('Failed to load credentials:', err)
    }
  }, [encryptionKey])

  useEffect(() => { load() }, [load])

  // Filter + sort
  const filtered = credentials
    .filter(c => {
      if (favOnly && !c.is_favorite) return false
      if (category !== 'all' && c.category !== category) return false
      if (strengthFilter !== 'all' && c.password_strength !== strengthFilter) return false
      if (search) {
        const q = search.toLowerCase()
        return (
          c.website_name.toLowerCase().includes(q) ||
          c.domain.toLowerCase().includes(q) ||
          (c.username?.toLowerCase().includes(q) ?? false) ||
          (c.email?.toLowerCase().includes(q) ?? false)
        )
      }
      return true
    })
    .sort((a, b) => {
      switch (sort) {
        case 'name-az':  return a.website_name.localeCompare(b.website_name)
        case 'name-za':  return b.website_name.localeCompare(a.website_name)
        case 'newest':   return new Date(b.date_created).getTime() - new Date(a.date_created).getTime()
        case 'oldest':   return new Date(a.date_created).getTime() - new Date(b.date_created).getTime()
        case 'last-used':
          if (!a.last_used) return 1
          if (!b.last_used) return -1
          return new Date(b.last_used).getTime() - new Date(a.last_used).getTime()
        default: return 0
      }
    })

  const handleEdit = (c: Credential) => {
    setEditTarget(c)
    setShowModal(true)
  }

  const handleCloseModal = () => {
    setShowModal(false)
    setEditTarget(undefined)
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-[#f1f5f9]">Passwords</h1>
          <span className="badge bg-[#6366f1]/10 text-[#6366f1] border border-[#6366f1]/20 text-xs px-2 py-0.5 rounded-full">
            {credentials.length}
          </span>
        </div>
        <button
          id="add-password-btn"
          onClick={() => setShowModal(true)}
          className="btn-primary"
        >
          <Plus className="w-4 h-4" />
          Add New
        </button>
      </div>

      {/* Search + filters */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#475569]" />
          <input
            id="password-search"
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search passwords..."
            className="input-field pl-10"
          />
        </div>

        {/* Category filter */}
        <select
          value={category}
          onChange={e => setCategory(e.target.value as CredentialCategory | 'all')}
          className="input-field w-auto text-sm"
        >
          <option value="all">All Categories</option>
          <option value="social">Social</option>
          <option value="banking">Banking</option>
          <option value="work">Work</option>
          <option value="shopping">Shopping</option>
          <option value="email">Email</option>
          <option value="other">Other</option>
        </select>

        {/* Strength filter */}
        <select
          value={strengthFilter}
          onChange={e => setStrengthFilter(e.target.value as PasswordStrength | 'all')}
          className="input-field w-auto text-sm"
        >
          <option value="all">All Strengths</option>
          <option value="strong">Strong</option>
          <option value="medium">Medium</option>
          <option value="weak">Weak</option>
        </select>

        {/* Sort */}
        <select
          value={sort}
          onChange={e => setSort(e.target.value as typeof sort)}
          className="input-field w-auto text-sm"
        >
          <option value="name-az">Name A–Z</option>
          <option value="name-za">Name Z–A</option>
          <option value="newest">Newest First</option>
          <option value="oldest">Oldest First</option>
          <option value="last-used">Last Used</option>
        </select>

        {/* Favorites toggle */}
        <button
          onClick={() => setFavOnly(v => !v)}
          className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-all ${
            favOnly
              ? 'bg-[#f59e0b]/10 text-[#f59e0b] border-[#f59e0b]/30'
              : 'bg-[#1a1a1a] text-[#94a3b8] border-[#2a2a2a] hover:border-[#f59e0b]/30'
          }`}
        >
          <Heart className={`w-4 h-4 ${favOnly ? 'fill-[#f59e0b]' : ''}`} />
          Favorites
        </button>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#1a1a1a] border border-[#2a2a2a] flex items-center justify-center mb-4">
            <KeyRound className="w-8 h-8 text-[#475569]" />
          </div>
          <h3 className="text-[#94a3b8] font-medium mb-2">
            {credentials.length === 0 ? 'No passwords saved yet' : 'No results found'}
          </h3>
          <p className="text-[#475569] text-sm">
            {credentials.length === 0
              ? 'Add your first password to get started.'
              : 'Try adjusting your search or filters.'
            }
          </p>
          {credentials.length === 0 && (
            <button
              onClick={() => setShowModal(true)}
              className="btn-primary mt-4"
            >
              <Plus className="w-4 h-4" />
              Add Password
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {filtered.map(c => (
            <PasswordCard
              key={c.id}
              credential={c}
              onEdit={handleEdit}
              onRefresh={load}
            />
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <AddPassword
          credential={editTarget}
          onClose={handleCloseModal}
          onSaved={load}
        />
      )}
    </div>
  )
}
