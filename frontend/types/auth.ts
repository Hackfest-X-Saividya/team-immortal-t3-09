export type SessionMode = 'demo' | 'authenticated'

export interface UserProfile {
  id: string
  name: string
  email: string
  workspaceName: string
  createdAt?: string
  avatarUrl?: string
  initials?: string
}

export interface UserSession {
  mode: SessionMode
  isAuthenticated: boolean
  user: UserProfile
  createdAt: string
}

export type AuthMode = 'signin' | 'signup'
