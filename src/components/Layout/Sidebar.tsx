import React from 'react'
import {
  LayoutDashboard,
  KeyRound,
  Key,
  Wand2,
  ClipboardList,
  Settings,
  Lock,
  Shield,
  Circle,
} from 'lucide-react'
import { useAppStore } from '../../store/appStore'
import type { MainRoute } from '../../types'

// ─── Nav items definition ─────────────────────────────────────────────────

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

// ─── Sidebar ──────────────────────────────────────────────────────────────

export default function Sidebar(): React.ReactElement {
  const { currentRoute, setRoute, lock, extensionConnected, appVersion } = useAppStore()

  const handleLock = async () => {
    await window.electronAPI.db.addAuditLog('LOCK', 'Locked by user', true)
    lock()
  }

  return (
    <aside className="w-[240px] flex-shrink-0 h-full bg-[#1a1a1a] border-r border-[#2a2a2a] flex flex-col no-select">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-[#2a2a2a]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#6366f1]/10 border border-[#6366f1]/20 flex items-center justify-center flex-shrink-0">
            <Shield className="w-4 h-4 text-[#6366f1]" />
          </div>
          <span className="font-bold text-[#f1f5f9] text-base">
            Secure<span className="text-gradient">Vault</span>
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map(({ route, icon, label }) => {
          const isActive = currentRoute === route
          return (
            <button
              key={route}
              id={`nav-${label.toLowerCase().replace(' ', '-')}`}
              onClick={() => setRoute(route)}
              className={`
                w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
                transition-all duration-150 text-left
                ${isActive
                  ? 'bg-[#6366f1]/10 text-[#6366f1] border border-[#6366f1]/20'
                  : 'text-[#94a3b8] hover:bg-[#2a2a2a] hover:text-[#f1f5f9] border border-transparent'
                }
              `}
            >
              <span className={isActive ? 'text-[#6366f1]' : 'text-[#475569]'}>
                {icon}
              </span>
              {label}
            </button>
          )
        })}
      </nav>

      {/* Bottom section */}
      <div className="px-3 pb-4 border-t border-[#2a2a2a] pt-4 space-y-3">
        {/* Extension status */}
        <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-[#0f0f0f] border border-[#2a2a2a]">
          <Circle
            className="w-2.5 h-2.5 flex-shrink-0"
            fill={extensionConnected ? '#22c55e' : '#ef4444'}
            color={extensionConnected ? '#22c55e' : '#ef4444'}
          />
          <span className="text-xs text-[#94a3b8]">
            Extension {extensionConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>

        {/* Lock button */}
        <button
          id="lock-button"
          onClick={handleLock}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
            text-[#94a3b8] hover:bg-[#ef4444]/10 hover:text-[#ef4444] transition-all duration-150
            border border-transparent hover:border-[#ef4444]/20"
        >
          <Lock className="w-4 h-4" />
          Lock Vault
        </button>

        {/* Version */}
        <p className="text-center text-[#475569] text-xs">v{appVersion}</p>
      </div>
    </aside>
  )
}
