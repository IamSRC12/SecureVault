import React, { useState, useEffect, useCallback } from 'react'
import { Plus, Search, Heart, KeyRound, Filter, ArrowUpDown } from 'lucide-react'
import { useAppStore } from '../../store/appStore'
import PasswordCard from './PasswordCard'
import AddPassword from './AddPassword'
import type { Credential, CredentialCategory, PasswordStrength } from '../../types'

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
    <div className="p-6 sm:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black text-white tracking-tight">Passwords</h1>
            <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-bold">
              {credentials.length} Total
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">Manage and auto-fill encrypted password vault items</p>
        </div>

        <button
          id="add-password-btn"
          onClick={() => setShowModal(true)}
          className="btn-primary flex-shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Add Password</span>
        </button>
      </div>

      {/* Search & Filter Controls */}
      <div className="bg-[#121420]/80 border border-white/10 rounded-2xl p-4 flex flex-wrap items-center gap-3 shadow-lg">
        {/* Search */}
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-400 pointer-events-none" />
          <input
            id="password-search"
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search accounts, domains, or emails..."
            className="input-field pl-10"
          />
        </div>

        {/* Category filter */}
        <div className="relative">
          <select
            value={category}
            onChange={e => setCategory(e.target.value as CredentialCategory | 'all')}
            className="input-field w-auto text-xs font-semibold py-2.5 cursor-pointer capitalize"
          >
            <option value="all" className="bg-[#141622]">All Categories</option>
            <option value="social" className="bg-[#141622]">Social</option>
            <option value="banking" className="bg-[#141622]">Banking</option>
            <option value="work" className="bg-[#141622]">Work</option>
            <option value="shopping" className="bg-[#141622]">Shopping</option>
            <option value="email" className="bg-[#141622]">Email</option>
            <option value="other" className="bg-[#141622]">Other</option>
          </select>
        </div>

        {/* Strength filter */}
        <div className="relative">
          <select
            value={strengthFilter}
            onChange={e => setStrengthFilter(e.target.value as PasswordStrength | 'all')}
            className="input-field w-auto text-xs font-semibold py-2.5 cursor-pointer"
          >
            <option value="all" className="bg-[#141622]">All Strengths</option>
            <option value="strong" className="bg-[#141622]">Strong</option>
            <option value="medium" className="bg-[#141622]">Medium</option>
            <option value="weak" className="bg-[#141622]">Weak</option>
          </select>
        </div>

        {/* Sort selector */}
        <div className="relative">
          <select
            value={sort}
            onChange={e => setSort(e.target.value as typeof sort)}
            className="input-field w-auto text-xs font-semibold py-2.5 cursor-pointer"
          >
            <option value="name-az" className="bg-[#141622]">Sort: A–Z</option>
            <option value="name-za" className="bg-[#141622]">Sort: Z–A</option>
            <option value="newest" className="bg-[#141622]">Newest First</option>
            <option value="oldest" className="bg-[#141622]">Oldest First</option>
            <option value="last-used" className="bg-[#141622]">Recently Used</option>
          </select>
        </div>

        {/* Favorites button */}
        <button
          onClick={() => setFavOnly(v => !v)}
          className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl border text-xs font-bold transition-all ${
            favOnly
              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-lg shadow-amber-500/10'
              : 'bg-white/5 text-slate-400 border-white/10 hover:border-amber-500/40 hover:text-amber-400'
          }`}
        >
          <Heart className={`w-4 h-4 ${favOnly ? 'fill-amber-400 text-amber-400' : ''}`} />
          <span>Favorites</span>
        </button>
      </div>

      {/* Grid Display */}
      {filtered.length === 0 ? (
        <div className="bg-[#121420]/60 border border-white/10 rounded-2xl flex flex-col items-center justify-center py-20 px-4 text-center">
          <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mb-4 text-indigo-400">
            <KeyRound className="w-8 h-8" />
          </div>
          <h3 className="text-white font-bold text-lg mb-1.5">
            {credentials.length === 0 ? 'No Passwords Saved' : 'No Matching Credentials'}
          </h3>
          <p className="text-slate-400 text-xs max-w-sm">
            {credentials.length === 0
              ? 'Add your first password to secure your credentials in your encrypted vault.'
              : 'Try clearing search or switching filter categories.'
            }
          </p>
          {credentials.length === 0 && (
            <button
              onClick={() => setShowModal(true)}
              className="btn-primary mt-5"
            >
              <Plus className="w-4 h-4" />
              <span>Add Password</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
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
