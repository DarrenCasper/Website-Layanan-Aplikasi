import { createContext, useContext } from 'react'
import type { AuthUser } from '../lib/api'

export type AuthContextValue = {
  user: AuthUser | null
  token: string | null
  isAuthenticated: boolean
  login: (token: string, user: AuthUser) => void
  logout: () => void
}

// Kept apart from AuthProvider.tsx for the same reason the register context is
// split from its provider: react-refresh's only-export-components rule rejects a
// module that exports both a component and non-component values.
export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth must be used inside an AuthProvider')
  }

  return context
}
