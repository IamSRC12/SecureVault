import React from 'react'
import Sidebar from './Sidebar'
import Dashboard from '../Dashboard/Dashboard'
import PasswordList from '../Passwords/PasswordList'
import ApiKeyList from '../ApiKeys/ApiKeyList'
import PasswordGenerator from '../Generator/PasswordGenerator'
import AuditLogView from '../Audit/AuditLogView'
import SettingsView from '../Settings/Settings'
import { useAppStore } from '../../store/appStore'
import type { MainRoute } from '../../types'

// ─── Route → Component Map ────────────────────────────────────────────────

const ROUTE_COMPONENTS: Record<MainRoute, React.ReactElement> = {
  '/dashboard': <Dashboard />,
  '/passwords': <PasswordList />,
  '/apikeys':   <ApiKeyList />,
  '/generator': <PasswordGenerator />,
  '/audit':     <AuditLogView />,
  '/settings':  <SettingsView />,
}

// ─── Main Layout ──────────────────────────────────────────────────────────

export default function MainLayout(): React.ReactElement {
  const currentRoute = useAppStore(s => s.currentRoute)

  return (
    <div className="flex h-screen bg-[#0f0f0f] overflow-hidden">
      <Sidebar />

      {/* Content area */}
      <main className="flex-1 overflow-y-auto">
        <div className="animate-in">
          {ROUTE_COMPONENTS[currentRoute] ?? <Dashboard />}
        </div>
      </main>
    </div>
  )
}
