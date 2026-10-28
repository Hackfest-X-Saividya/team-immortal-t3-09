'use client'

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react'
import { useRouter } from 'next/navigation'
import {
  authService,
  DEFAULT_DEMO_SESSION,
  DEFAULT_DEMO_USER,
} from '@/services/auth.service'
import type { UserProfile, UserSession } from '@/types/auth'

export interface AuthContextType {
  session: UserSession
  user: UserProfile
  isHydrated: boolean
  signIn: (email: string, name?: string, workspaceName?: string) => void
  signUp: (profile: {
    name: string
    email: string
    workspaceName?: string
  }) => void
  signOut: () => void
  isAccessModalOpen: boolean
  accessModalMessage?: string
  openAccessModal: (customMessage?: string) => void
  closeAccessModal: () => void
  requestMutation: (actionName?: string) => boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [session, setSession] = useState<UserSession>(DEFAULT_DEMO_SESSION)
  const [isHydrated, setIsHydrated] = useState(false)
  const [isAccessModalOpen, setIsAccessModalOpen] = useState(false)
  const [accessModalMessage, setAccessModalMessage] = useState<string | undefined>()

  // Restore session from localStorage on initial mount
  useEffect(() => {
    const existing = authService.getStoredSession()
    if (existing) {
      setSession(existing)
    } else {
      const demo = authService.createDemoSession()
      setSession(demo)
    }
    setIsHydrated(true)
  }, [])

  const signIn = useCallback(
    (email: string, name?: string, workspaceName?: string) => {
      const newSession = authService.signInDemo(email, name, workspaceName)
      setSession(newSession)
    },
    []
  )

  const signUp = useCallback(
    (profile: { name: string; email: string; workspaceName?: string }) => {
      const newSession = authService.signUpDemo(profile)
      setSession(newSession)
    },
    []
  )

  const signOut = useCallback(() => {
    authService.signOut()
    const cleanDemo = authService.createDemoSession()
    setSession(cleanDemo)
    router.push('/')
  }, [router])

  const openAccessModal = useCallback((customMessage?: string) => {
    setAccessModalMessage(customMessage)
    setIsAccessModalOpen(true)
  }, [])

  const closeAccessModal = useCallback(() => {
    setIsAccessModalOpen(false)
    setAccessModalMessage(undefined)
  }, [])

  /**
   * Guards data-mutating actions:
   * Returns true if authenticated.
   * If in demo mode, opens the access modal and returns false.
   */
  const requestMutation = useCallback(
    (actionName?: string): boolean => {
      if (session.isAuthenticated) {
        return true
      }
      const message = actionName
        ? `You're exploring CarbonIQ in demo mode. Sign in or create an account to ${actionName} and manage your own sustainability data.`
        : undefined
      openAccessModal(message)
      return false
    },
    [session.isAuthenticated, openAccessModal]
  )

  const user = session.user || DEFAULT_DEMO_USER

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        isHydrated,
        signIn,
        signUp,
        signOut,
        isAccessModalOpen,
        accessModalMessage,
        openAccessModal,
        closeAccessModal,
        requestMutation,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
