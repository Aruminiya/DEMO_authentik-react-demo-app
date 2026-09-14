import type { AuthProviderNoUserManagerProps } from 'react-oidc-context'

import { getEnv } from './runtimeEnv'

export const oidcConfig: AuthProviderNoUserManagerProps = {
  authority: getEnv('VITE_AUTHENTIK_AUTHORITY') ?? '',
  client_id: getEnv('VITE_AUTHENTIK_CLIENT_ID') ?? '',
  redirect_uri: getEnv('VITE_AUTHENTIK_REDIRECT_URI') ?? '',
  scope: getEnv('VITE_AUTHENTIK_SCOPE') || 'openid profile email offline_access',
  // offline_access 是 automaticSilentRenew 能不能運作的關鍵，不是可有可無的裝飾：
  // 有 refresh token 時 oidc-client-ts 走 refresh_token grant（自己 POST /token，第一方請求）；
  // 沒有的話會退回隱藏 iframe + prompt=none，而那條路仰賴把 Authentik 的 session cookie
  // 當第三方 cookie 送出去——app 與 Authentik 不同網域時會被瀏覽器擋掉，
  // Authentik 回 login_required。細節見 CLAUDE.md「Token 續期」。
  automaticSilentRenew: true,
  onSigninCallback: () => {
    window.history.replaceState({}, document.title, window.location.pathname)
  },
}

export const postLogoutRedirectUri: string =
  getEnv('VITE_AUTHENTIK_POST_LOGOUT_REDIRECT_URI') || window.location.origin + '/'
