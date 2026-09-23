import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { AuthContext, type AuthContextValue } from './authContext'
import type { AuthUser } from '../lib/api'

const STORAGE_KEY = 'layap.auth'

type StoredAuth = {
  token: string
  user: AuthUser
}

// localStorage is user-editable and can hold a stale or truncated value, so a
// failed read is treated as "not logged in" rather than crashing the app.
function readStoredAuth(): StoredAuth | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)

    if (!raw) {
      return null
    }

    const parsed = JSON.parse(raw) as Partial<StoredAuth> | null

    if (!parsed || typeof parsed.token !== 'string' || !parsed.user) {
      return null
    }

    return { token: parsed.token, user: parsed.user }
  } catch {
    // Unparseable or unreadable storage means the session cannot be trusted.
    return null
  }
}

function persistAuth(value: StoredAuth | null) {
  try {
    if (value) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
    } else {
      window.localStorage.removeItem(STORAGE_KEY)
    }
  } catch {
    // Private browsing modes can reject writes. The in-memory session still works.
  }
}

// Holds the signed-in session for the whole app. Persisting to localStorage means
// a refresh keeps the user logged in.
function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<StoredAuth | null>(readStoredAuth)

  const login = useCallback((token: string, user: AuthUser) => {
    const next = { token, user }
    setAuth(next)
    persistAuth(next)
  }, [])

  const logout = useCallback(() => {
    setAuth(null)
    persistAuth(null)
  }, [])

  const contextValue = useMemo<AuthContextValue>(
    () => ({
      user: auth?.user ?? null,
      token: auth?.token ?? null,
      isAuthenticated: auth !== null,
      login,
      logout,
    }),
    [auth, login, logout],
  )

  return <AuthContext value={contextValue}>{children}</AuthContext>
}

export default AuthProvider
