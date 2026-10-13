import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/authContext'

type RequireAuthProps = {
  children: ReactNode
}

// The catalog screens are only meaningful for a signed-in visitor, so anyone
// arriving without a session is sent to the login form instead of being shown
// an empty shell. `replace` keeps the guarded URL out of the history stack.
function RequireAuth({ children }: RequireAuthProps) {
  const { isAuthenticated } = useAuth()

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

export default RequireAuth
