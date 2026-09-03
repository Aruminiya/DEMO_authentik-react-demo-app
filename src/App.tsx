import { useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from 'react-oidc-context'

import { FullscreenLoader } from './components/FullscreenState'
import { ProtectedRoute } from './components/ProtectedRoute'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import NotFoundPage from './pages/NotFoundPage'
import { saveLastUser } from './utils/lastUser'

function RootRedirect() {
  const auth = useAuth()
  
  if (auth.isLoading) {
    return <FullscreenLoader label="正在處理登入狀態…" />
  }

  return <Navigate to={auth.isAuthenticated ? '/dashboard' : '/login'} replace />
}

function App() {
  const auth = useAuth()

  useEffect(() => {
    if (auth.user?.profile) {
      saveLastUser({
        email: auth.user.profile.email,
        name: auth.user.profile.name || auth.user.profile.preferred_username,
      })
    }
  }, [auth.user])

  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}

export default App
