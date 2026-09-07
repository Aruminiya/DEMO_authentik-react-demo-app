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

**Authorization demo** (`src/pages/DashboardPage.tsx`): a "群組與權限" card demonstrates that Authentik does more than authenticate — it reads `auth.user.profile.groups` (an array, added via `IdTokenClaims`'s index signature since it isn't a standard OIDC claim) and gates a sample section on membership in `DEMO_GROUP` (`'engineering'`), rendering a success/lock `Alert` either way. This claim does **not** exist by default; without it the card degrades gracefully to an explanatory `Alert` rather than erroring — `groups` is `null` (claim absent) vs `[]` (claim present, empty) vs a populated array, and the UI branches on all three intentionally; preserve that distinction if you touch this component.

To actually populate the claim, set up on the Authentik side (all steps are in the Authentik admin UI, not this repo):
1. **使用者目錄 → 群組**：create the group (e.g. `engineering`) if it doesn't already exist.
2. **使用者目錄 → 使用者**：open the test account and add it to that group.
3. **Customization → Property Mappings**：create a **Scope Mapping** — Scope name `groups`, Expression:
   ```python
   return {
       "groups": [group.name for group in request.user.ak_groups.all()],
   }
   ```
4. **應用程式 → 供應商** → this provider → edit → **Scopes**: add the new `groups` mapping to Selected.
5. `.env`: add `groups` to `VITE_AUTHENTIK_SCOPE` (e.g. `openid profile email groups`), then restart `npm run dev` (env vars don't hot-reload).
6. Log in with the account from step 2 — the Dashboard's group chips and the `engineering`-gated demo section should now reflect real data.

The "Parents" and "角色 (Roles)" fields on the group-creation form are unrelated to this feature and can be left empty — Parents is group-hierarchy inheritance (a child group inherits its ancestors' Roles), and Roles grant permissions *inside the Authentik admin UI itself* (e.g. read-only access), not authorization for this app. Don't confuse the two: Groups gate what this app shows a user; Roles gate what a user can do to Authentik's own configuration.

**Styling**: a single MUI theme (`src/theme.ts`) applied via `ThemeProvider` + `CssBaseline` in `main.tsx`. No CSS modules or Tailwind — component styling is done with MUI's `sx` prop throughout. Note MUI v9's `Stack` only exposes `direction`/`spacing`/`divider`/`useFlexGap`/`sx`/`component` as props — `alignItems`/`justifyContent` etc. must go inside `sx`, not passed directly (unlike some older MUI versions/docs examples).

**TypeScript config** is split per the standard Vite template: `tsconfig.json` is a references-only root, `tsconfig.app.json` covers `src/` (strict, bundler resolution), `tsconfig.node.json` covers `vite.config.ts`.

## Session, logout & trust boundaries

Almost every confusing login/logout symptom in this app traces back to one of three separate trust boundaries. Misdiagnosing which one is at fault wastes time fixing the wrong layer:

1. **Browser storage vs. Authentik's cookie (different origins).** `sessionStorage` (`oidc-client-ts`'s default `userStore`) holds this app's tokens on `localhost:5174` — it's what `signoutRedirect()` or closing the tab clears. Authentik's own login state lives in a cookie on the Authentik origin (`localhost:9000`), invisible to this app's JS (cross-origin, likely `HttpOnly`). Clearing one never touches the other.
2. **App-scoped logout vs. Authentik-wide logout** — set by the OAuth2 Provider's **Invalidation Flow** (Authentik admin → Applications → Providers → this provider → Advanced flow settings; not to be confused with the similarly-named **Authorization Flow** field near the top of the same form, which only controls the login-time consent screen and has nothing to do with logout). `default-provider-invalidation-flow` ("Logged out of application") only ends this app's authorization, and is the correct, industry-standard default — it matches Google/Okta/Auth0 RP-Initiated Logout semantics. After `signoutRedirect()`, clicking sign-in again can silently succeed with no password prompt because Authentik's own session is still alive; **this is expected, not a bug**. Confirmed directly in the Postgres DB (`authentik_flows_flowstagebinding` joined to `authentik_flows_flow`): `default-provider-invalidation-flow` has **zero** stage bindings — it does nothing beyond the OIDC-aware redirect handling the end-session view itself provides. `default-invalidation-flow` ("Logout") has exactly one binding, a `UserLogoutStage` named `default-invalidation-logout`, which is what actually flushes `authentik_session` — but swapping a provider to this flow **cannot redirect back to this app** (it has no `client_id`/`post_logout_redirect_uri` handling) and strands the browser on a blank Authentik page even from an authenticated context. Don't use it here.

   Authentik's own docs call adding a `UserLogoutStage` to a provider's invalidation flow **"Single Logout (SLO)"** ([docs](https://docs.goauthentik.io/add-secure-apps/providers/single-logout/), [User logout stage](https://docs.goauthentik.io/add-secure-apps/flows-stages/stages/user_logout/)) — so the stage-add itself is a real, supported technique, not something we invented. The catch: **`default-provider-invalidation-flow` is very likely shared by every provider that hasn't been given its own Invalidation Flow.** Adding a `UserLogoutStage` directly to it turns *every* app's "sign out" into a full Single Logout — there is no way to make only one button (e.g. "切換使用者") stronger than another, since both call the same `signoutRedirect()` against the same provider's single Invalidation Flow setting. If a real "fully logs out" entry point is ever needed, the correct pattern (validated against how Google/Okta structure this — a dedicated account-management surface, not every app) is: give **one dedicated "portal"/hub application** its own **separate** Invalidation Flow — cloned from the empty `default-provider-invalidation-flow` (so it keeps correct OIDC redirect handling) **plus** a bound `UserLogoutStage` — and leave every other app's provider on the untouched, shared, empty `default-provider-invalidation-flow`. Don't repoint the shared default flow itself.
3. **Device trust.** Even a correctly-scoped logout only clears what the browser is willing to clear. Whether closing the browser ends the Authentik session depends on whether that cookie is session-only (dies with the browser) or persistent (check DevTools → Application → Cookies → Expires on the Authentik origin) — and a browser's "continue where you left off" / restore-previous-session setting deliberately keeps session cookies alive across a full restart, defeating that assumption. This is a device/browser-configuration concern (Guest/kiosk mode, a shorter Authentik session duration), not something fixable from this app's code or from the Invalidation Flow setting — don't try to solve "shared/public computer" safety by changing the Invalidation Flow default for everyone.

**`prompt: 'login'` is unreliable on Authentik.** Known upstream bugs ([goauthentik/authentik#12182](https://github.com/goauthentik/authentik/issues/12182), [#18507](https://github.com/goauthentik/authentik/issues/18507)) cause double-login prompts, silent skips, or (observed in this project) silently resuming a stale, non-current account after repeated use. Don't rely on it to guarantee re-authentication.

**`signoutRedirect()` needs an authenticated caller.** Calling it from a context where `auth.user` is already `null` — e.g. from `LoginPage`, which by definition only renders when unauthenticated — sends no `id_token_hint` and can strand the browser on a blank page. Only call `signoutRedirect()` from an authenticated context; `AppHeader.tsx`'s "登出此應用" (called with `auth.user` populated) is the only logout entry point proven reliable in this app.

A `LoginPage`-based "welcome back" UX (remembering the last signed-in user in `localStorage` to offer a Canva/Google-style account switcher, with a "use another account" action) was built and then reverted in this project specifically because of the two paragraphs above. Re-attempting it should account for both failure modes up front rather than rediscovering them.

**Authentik's actual cookie names** (confirmed by reading `authentik/root/settings.py` in the running `authentik-server-1` container, not guessed): `SESSION_COOKIE_NAME = "authentik_session"` (the one this whole section is about), `CSRF_COOKIE_NAME = "authentik_csrf"`, `LANGUAGE_COOKIE_NAME = "authentik_language"`, `COOKIE_NAME_KNOWN_DEVICE = "authentik_device"` (remembered-device tracking, in `stages/user_login/stage.py`), `COOKIE_NAME_MFA = "authentik_mfa"`, and `USER_SWITCHING_COOKIE_NAME = "authentik_user_switching"` (`authentik/core/user_switching.py`, backed by `authentik_core_userswitchingsession`).

That last one backs Authentik's real, native **[User account switching](https://docs.goauthentik.io/users-sources/user/user-switching)** feature — a browser can hold several already-authenticated accounts at once and flip between them from Authentik's own **User interface** header (requires System → Brands → Default flows → **User switch flow** to be set, otherwise the switcher is disabled entirely; it ships unset). This is *not* admin-only impersonation (that's a separate, similarly-plumbed thing) — but it is also **not reachable from this app, or any OIDC relying party, at all**: confirmed by reading `authorize.py` in the running container, `ALLOWED_PROMPT_PARAMS = {PROMPT_NONE, PROMPT_CONSENT, PROMPT_LOGIN}` — `select_account` (the OIDC prompt value that would trigger an account chooser) isn't a value Authentik's `/authorize` endpoint recognizes at all; it'd be silently dropped. The switcher only exists inside Authentik's own hosted pages. Don't spend time trying to wire this app's login button into it.

**This whole class of problem — an RP forcing re-authentication or a clean account switch — is an acknowledged, open gap in Authentik itself**, not something to keep re-investigating expecting a different outcome: [goauthentik/authentik#20845](https://github.com/goauthentik/authentik/issues/20845) ("Allow for setting re-authentication and inactivity timeout") is filed by Authentik's own maintainers/community as unresolved, and its own "alternatives considered" section describes the current workarounds (session validity + authenticator thresholds + token validity) as "not ideal, complex, leaves gaps." `max_age` is not a working substitute either per that issue. Every developer hitting this reaches for the same fallback: a private/incognito window (or a separate browser profile for a persistent "alt account") — that's industry-standard practice for session-cookie-based SSO in general (Google/Okta/Keycloak included), not a workaround specific to this project.

**There is deliberately no "切換使用者" button in this app.** One was prototyped in `AppHeader.tsx` (reusing `signoutRedirect()` plus a `localStorage` flag consumed by `LoginPage` to show an honest "use a private window" hint) and then removed — given everything above, it could never be more than a relabeled "登出此應用" with different copy, since both would call the identical `signoutRedirect()` against the same provider's single Invalidation Flow. `AppHeader.tsx`'s "登出此應用" is the only logout affordance in this app; the full design reasoning (including the `bon-portal` hub-app pattern for when a genuinely separate "full logout" surface is needed) lives in `docs/bon-portal-sso-logout-design.md`.
