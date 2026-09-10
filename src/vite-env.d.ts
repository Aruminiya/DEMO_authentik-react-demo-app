/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_AUTHENTIK_AUTHORITY: string
  readonly VITE_AUTHENTIK_CLIENT_ID: string
  readonly VITE_AUTHENTIK_REDIRECT_URI: string
  readonly VITE_AUTHENTIK_POST_LOGOUT_REDIRECT_URI?: string
  readonly VITE_AUTHENTIK_SCOPE?: string
  readonly VITE_AUTHENTIK_ENROLLMENT_URL?: string
  readonly VITE_DEMO_APP_NAME?: string
  readonly VITE_DEMO_APP_TYPE?: string
  readonly VITE_PORTAL_PRODUCTS?: string
  readonly VITE_THEME_COLOR?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
