import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/authContext'

type RequireAuthProps = {
  children: ReactNode
}

// The catalog screens are only meaningful for a signed-in visitor, so anyone
// arriving without a session is sent to the login form instead of being shown
// an empty shell. `replace` keeps the guarded URL out of the history stack.
function RequireAuth({ children }: RequireAuthProps) {
  const { isAuthenticated } = useAuth()
  const location = useLocation()

  if (!isAuthenticated) {
    return (
      <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />
    )
  }

  return <>{children}</>
}

export default RequireAuth
