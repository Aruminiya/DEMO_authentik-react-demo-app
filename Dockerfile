# ---- Build stage ----
FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# 沒有任何 VITE_* 的 ARG/ENV——這個 build 是環境無關的，同一個 image 可以拿去
# 接任何一個 Authentik。VITE_* 的值改成容器啟動時才由
# docker-entrypoint.d/40-generate-env-config.sh 寫進 env-config.js
# （src/config/runtimeEnv.ts 讀的就是這個），不是這裡烤進 JS。
RUN npm run build

# ---- Serve stage ----
FROM nginx:alpine AS serve
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

# nginx:alpine 的預設 entrypoint 會在啟動前自動執行這裡的 *.sh（照檔名排序）。
COPY docker-entrypoint.d/40-generate-env-config.sh /docker-entrypoint.d/40-generate-env-config.sh
RUN chmod +x /docker-entrypoint.d/40-generate-env-config.sh

EXPOSE 80
