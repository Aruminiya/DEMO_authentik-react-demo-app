import type { ReactNode } from 'react'
import { useAuth, useAutoSignin } from 'react-oidc-context'

import { FullscreenError, FullscreenLoader } from './FullscreenState'

type ProtectedRouteProps = {
  children: ReactNode
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const auth = useAuth()
  
  // 觀察 auth 的值，方便開發時確認登入狀態
  console.log('[ProtectedRoute] : ',auth)

  // 未登入時直接呼叫 signinRedirect()，不再導去 /login 頁面讓使用者手動按登入。
  useAutoSignin()

  if (auth.isLoading) {
    return <FullscreenLoader label="正在確認登入狀態…" />
  }

  // useAutoSignin() 只會自動嘗試一次，失敗後不會重試——沒有這個分支的話，
  // 使用者會卡在下面那個「正在導向登入」的 loading 畫面，看不到任何錯誤訊息。
  //
  // 但只在「真的沒登入」時才擋：auth.error 也會被背景的 automaticSilentRenew 失敗設起來，
  // 那種情況使用者其實還登入著，不該被一個背景動作的失敗踢到全螢幕錯誤頁。
  if (auth.error && !auth.isAuthenticated) {
    return <FullscreenError message={auth.error.message} onRetry={() => void auth.signinRedirect()} />
  }

  if (!auth.isAuthenticated) {
    return <FullscreenLoader label="正在導向 Authentik 登入…" />
  }

  return children
}
