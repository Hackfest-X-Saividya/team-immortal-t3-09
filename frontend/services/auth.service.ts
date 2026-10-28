import type { UserProfile, UserSession } from '../types/auth'

export const SESSION_STORAGE_KEY = 'carboniq_session'

/**
 * Computes a two-letter uppercase initial pair from a full name.
 * e.g., "Aarav Kapoor" -> "AK", "Priya" -> "PR"
 */
export function computeInitials(name?: string): string {
  if (!name || !name.trim()) return 'CI'
  const cleaned = name.trim()
  const parts = cleaned.split(/\s+/)
  if (parts.length === 1) {
    return parts[0].substring(0, 2).toUpperCase()
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/**
 * Derives a human-friendly name from an email address when a full name is not entered.
 * e.g., "priya.sharma@example.com" -> "Priya Sharma"
 */
export function formatNameFromEmail(email: string): string {
  if (!email || !email.includes('@')) return 'CarbonIQ User'
  const prefix = email.split('@')[0]
  const words = prefix.replace(/[._-]+/g, ' ').trim().split(/\s+/)
  return words
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
}

export const DEFAULT_DEMO_USER: UserProfile = {
  id: 'demo-user-aarav',
  name: 'Aarav Kapoor',
  email: 'demo@carboniq.local',
  workspaceName: 'Demo Workspace',
  createdAt: '2026-10-01T00:00:00.000Z',
  initials: 'AK',
}

export const DEFAULT_DEMO_SESSION: UserSession = {
  mode: 'demo',
  isAuthenticated: false,
  user: DEFAULT_DEMO_USER,
  createdAt: '2026-10-01T00:00:00.000Z',
}

function isValidSession(session: any): session is UserSession {
  if (!session || typeof session !== 'object') return false
  if (session.mode !== 'demo' && session.mode !== 'authenticated') return false
  if (typeof session.isAuthenticated !== 'boolean') return false
  if (!session.user || typeof session.user !== 'object') return false
  const u = session.user
  if (typeof u.name !== 'string' || !u.name.trim()) return false
  if (typeof u.email !== 'string') return false
  return true
}

/**
 * Frontend auth service managing demo and authenticated demo sessions.
 * Never stores passwords. Prepares clean single-workspace signatures for FastAPI endpoints.
 */
export const authService = {
  getStoredSession(): UserSession | null {
    if (typeof window === 'undefined') return null
    try {
      const stored = localStorage.getItem(SESSION_STORAGE_KEY)
      if (!stored) return null
      const parsed = JSON.parse(stored)
      if (isValidSession(parsed)) {
        return {
          ...parsed,
          user: {
            ...parsed.user,
            id: parsed.user.id || (parsed.mode === 'demo' ? 'demo-user-aarav' : 'user-auth'),
            workspaceName: parsed.user.workspaceName || (parsed.mode === 'demo' ? 'Demo Workspace' : 'Sustainability Workspace'),
            initials: parsed.user.initials || computeInitials(parsed.user.name),
          },
        }
      }
      return null
    } catch {
      return null
    }
  },

  saveSession(session: UserSession): void {
    if (typeof window === 'undefined') return
    try {
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session))
    } catch {
      // Storage unavailable or disabled in sandbox
    }
  },

  createDemoSession(workspaceName: string = 'Demo Workspace'): UserSession {
    const session: UserSession = {
      mode: 'demo',
      isAuthenticated: false,
      user: {
        ...DEFAULT_DEMO_USER,
        workspaceName,
      },
      createdAt: new Date().toISOString(),
    }
    this.saveSession(session)
    return session
  },

  signInDemo(
    email: string,
    providedName?: string,
    workspaceName?: string
  ): UserSession {
    const name = providedName?.trim() || formatNameFromEmail(email)
    const session: UserSession = {
      mode: 'authenticated',
      isAuthenticated: true,
      user: {
        id: `user-${Date.now().toString(36)}`,
        name,
        email: email.trim(),
        workspaceName: workspaceName?.trim() || 'Sustainability Workspace',
        initials: computeInitials(name),
        createdAt: new Date().toISOString(),
      },
      createdAt: new Date().toISOString(),
    }
    this.saveSession(session)
    return session
  },

  signUpDemo(profile: {
    name: string
    email: string
    workspaceName?: string
  }): UserSession {
    const name = profile.name.trim()
    const session: UserSession = {
      mode: 'authenticated',
      isAuthenticated: true,
      user: {
        id: `user-${Date.now().toString(36)}`,
        name,
        email: profile.email.trim(),
        workspaceName: profile.workspaceName?.trim() || `${name}'s Workspace`,
        initials: computeInitials(name),
        createdAt: new Date().toISOString(),
      },
      createdAt: new Date().toISOString(),
    }
    this.saveSession(session)
    return session
  },

  signOut(): void {
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(SESSION_STORAGE_KEY)
      } catch {
        // Storage unavailable
      }
    }
  },
}
