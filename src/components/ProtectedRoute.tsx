import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from 'react-oidc-context'

import { FullscreenLoader } from './FullscreenState'

type ProtectedRouteProps = {
  children: ReactNode
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const auth = useAuth()
  const location = useLocation()

  if (auth.isLoading) {
    return <FullscreenLoader label="正在確認登入狀態…" />
  }

  if (!auth.isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return children
}
