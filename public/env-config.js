// 本機開發／純 npm run build 用的預設值——刻意留空物件，讓 src/config/runtimeEnv.ts
// 的 getEnv() 直接 fallback 回 import.meta.env（.env 檔案那一套）。
// 部署到 Docker 容器時，這個檔案會被 docker-entrypoint.d/40-generate-env-config.sh
// 在容器啟動當下，用實際的 VITE_* 環境變數整個蓋掉，不要手動改這個檔案本身的內容。
window.__ENV__ = {}
