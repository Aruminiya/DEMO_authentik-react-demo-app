import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from 'react-oidc-context'
import { CssBaseline, ThemeProvider } from '@mui/material'

import { oidcConfig } from './config/oidc'
import { getEnv } from './config/runtimeEnv'
import { theme } from './theme'
import App from './App.tsx'

// vite.config.ts's htmlTitlePlugin already bakes VITE_DEMO_APP_NAME into
// index.html's <title> at build time — but for the runtime-configurable
// Docker image (see docker-entrypoint.d/), that build-time value is empty.
// This override picks up window.__ENV__ once it's available, without
// breaking the build-time title for local/non-Docker builds.
const runtimeAppName = getEnv('VITE_DEMO_APP_NAME')
if (runtimeAppName) {
  document.title = runtimeAppName
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider {...oidcConfig}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  </StrictMode>,
)
