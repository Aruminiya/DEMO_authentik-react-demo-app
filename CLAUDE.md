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

## Session, logout & trust boundaries

Almost every confusing login/logout symptom in this app traces back to one of three separate trust boundaries. Misdiagnosing which one is at fault wastes time fixing the wrong layer:

1. **Browser storage vs. Authentik's cookie (different origins).** `sessionStorage` (`oidc-client-ts`'s default `userStore`) holds this app's tokens on `localhost:5174` — it's what `signoutRedirect()` or closing the tab clears. Authentik's own login state lives in a cookie on the Authentik origin (`localhost:9000`), invisible to this app's JS (cross-origin, likely `HttpOnly`). Clearing one never touches the other.
2. **App-scoped logout vs. Authentik-wide logout** — set by the OAuth2 Provider's **Invalidation Flow** (Authentik admin → Applications → Providers → this provider → Advanced flow settings). `default-provider-invalidation-flow` ("Logged out of application") only ends this app's authorization, and is the correct, industry-standard default — it matches Google/Okta/Auth0 RP-Initiated Logout semantics. After `signoutRedirect()`, clicking sign-in again can silently succeed with no password prompt because Authentik's own session is still alive; **this is expected, not a bug**. Swapping to `default-invalidation-flow` ("Logout") does fully end the Authentik session but **cannot redirect back to this app** (it has no `client_id`/`post_logout_redirect_uri` handling) — it strands the browser on a blank Authentik page even when triggered from an authenticated context. Don't use it here. A real "full logout that still returns to the app" would require adding whatever stage `default-invalidation-flow` uses to flush the session into `default-provider-invalidation-flow`, not swapping flows wholesale.
3. **Device trust.** Even a correctly-scoped logout only clears what the browser is willing to clear. Whether closing the browser ends the Authentik session depends on whether that cookie is session-only (dies with the browser) or persistent (check DevTools → Application → Cookies → Expires on the Authentik origin) — and a browser's "continue where you left off" / restore-previous-session setting deliberately keeps session cookies alive across a full restart, defeating that assumption. This is a device/browser-configuration concern (Guest/kiosk mode, a shorter Authentik session duration), not something fixable from this app's code or from the Invalidation Flow setting — don't try to solve "shared/public computer" safety by changing the Invalidation Flow default for everyone.

**`prompt: 'login'` is unreliable on Authentik.** Known upstream bugs ([goauthentik/authentik#12182](https://github.com/goauthentik/authentik/issues/12182), [#18507](https://github.com/goauthentik/authentik/issues/18507)) cause double-login prompts, silent skips, or (observed in this project) silently resuming a stale, non-current account after repeated use. Don't rely on it to guarantee re-authentication.

**`signoutRedirect()` needs an authenticated caller.** Calling it from a context where `auth.user` is already `null` — e.g. from `LoginPage`, which by definition only renders when unauthenticated — sends no `id_token_hint` and can strand the browser on a blank page. Only call `signoutRedirect()` from an authenticated context; `AppHeader.tsx`'s "登出此應用" (called with `auth.user` populated) is the only logout entry point proven reliable in this app.

A `LoginPage`-based "welcome back" UX (remembering the last signed-in user in `localStorage` to offer a Canva/Google-style account switcher, with a "use another account" action) was built and then reverted in this project specifically because of the two paragraphs above. Re-attempting it should account for both failure modes up front rather than rediscovering them.
