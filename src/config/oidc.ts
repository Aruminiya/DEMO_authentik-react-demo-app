import type { AuthProviderNoUserManagerProps } from 'react-oidc-context'

import { getEnv } from './runtimeEnv'

export const oidcConfig: AuthProviderNoUserManagerProps = {
  authority: getEnv('VITE_AUTHENTIK_AUTHORITY') ?? '',
  client_id: getEnv('VITE_AUTHENTIK_CLIENT_ID') ?? '',
  redirect_uri: getEnv('VITE_AUTHENTIK_REDIRECT_URI') ?? '',
  scope: getEnv('VITE_AUTHENTIK_SCOPE') || 'openid profile email',
  automaticSilentRenew: true,
  onSigninCallback: () => {
    window.history.replaceState({}, document.title, window.location.pathname)
  },
}

export const postLogoutRedirectUri: string =
  getEnv('VITE_AUTHENTIK_POST_LOGOUT_REDIRECT_URI') || window.location.origin + '/'
