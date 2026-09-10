import type { ReactNode } from 'react'
import { useAuth, useAutoSignin } from 'react-oidc-context'

import { FullscreenError, FullscreenLoader } from './FullscreenState'

type ProtectedRouteProps = {
  children: ReactNode
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const auth = useAuth()

  // 未登入時直接呼叫 signinRedirect()，不再導去 /login 頁面讓使用者手動按登入。
  useAutoSignin()

  if (auth.isLoading) {
    return <FullscreenLoader label="正在確認登入狀態…" />
  }

  // useAutoSignin() 只會自動嘗試一次，失敗後不會重試——沒有這個分支的話，
  // 使用者會卡在下面那個「正在導向登入」的 loading 畫面，看不到任何錯誤訊息。
  if (auth.error) {
    return <FullscreenError message={auth.error.message} onRetry={() => void auth.signinRedirect()} />
  }

  if (!auth.isAuthenticated) {
    return <FullscreenLoader label="正在導向 Authentik 登入…" />
  }

  return children
}
