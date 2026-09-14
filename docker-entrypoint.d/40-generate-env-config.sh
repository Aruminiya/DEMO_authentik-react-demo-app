#!/bin/sh
# nginx:alpine 的預設 entrypoint 會自動執行 /docker-entrypoint.d/ 底下所有可執行的
# *.sh（照檔名排序），在 nginx 真正啟動之前——不需要自己覆寫 ENTRYPOINT/CMD。
#
# 這支腳本的工作：把「容器啟動當下」實際的 VITE_* 環境變數，寫成一個
# env-config.js 靜態檔案蓋掉 public/env-config.js 的預設空值，讓
# src/config/runtimeEnv.ts 的 getEnv() 讀得到。這樣同一個 image 才能靠
# `docker run -e VITE_XXX=...`／docker-compose 的 environment: 決定要接哪個
# Authentik，不用像純 build-time 那樣每換一個環境就要重新 build image。
set -eu

ENV_CONFIG_PATH="/usr/share/nginx/html/env-config.js"

# 簡單 escape 反斜線跟雙引號，避免某個值裡剛好帶雙引號就把這個 JS 檔案弄壞
# （這裡假設環境變數是操作這個容器的人自己設的，不是不受信任的外部輸入）。
esc() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

{
  echo "window.__ENV__ = {"
  echo "  VITE_AUTHENTIK_AUTHORITY: \"$(esc "${VITE_AUTHENTIK_AUTHORITY:-}")\","
  echo "  VITE_AUTHENTIK_CLIENT_ID: \"$(esc "${VITE_AUTHENTIK_CLIENT_ID:-}")\","
  echo "  VITE_AUTHENTIK_REDIRECT_URI: \"$(esc "${VITE_AUTHENTIK_REDIRECT_URI:-}")\","
  echo "  VITE_AUTHENTIK_POST_LOGOUT_REDIRECT_URI: \"$(esc "${VITE_AUTHENTIK_POST_LOGOUT_REDIRECT_URI:-}")\","
  echo "  VITE_AUTHENTIK_SCOPE: \"$(esc "${VITE_AUTHENTIK_SCOPE:-openid profile email offline_access}")\","
  echo "  VITE_AUTHENTIK_ENROLLMENT_URL: \"$(esc "${VITE_AUTHENTIK_ENROLLMENT_URL:-}")\","
  echo "  VITE_DEMO_APP_NAME: \"$(esc "${VITE_DEMO_APP_NAME:-}")\","
  echo "  VITE_DEMO_APP_TYPE: \"$(esc "${VITE_DEMO_APP_TYPE:-product}")\","
  echo "  VITE_PORTAL_PRODUCTS: \"$(esc "${VITE_PORTAL_PRODUCTS:-}")\","
  echo "  VITE_THEME_COLOR: \"$(esc "${VITE_THEME_COLOR:-default}")\""
  echo "}"
} > "$ENV_CONFIG_PATH"

echo "[env-config] wrote $ENV_CONFIG_PATH from runtime environment"
