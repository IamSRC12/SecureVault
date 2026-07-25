import { Buffer } from 'buffer'
import { create } from 'zustand'
import type { AppScreen, MainRoute } from '../types'

// ─── State Shape ──────────────────────────────────────────────────────────

interface AppStore {
  // Auth state
  screen: AppScreen
  isSetupComplete: boolean
  isLocked: boolean
  encryptionKey: Buffer | null

  // App info
  appPath: string | null
  appVersion: string

  // Navigation
  currentRoute: MainRoute

  // Activity tracking (for auto-lock)
  lastActivity: number
  autoLockTimeout: number   // minutes; 0 = never

  // Extension
  extensionConnected: boolean
  extensionToken: string | null

  // UI
  isLoading: boolean
  loadingMessage: string

  // Actions
  setScreen: (screen: AppScreen) => void
  setSetupComplete: (complete: boolean) => void
  unlock: (key: Buffer) => void
  lock: () => void
  setAppPath: (path: string) => void
  setAppVersion: (version: string) => void
  setRoute: (route: MainRoute) => void
  updateActivity: () => void
  setAutoLockTimeout: (minutes: number) => void
  setExtensionConnected: (connected: boolean) => void
  setExtensionToken: (token: string | null) => void
  setLoading: (loading: boolean, message?: string) => void
}

// ─── Store ────────────────────────────────────────────────────────────────

export const useAppStore = create<AppStore>((set) => ({
  // Initial state
  screen:             'loading',
  isSetupComplete:    false,
  isLocked:           true,
  encryptionKey:      null,

  appPath:            null,
  appVersion:         '1.0.0',

  currentRoute:       '/dashboard',

  lastActivity:       Date.now(),
  autoLockTimeout:    5,

  extensionConnected: false,
  extensionToken:     null,

  isLoading:          false,
  loadingMessage:     '',

  // ─── Actions ───────────────────────────────────────────────────────────

  setScreen: (screen) => set({ screen }),

  setSetupComplete: (complete) =>
    set({ isSetupComplete: complete, screen: complete ? 'login' : 'setup' }),

  unlock: (key) =>
    set({
      isLocked:      false,
      encryptionKey: key,
      screen:        'main',
      lastActivity:  Date.now(),
    }),

  lock: () =>
    set({
      isLocked:      true,
      encryptionKey: null,   // Wipe key from memory
      screen:        'login',
      currentRoute:  '/dashboard',
    }),

  setAppPath:    (appPath)    => set({ appPath }),
  setAppVersion: (appVersion) => set({ appVersion }),
  setRoute:      (route)      => set({ currentRoute: route, lastActivity: Date.now() }),

  updateActivity: () => set({ lastActivity: Date.now() }),

  setAutoLockTimeout: (minutes) => set({ autoLockTimeout: minutes }),

  setExtensionConnected: (connected) => set({ extensionConnected: connected }),
  setExtensionToken:     (token)     => set({ extensionToken: token }),

  setLoading: (isLoading, loadingMessage = '') =>
    set({ isLoading, loadingMessage }),
}))

// ─── Selectors ────────────────────────────────────────────────────────────

export const selectEncryptionKey = (s: AppStore): Buffer | null => s.encryptionKey
export const selectIsLocked      = (s: AppStore): boolean => s.isLocked
export const selectCurrentRoute  = (s: AppStore): MainRoute => s.currentRoute
