# ---- Build stage ----
FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Vite inlines VITE_* vars into the JS bundle at build time (see CLAUDE.md
# "Environment setup") — there is no runtime .env for a static build, so they
# must be supplied here via --build-arg, e.g.:
#   docker build \
#     --build-arg VITE_AUTHENTIK_AUTHORITY=https://sso.example.com/application/o/authentik-react-demo-app/ \
#     --build-arg VITE_AUTHENTIK_CLIENT_ID=xxxxx \
#     --build-arg VITE_AUTHENTIK_REDIRECT_URI=https://demo.example.com/login \
#     --build-arg VITE_AUTHENTIK_POST_LOGOUT_REDIRECT_URI=https://demo.example.com/login \
#     -t authentik-react-demo-app .
# A different Authentik/redirect URI per environment means a separate image
# build per environment — these values cannot be swapped at container start.
ARG VITE_AUTHENTIK_AUTHORITY
ARG VITE_AUTHENTIK_CLIENT_ID
ARG VITE_AUTHENTIK_REDIRECT_URI
ARG VITE_AUTHENTIK_POST_LOGOUT_REDIRECT_URI
ARG VITE_AUTHENTIK_SCOPE="openid profile email"
ARG VITE_AUTHENTIK_ENROLLMENT_URL
# Demo-only display/mode toggle (see docs/bon-portal-sso-logout-design.md) — same
# build-time-only caveat as the VITE_AUTHENTIK_* vars above.
ARG VITE_DEMO_APP_NAME
ARG VITE_DEMO_APP_TYPE
ARG VITE_PORTAL_PRODUCTS
# Switches src/theme.ts's MUI palette.primary.main — see THEME_COLORS there for
# the valid values (default/blue/green); unset or unrecognized falls back to
# 'default' rather than erroring.
ARG VITE_THEME_COLOR
ENV VITE_AUTHENTIK_AUTHORITY=$VITE_AUTHENTIK_AUTHORITY \
    VITE_AUTHENTIK_CLIENT_ID=$VITE_AUTHENTIK_CLIENT_ID \
    VITE_AUTHENTIK_REDIRECT_URI=$VITE_AUTHENTIK_REDIRECT_URI \
    VITE_AUTHENTIK_POST_LOGOUT_REDIRECT_URI=$VITE_AUTHENTIK_POST_LOGOUT_REDIRECT_URI \
    VITE_AUTHENTIK_SCOPE=$VITE_AUTHENTIK_SCOPE \
    VITE_AUTHENTIK_ENROLLMENT_URL=$VITE_AUTHENTIK_ENROLLMENT_URL \
    VITE_DEMO_APP_NAME=$VITE_DEMO_APP_NAME \
    VITE_DEMO_APP_TYPE=$VITE_DEMO_APP_TYPE \
    VITE_PORTAL_PRODUCTS=$VITE_PORTAL_PRODUCTS \
    VITE_THEME_COLOR=$VITE_THEME_COLOR

RUN npm run build

# ---- Serve stage ----
FROM nginx:alpine AS serve
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
