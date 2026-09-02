# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install       # install dependencies
npm run dev       # start Vite dev server on port 5174 (strictPort — fails if taken instead of picking another port)
npm run build     # tsc -b (project-references typecheck, no emit) && vite build
npm run lint      # oxlint (TypeScript-aware by default, no separate type-check step)
npm run preview   # preview the production build
```

There is no test runner configured in this project.

`npm run build` will fail on type errors even though Vite itself would otherwise ignore them — `tsc -b` runs first and gates the Vite build.

## Environment setup

OIDC settings are read from `.env` at dev-server startup (`import.meta.env`, typed in `src/vite-env.d.ts`) — copy `.env.example` to `.env` and fill in real values. **Changes to `.env` require restarting `npm run dev`**; Vite does not hot-reload env vars.

The critical, non-obvious constraint (source of repeated "Redirect URI Error" / "Bad Request" failures against a real Authentik instance): Authentik validates `VITE_AUTHENTIK_REDIRECT_URI` (login callback) and `VITE_AUTHENTIK_POST_LOGOUT_REDIRECT_URI` (post-`signoutRedirect` landing page) against the **same** Redirect URIs allow-list on the OAuth2/OIDC provider. Both values must be byte-identical to an entry registered there (trailing slash and path matter). See the README setup section for the exact provider configuration.

## Architecture

This is a demo of the OIDC Authorization Code flow against Authentik, built with `react-oidc-context` (wraps `oidc-client-ts`), React Router, and MUI.

**Provider nesting** (`src/main.tsx`): `ThemeProvider` → `AuthProvider` (from `react-oidc-context`, configured via `src/config/oidc.ts`) → `BrowserRouter` → `App`. Auth state is accessed anywhere below `AuthProvider` via the `useAuth()` hook — there is no separate app-level auth context or state management.

**Routing** (`src/App.tsx`):
- `/` — `RootRedirect`, an inline component that waits out `auth.isLoading` and then navigates to `/dashboard` or `/login` based on `auth.isAuthenticated`. This is also where the OIDC redirect callback lands after `signinRedirect()`, since `AuthProvider` processes `?code=&state=` from `window.location` regardless of which route is mounted.
- `/login` — public; redirects to `/dashboard` (or `location.state.from`) if already authenticated.
- `/dashboard` — wrapped in `ProtectedRoute` (`src/components/ProtectedRoute.tsx`), which redirects to `/login` while preserving the origin location in router state.
- `*` — 404 page.

**Token display** (`src/pages/DashboardPage.tsx` + `src/components/TokenPanel.tsx` + `src/components/TokenExpiry.tsx`): decodes the ID/access token JWT payloads client-side via `src/utils/jwt.ts` (hand-rolled base64url decode, no `jwt-decode` dependency) purely for display — this is not used for any trust decision. `TokenExpiry` runs a `setInterval` off `auth.user.expires_at` for the live countdown; "refresh token" calls `auth.signinSilent()` directly.

**Styling**: a single MUI theme (`src/theme.ts`) applied via `ThemeProvider` + `CssBaseline` in `main.tsx`. No CSS modules or Tailwind — component styling is done with MUI's `sx` prop throughout. Note MUI v9's `Stack` only exposes `direction`/`spacing`/`divider`/`useFlexGap`/`sx`/`component` as props — `alignItems`/`justifyContent` etc. must go inside `sx`, not passed directly (unlike some older MUI versions/docs examples).

**TypeScript config** is split per the standard Vite template: `tsconfig.json` is a references-only root, `tsconfig.app.json` covers `src/` (strict, bundler resolution), `tsconfig.node.json` covers `vite.config.ts`.
