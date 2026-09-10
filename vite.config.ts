import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

function htmlTitlePlugin(): Plugin {
  let appName = 'React + Authentik OIDC Demo'
  return {
    name: 'html-title-from-env',
    configResolved(config) {
      appName = config.env.VITE_DEMO_APP_NAME || appName
    },
    transformIndexHtml(html) {
      return html.replace(/<title>.*<\/title>/, `<title>${appName}</title>`)
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), htmlTitlePlugin()],
  server: {
    port: 5174,
    strictPort: true,
  },
})
