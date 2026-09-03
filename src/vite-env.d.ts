/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_AUTHENTIK_AUTHORITY: string
  readonly VITE_AUTHENTIK_CLIENT_ID: string
  readonly VITE_AUTHENTIK_REDIRECT_URI: string
  readonly VITE_AUTHENTIK_POST_LOGOUT_REDIRECT_URI?: string
  readonly VITE_AUTHENTIK_SCOPE?: string
  readonly VITE_AUTHENTIK_ENROLLMENT_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
