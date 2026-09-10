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

## Docker

The published image is **environment-agnostic** — the same build works against any Authentik instance. `VITE_*` values aren't baked in at build time; a small script in `docker-entrypoint.d/` reads them from the container's actual environment at **startup** and writes them into a static `env-config.js` file the app reads at runtime (see `CLAUDE.md`'s "Docker deployment" section for exactly how). This means one image on Docker Hub can be `docker run` against as many different Authentik instances as you like — no rebuild per environment.

### Run the published image

First, in your own Authentik, create an OAuth2/OpenID Provider + Application (same as the "Setup" section above) and register `VITE_AUTHENTIK_REDIRECT_URI` / `VITE_AUTHENTIK_POST_LOGOUT_REDIRECT_URI` as Redirect URIs on it (Strict matching — byte-identical, trailing slash included).

```bash
docker run -d \
  -p 8080:80 \
  -e VITE_AUTHENTIK_AUTHORITY="https://sso.example.com/application/o/<your-provider-slug>/" \
  -e VITE_AUTHENTIK_CLIENT_ID="<your client_id>" \
  -e VITE_AUTHENTIK_REDIRECT_URI="https://your-domain/dashboard" \
  -e VITE_AUTHENTIK_POST_LOGOUT_REDIRECT_URI="https://your-domain" \
  <your-dockerhub-username>/authentik-react-demo-app:latest
```

| Variable | Required? | Default if unset |
| --- | --- | --- |
| `VITE_AUTHENTIK_AUTHORITY` | Yes | — |
| `VITE_AUTHENTIK_CLIENT_ID` | Yes | — |
| `VITE_AUTHENTIK_REDIRECT_URI` | Yes | — |
| `VITE_AUTHENTIK_POST_LOGOUT_REDIRECT_URI` | No | the app's own origin |
| `VITE_AUTHENTIK_SCOPE` | No | `openid profile email` |
| `VITE_AUTHENTIK_ENROLLMENT_URL` | No | no "Sign up" link shown |
| `VITE_DEMO_APP_NAME` | No | `React + Authentik OIDC Demo` |
| `VITE_DEMO_APP_TYPE` | No | `product` (`portal` shows an extra "其他產品" launcher card — see `VITE_PORTAL_PRODUCTS`) |
| `VITE_PORTAL_PRODUCTS` | No | none shown. Comma-separated URLs (e.g. `https://a.example.com,https://b.example.com`) — display name is derived from each URL's host, only used when `VITE_DEMO_APP_TYPE=portal` |
| `VITE_THEME_COLOR` | No | `default` (`#fd4b2d`) — also `blue`, `green`, `yellow`, `purple`, `pink`, `orange`, `cyan`, `indigo` |

### Build and publish your own image

```bash
docker build -t authentik-react-demo-app:latest .
docker tag authentik-react-demo-app:latest <your-dockerhub-username>/authentik-react-demo-app:latest
docker push <your-dockerhub-username>/authentik-react-demo-app:latest
```

### Run multiple products against one Authentik locally

`docker-compose.yml` runs four containers from this **same image** (a portal + three products, each with its own `environment:` block) to demo the "log into one, hop into the others without a password prompt" shared-Authentik-session flow:

```bash
npm run deploy   # docker compose up -d --build
```

## Tech

React 19 + Vite + MUI + React Router + `react-oidc-context` (`oidc-client-ts`
underneath). Linted with `oxlint`.
