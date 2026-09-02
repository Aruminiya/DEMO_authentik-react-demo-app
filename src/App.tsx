import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from 'react-oidc-context'

import { FullscreenLoader } from './components/FullscreenState'
import { ProtectedRoute } from './components/ProtectedRoute'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import NotFoundPage from './pages/NotFoundPage'

function RootRedirect() {
  const auth = useAuth()
  
  if (auth.isLoading) {
    return <FullscreenLoader label="正在處理登入狀態…" />
  }

  return <Navigate to={auth.isAuthenticated ? '/dashboard' : '/login'} replace />
}

function App() {
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
