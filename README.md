# React + Authentik OIDC Demo

A small multi-page React app demonstrating a full OIDC Authorization Code
flow against [Authentik](https://goauthentik.io/), built with
[`react-oidc-context`](https://github.com/authts/react-oidc-context),
React Router and MUI.

## Features

- Card-style login page that kicks off `signinRedirect()`
- Protected `/dashboard` route (redirects to `/login` when not authenticated)
- Profile card with avatar, email, and granted scopes
- Live Access Token expiry countdown + manual "refresh token" action
  (`signinSilent()`)
- Decoded ID Token / Access Token claim viewer (JWT payload decoding, no
  extra dependency) with copy-to-clipboard for the raw token
- Logout via `signoutRedirect()`

## Setup

1. In Authentik, create an **OAuth2/OpenID Provider** + **Application**:
   - Redirect URI: `http://localhost:5174/login` — this must match
     `VITE_AUTHENTIK_REDIRECT_URI` **and** `VITE_AUTHENTIK_POST_LOGOUT_REDIRECT_URI`
     below exactly. Authentik validates both the login callback and the
     post-logout redirect against this same allow-list, so if you want to
     land somewhere else after logout, add that URL here too.
   - Scopes: `openid`, `profile`, `email`
2. Copy `.env.example` to `.env` and fill in your provider's values:

   ```bash
   cp .env.example .env
   ```

   | Variable | Description |
   | --- | --- |
   | `VITE_AUTHENTIK_AUTHORITY` | Issuer URL, e.g. `http://localhost:9000/application/o/authentik-react-demo-app/` |
   | `VITE_AUTHENTIK_CLIENT_ID` | Client ID from the Authentik provider |
   | `VITE_AUTHENTIK_REDIRECT_URI` | Must match the redirect URI configured in Authentik |
   | `VITE_AUTHENTIK_POST_LOGOUT_REDIRECT_URI` | Where Authentik sends the browser after logout |
   | `VITE_AUTHENTIK_SCOPE` | Space-separated OIDC scopes |
   | `VITE_AUTHENTIK_ENROLLMENT_URL` | Optional. URL of an Authentik Enrollment flow (`/if/flow/<slug>/`); shows a "Sign up" link on the login page when set |

3. Install dependencies and run the dev server:

   ```bash
   npm install
   npm run dev
   ```

4. Open http://localhost:5174 and click **使用 Authentik 登入**.

## Tech

React 19 + Vite + MUI + React Router + `react-oidc-context` (`oidc-client-ts`
underneath). Linted with `oxlint`.
