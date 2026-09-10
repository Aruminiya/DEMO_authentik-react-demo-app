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
  const authority = import.meta.env.VITE_AUTHENTIK_AUTHORITY
  const discoveryRes = await fetch(`${authority}.well-known/openid-configuration`)
  const discovery: { end_session_endpoint: string } = await discoveryRes.json()

  const endSession = new URL(discovery.end_session_endpoint)
  const params = new URLSearchParams({
    client_id: import.meta.env.VITE_AUTHENTIK_CLIENT_ID,
    post_logout_redirect_uri: postLogoutRedirectUri,
  })
  if (idTokenHint) params.set('id_token_hint', idTokenHint)
  endSession.search = params.toString()

  const cancelUrl = new URL('/flows/-/cancel/', endSession)
  cancelUrl.searchParams.set('next', `${endSession.pathname}${endSession.search}`)
  window.location.href = cancelUrl.toString()
}
