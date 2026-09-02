import type { AuthProviderNoUserManagerProps } from 'react-oidc-context'

export const oidcConfig: AuthProviderNoUserManagerProps = {
  authority: import.meta.env.VITE_AUTHENTIK_AUTHORITY,
  client_id: import.meta.env.VITE_AUTHENTIK_CLIENT_ID,
  redirect_uri: import.meta.env.VITE_AUTHENTIK_REDIRECT_URI,
  scope: import.meta.env.VITE_AUTHENTIK_SCOPE || 'openid profile email',
  automaticSilentRenew: true,
  onSigninCallback: () => {
    window.history.replaceState({}, document.title, window.location.pathname)
  },
}

export const postLogoutRedirectUri: string =
  import.meta.env.VITE_AUTHENTIK_POST_LOGOUT_REDIRECT_URI ||
  window.location.origin + '/'
