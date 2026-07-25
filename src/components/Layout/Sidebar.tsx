import React from 'react'
import {
  LayoutDashboard,
  KeyRound,
  Key,
  Wand2,
  ClipboardList,
  Settings,
  Lock,
  ShieldCheck,
  Zap,
} from 'lucide-react'
import { useAppStore } from '../../store/appStore'
import type { MainRoute } from '../../types'

interface NavItem {
  route:   MainRoute
  icon:    React.ReactNode
  label:   string
}

const NAV_ITEMS: NavItem[] = [
  { route: '/dashboard', icon: <LayoutDashboard className="w-4 h-4" />, label: 'Dashboard'  },
  { route: '/passwords', icon: <KeyRound        className="w-4 h-4" />, label: 'Passwords'  },
  { route: '/apikeys',   icon: <Key             className="w-4 h-4" />, label: 'API Keys'   },
  { route: '/generator', icon: <Wand2           className="w-4 h-4" />, label: 'Generator'  },
  { route: '/audit',     icon: <ClipboardList   className="w-4 h-4" />, label: 'Audit Log'  },
  { route: '/settings',  icon: <Settings        className="w-4 h-4" />, label: 'Settings'   },
]

export default function Sidebar(): React.ReactElement {
  const { currentRoute, setRoute, lock, extensionConnected, appVersion } = useAppStore()

  const handleLock = async () => {
    await window.electronAPI.db.addAuditLog('LOCK', 'Locked by user', true)
    lock()
  }

  return (
    <aside className="w-[250px] flex-shrink-0 h-full bg-[#10121b] border-r border-white/10 flex flex-col no-select shadow-2xl z-20">
      {/* Brand Header */}
      <div className="px-6 py-6 border-b border-white/10 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 p-0.5 shadow-lg shadow-indigo-500/25 flex items-center justify-center">
          <div className="w-full h-full bg-[#10121b] rounded-[10px] flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-indigo-400" />
          </div>
        </div>
        <div>
          <h1 className="font-extrabold text-white text-lg tracking-tight flex items-center gap-1">
            Secure<span className="text-gradient">Vault</span>
          </h1>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Enterprise Encryption</p>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3.5 py-5 space-y-1.5 overflow-y-auto custom-scrollbar">
        {NAV_ITEMS.map(({ route, icon, label }) => {
          const isActive = currentRoute === route
          return (
            <button
              key={route}
              id={`nav-${label.toLowerCase().replace(' ', '-')}`}
              onClick={() => setRoute(route)}
              className={`
                w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-semibold
                transition-all duration-200 text-left relative group
                ${isActive
                  ? 'bg-gradient-to-r from-indigo-600/20 to-purple-600/10 text-white border border-indigo-500/30 shadow-md shadow-indigo-500/10'
                  : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-200 border border-transparent'
                }
              `}
            >
              {/* Active Indicator Bar */}
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-6 bg-indigo-500 rounded-r-full shadow-[0_0_10px_#6366f1]" />
              )}
              <span className={`transition-transform duration-200 group-hover:scale-110 ${isActive ? 'text-indigo-400' : 'text-slate-500'}`}>
                {icon}
              </span>
              <span>{label}</span>
            </button>
          )
        })}
      </nav>

      {/* Footer Section */}
      <div className="p-4 border-t border-white/10 space-y-3 bg-[#0d0e16]">
        {/* Extension Connection Badge */}
        <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-white/[0.03] border border-white/5">
          <div className="flex items-center gap-2">
            <Zap className={`w-3.5 h-3.5 ${extensionConnected ? 'text-emerald-400 animate-pulse' : 'text-slate-500'}`} />
            <span className="text-xs font-medium text-slate-300">
              Extension {extensionConnected ? 'Connected' : 'Offline'}
            </span>
          </div>
          <div className={`w-2 h-2 rounded-full ${extensionConnected ? 'bg-emerald-400 shadow-[0_0_8px_#22c55e]' : 'bg-slate-600'}`} />
        </div>

        {/* Lock Vault Button */}
        <button
          id="lock-button"
          onClick={handleLock}
          className="w-full flex items-center justify-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider
            text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 hover:border-rose-500/40
            transition-all duration-200 active:scale-[0.98]"
        >
          <Lock className="w-4 h-4" />
          Lock Vault
        </button>

        {/* App Version */}
        <p className="text-center text-slate-500 text-[11px] font-mono">v{appVersion}</p>
      </div>
    </aside>
  )
}
