import { getEnv } from '../config/runtimeEnv'

// 登出進行中的旗標。登出按鈕會先 auth.removeUser() 再導去 Authentik，但 removeUser()
// 一完成，ProtectedRoute 就看到「未登入」而馬上 signinRedirect()——兩個導頁在
// signoutWithCancelBounce() 的 await fetch() 縫隙裡競速，signinRedirect() 先搶到的話
// 瀏覽器根本不會走到 end-session，Authentik session 還在，立刻被 SSO 登回 Dashboard。
// ProtectedRoute 看到這個旗標就不自動登入。刻意用模組變數而不是 React state：
// 頁面接著就會整頁導走，不需要觸發重新渲染，只要 effect 執行時讀得到就好。
let signingOut = false

export function markSigningOut(): void {
  signingOut = true
}

export function isSigningOut(): boolean {
  return signingOut
}

// 繞過 Authentik 一個真實存在的 bug（在 2026.8.0 版確認過，完整追查過程見
// docs/bon-portal-sso-logout-design.md）：只要瀏覽器在 Authentik 網域的 session
// 裡還殘留著一個舊的 flow plan，EndSessionView.dispatch() 就會直接回傳一個空白
// 的 200，而不是正常導頁——而且幾乎每一次登出後都會留下這個殘留，因為
// SessionEndStage 是用 redirect challenge 收尾，永遠不會讓 FlowExecutorView.cancel()
// 有機會清掉它。解法是先繞去 Authentik 自己的 CancelView（它的工作就是清掉這個
// 殘留的 plan），清完才真的導向 end-session，白畫面就不會出現。如果直接呼叫
// auth.signoutRedirect()，並不會套用這個繞道，第二次以後登出就會撞到這個 bug。
export async function signoutWithCancelBounce(
  idTokenHint: string | undefined,
  postLogoutRedirectUri: string,
): Promise<void> {
  const authority = getEnv('VITE_AUTHENTIK_AUTHORITY') ?? ''
  const discoveryRes = await fetch(`${authority}.well-known/openid-configuration`)
  const discovery: { end_session_endpoint: string } = await discoveryRes.json()

  const endSession = new URL(discovery.end_session_endpoint)
  const params = new URLSearchParams({
    client_id: getEnv('VITE_AUTHENTIK_CLIENT_ID') ?? '',
    post_logout_redirect_uri: postLogoutRedirectUri,
  })
  if (idTokenHint) params.set('id_token_hint', idTokenHint)
  endSession.search = params.toString()

  const cancelUrl = new URL('/flows/-/cancel/', endSession)
  cancelUrl.searchParams.set('next', `${endSession.pathname}${endSession.search}`)
  window.location.href = cancelUrl.toString()
}
