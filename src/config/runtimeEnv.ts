declare global {
  interface Window {
    __ENV__?: Partial<Record<string, string>>
  }
}

// 讀 VITE_* 設定的統一入口。優先讀 window.__ENV__——這是容器啟動時由
// docker-entrypoint.d/40-generate-env-config.sh 用「當下容器的實際環境變數」
// 產生出的 /env-config.js（index.html 裡搶在 main.tsx 之前載入）寫進去的，
// 讓同一個 Docker image 可以在 `docker run -e VITE_XXX=...` 時決定要接哪個
// Authentik，不用為了換一個 client_id 就重新 build image（不像 VITE_* 直接
// 交給 Vite 在 build time 烤進 JS 那樣，只能一個環境對應一個 image）。
// 沒有 window.__ENV__（本機 npm run dev／npm run build 直接跑）就 fallback
// 回 import.meta.env，靠 .env 檔案——本機開發流程完全不受影響。
export function getEnv(key: keyof ImportMetaEnv): string | undefined {
  const runtimeValue = window.__ENV__?.[key]
  if (runtimeValue) return runtimeValue
  return import.meta.env[key]
}
