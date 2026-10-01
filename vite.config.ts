import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

import pkg from './package.json'

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
  // 版本號在 build 時寫死進 bundle，刻意不走 VITE_* 的 runtime 注入（getEnv()）：
  // 它描述的是「這份 bundle 是哪一版」，必須跟 image 綁在一起，不能讓部署時的環境變數改掉。
  // 和 scripts/push.sh 推上 Docker Hub 的 :<version> tag 是同一個來源。
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  server: {
    port: 5174,
    strictPort: true,
  },
})
