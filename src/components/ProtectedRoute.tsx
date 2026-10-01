import { useEffect, useRef, type ReactNode } from 'react'
import { hasAuthParams, useAuth } from 'react-oidc-context'

import { isSigningOut } from '../utils/authentikLogout'
import { FullscreenError, FullscreenLoader } from './FullscreenState'

type ProtectedRouteProps = {
  children: ReactNode
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const auth = useAuth()
  
  // 觀察 auth 的值，方便開發時確認登入狀態
  console.log('[ProtectedRoute] : ',auth)

  // 未登入時直接呼叫 signinRedirect()，不再導去 /login 頁面讓使用者手動按登入。
  // 等同 react-oidc-context 的 useAutoSignin()（同樣的條件、同樣只試一次），
  // 只多了 !isSigningOut()：useAutoSignin() 沒有暫停的選項，登出按鈕 removeUser()
  // 之後它會跟登出導頁搶先，把使用者 SSO 登回來。細節見 markSigningOut()。
  const hasTriedSignin = useRef(false)
  useEffect(() => {
    if (hasTriedSignin.current || isSigningOut()) return
    if (hasAuthParams() || auth.isAuthenticated || auth.activeNavigator || auth.isLoading) return
    hasTriedSignin.current = true
    void auth.signinRedirect()
  }, [auth])

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
