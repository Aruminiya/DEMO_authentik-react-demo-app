# Cloud Run 部署手冊

> 這份文件記錄把這個 demo（1 個 portal + 3 個 product）部署到 GCP Cloud Run 的完整流程、每一個指令，以及實際踩過的坑。搭配 `CLAUDE.md` 的「Docker deployment」和「Token renewal」兩節服用。
>
> 核心前提：**image 是環境無關的**（`VITE_*` 在容器啟動時才由 `docker-entrypoint.d/40-generate-env-config.sh` 寫成 `env-config.js`，不是 build 時烤進 JS）。所以四個服務共用同一個 image，只差 `--set-env-vars`。

## 0. 一次性前置設定

```bash
gcloud auth login                 # 憑證會過期，過期時 gcloud 會噴 Reauthentication failed
docker login                      # 推 image 到 Docker Hub 用
docker buildx create --name multiarch --use   # 只需要建一次
```

**⚠️ 專案不是 gcloud 的預設值。** 這個 demo 部署在：

| 項目 | 值 |
|---|---|
| GCP 專案 ID | `data-bonvies`（顯示名稱 Bonvies-Website，專案編號 `659135873838`） |
| 區域 | `asia-east1` |
| Docker Hub image | `aruminiya/authentik-react-demo-app` |
| Authentik | `https://authentik-sso.bonvies.com` |

`gcloud config` 的預設專案是別的（`drqq-bonvies-erp`），所以**每個指令都要明確帶 `--project=data-bonvies`**，不要依賴預設值。

## 1. 建置並推送 image

```bash
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t aruminiya/authentik-react-demo-app:latest \
  --push .
```

**`--platform linux/amd64` 是必要的，不是可選。** 在 Apple Silicon Mac 上直接 `docker build` 產出的是 `linux/arm64`，而 **Cloud Run 只執行 amd64** —— 部署時會失敗在 `Container manifest type ... must support amd64/linux`。同時保留 arm64 是為了讓本機的 `docker compose` 還能用同一個 tag。

`buildx --push` 不會把結果放進本機 `docker images`（multi-arch manifest 沒辦法用單一本機 image 表示），這是正常的。

## 2. 取得 manifest digest

```bash
docker buildx imagetools inspect aruminiya/authentik-react-demo-app:latest
# 記下最上面那個 Digest: sha256:...（是 manifest list 的 digest，不是某個平台的）
```

推送時的輸出也會有：`pushing manifest for docker.io/...@sha256:...`。

## 3. 首次部署一個服務

以 portal 為例。product 服務把 `portal` 換成 `product-01`、主題色換掉、`VITE_DEMO_APP_TYPE` 改成 `product`、拿掉 `VITE_PORTAL_PRODUCTS` 即可。

```bash
PROJ=data-bonvies
REGION=asia-east1
B=659135873838.asia-east1.run.app
DIGEST=sha256:<步驟 2 記下的>

gcloud run deploy authentik-react-demo-app-portal \
  --project=$PROJ --region=$REGION \
  --image="aruminiya/authentik-react-demo-app@$DIGEST" \
  --port=80 \
  --allow-unauthenticated \
  --min-instances=0 \
  --set-env-vars="^@^\
VITE_AUTHENTIK_AUTHORITY=https://authentik-sso.bonvies.com/application/o/authentik-react-demo-app-portal/@\
VITE_AUTHENTIK_CLIENT_ID=<從 Authentik 該 provider 複製>@\
VITE_AUTHENTIK_REDIRECT_URI=https://authentik-react-demo-app-portal-$B/login@\
VITE_AUTHENTIK_POST_LOGOUT_REDIRECT_URI=https://authentik-react-demo-app-portal-$B/login@\
VITE_AUTHENTIK_SCOPE=openid profile email offline_access@\
VITE_DEMO_APP_NAME=authentik-react-demo-app-portal@\
VITE_DEMO_APP_TYPE=portal@\
VITE_THEME_COLOR=default@\
VITE_PORTAL_PRODUCTS=https://authentik-react-demo-app-product-01-$B/dashboard,https://authentik-react-demo-app-product-02-$B/dashboard,https://authentik-react-demo-app-product-03-$B/dashboard"
```

三個關鍵參數：

- **`--port=80`** —— Cloud Run 預設把流量送到 8080，但 `nginx.conf` 寫死 `listen 80`。不指定就會啟動失敗。
- **`--allow-unauthenticated`** —— 這是給瀏覽器看的公開網站；不加的話會變成需要 Google IAM token 才進得去。
- **`^@^`** —— gcloud 的自訂分隔符語法。`VITE_PORTAL_PRODUCTS` 的值本身含逗號，用預設的逗號分隔會被拆成好幾個變數。

網址是可預測的：`https://<服務名>-659135873838.asia-east1.run.app`。

## 4. 之後：只改設定（不用 rebuild）

因為 image 是環境無關的，改任何 `VITE_*` 都**不需要重新 build**：

```bash
gcloud run services update authentik-react-demo-app-portal \
  --project=data-bonvies --region=asia-east1 \
  --update-env-vars="VITE_THEME_COLOR=blue"

# 值裡面有逗號時同樣要換分隔符
gcloud run services update authentik-react-demo-app-portal \
  --project=data-bonvies --region=asia-east1 \
  --update-env-vars="^@^VITE_PORTAL_PRODUCTS=https://a/dashboard,https://b/dashboard"
```

## 5. 之後：改了程式碼

```bash
# 1. 重新 build + push
docker buildx build --platform linux/amd64,linux/arm64 \
  -t aruminiya/authentik-react-demo-app:latest --push .

# 2. 取得新的 digest
docker buildx imagetools inspect aruminiya/authentik-react-demo-app:latest

# 3. 四個服務都用 digest 重新部署
DIGEST=sha256:<新的>
for s in portal product-01 product-02 product-03; do
  gcloud run deploy authentik-react-demo-app-$s \
    --project=data-bonvies --region=asia-east1 \
    --image="aruminiya/authentik-react-demo-app@$DIGEST" \
    --quiet
done
```

`gcloud run deploy` 只指定 `--image` 時，其餘設定（環境變數、port、IAM）都會保留，不會被洗掉。

### ⚠️ 一定要用 digest，不能用 `:latest`

Cloud Run 會把 Docker Hub 的 image 改寫成 `mirror.gcr.io/...` 這個 pull-through 快取。**對 `:latest` 這種會變動的 tag，它會回一份過期的 digest —— 而且部署會回報成功。**

實測過：推了新 image、四個服務 `--image=...:latest` 全部 `has been deployed`，但跑的還是舊 bundle。用 digest 部署才會拿到新的。

發現方法：

```bash
gcloud run revisions describe <revision-name> \
  --project=data-bonvies --region=asia-east1 \
  --format='value(status.imageDigest)'
# 拿這個跟你剛推上去的 digest 比對
```

想從根本避開，就每次 build 給一個唯一的 tag（`:v3`、`:20260914`），不要一直覆蓋 `:latest`。

## 6. Authentik 端的必做設定

程式碼和 Cloud Run 都對了，但這幾項沒設好一樣不能用。每個 provider 都要做一次。

### 6.1 Redirect URIs —— 注意「類型」欄位

供應商 → 編輯 → **重新導向到 URI**。每一列有三個欄位：比對模式、**類型**、網址。

| 類型 | 要填什麼 | 對應的環境變數 |
|---|---|---|
| **授權 (Authorization)** | 這個 app 自己的登入落地頁 | `VITE_AUTHENTIK_REDIRECT_URI` |
| **Post Logout** | 登出後要導去哪 | `VITE_AUTHENTIK_POST_LOGOUT_REDIRECT_URI` |

**類型選錯不會有任何錯誤訊息**，只會在對應的流程失敗。`end_session.py:93` 只比對類型是 Logout 的那些列（`models.py:414`），一列都沒有的話整段驗證會被跳過 —— 不報錯，但登出後停在 Authentik 頁面不導回。

本專案的設計是 product 登出後回到 portal，所以三個 product 的 Post Logout 那列填的是 **portal 的網址**，不是自己的：

```
product-0X 的 provider：
  授權        https://authentik-react-demo-app-product-0X-659135873838.asia-east1.run.app/dashboard
  Post Logout https://authentik-react-demo-app-portal-659135873838.asia-east1.run.app/dashboard
```

比對是 strict 的，**連結尾斜線都算**。另外不要從 Cloud Run 主控台複製網址 —— 主控台顯示的是另一種舊格式（`<服務名>-ekwnflvwma-de.a.run.app`），跟 app 實際送出的 `-659135873838.asia-east1.run.app` 不同，登記了也不會生效。

### 6.2 Scopes —— `offline_access`

供應商 → 編輯 → 最底部展開 **進階協定設定** → **範圍 (Scopes)**，把內建的 `authentik default OAuth Mapping: OpenID 'offline_access'` 從左邊移到右邊。

沒做的話 `authorize.py:295-301` 會**靜默**把 `offline_access` 從請求裡拿掉（只寫一行 log，不報錯），token 續期就會退回隱藏 iframe，跨網域部署時必定失敗。完整原理見 `CLAUDE.md` 的「Token renewal」。

### 6.3 Grant types

同一個編輯畫面，確認 **Refresh token** 有勾選。

### 6.4 設定完要重新登入

refresh token 只在授權碼交換的當下發放，現有 session 補不到。必須完全登出再重新登入一次。

## 7. 驗證

```bash
B=659135873838.asia-east1.run.app
A=https://authentik-sso.bonvies.com/application/o

# 7.1 各服務實際生效的環境變數（env-config.js 是容器啟動時寫出來的，公開可讀）
for s in portal product-01 product-02 product-03; do
  echo "===== $s ====="
  curl -s "https://authentik-react-demo-app-$s-$B/env-config.js"
done

# 7.2 Redirect URI 有沒有登記進 Authentik
#     原理：provider.py:197 的 discovery endpoint 拿 provider 的 redirect_uris 當允許的 CORS Origin，
#     所以有回 Access-Control-Allow-Origin 就代表這個 origin 在清單裡（驗不出類型，類型要自己看畫面）
chk() {
  h=$(curl -s -D - -o /dev/null -H "Origin: $2" \
      "$A/$1/.well-known/openid-configuration" | grep -i '^access-control-allow-origin')
  [ -n "$h" ] && echo "  ✅ $3" || echo "  ❌ $3"
}
PORTAL="https://authentik-react-demo-app-portal-$B"
chk authentik-react-demo-app-portal "$PORTAL" "portal 自己"
for n in 01 02 03; do
  chk "authentik-react-demo-app-product-$n" "https://authentik-react-demo-app-product-$n-$B" "product-$n 自己"
  chk "authentik-react-demo-app-product-$n" "$PORTAL" "product-$n 放行 portal（登出用）"
done

# 7.3 部署的是不是新程式碼
for s in portal product-01 product-02 product-03; do
  js=$(curl -s "https://authentik-react-demo-app-$s-$B/" | grep -o 'assets/index-[A-Za-z0-9_-]*\.js' | head -1)
  echo "$s  $js"     # 四個應該一樣，而且改過程式碼後這個 hash 一定會變
done
```

**token 續期是否修好**，要在瀏覽器裡看（重新登入後）：

- Session Storage 的 `oidc.user:...` → `scope` 欄位含 `offline_access`、且多出 `refresh_token` 欄位 → ✅
- Network 分頁（篩選器要切到「全部」，iframe 是文件請求不是 Fetch/XHR）→ 不再有 `authorize?...&prompt=none` → ✅

## 8. 疑難排解

以下每一項都是這個專案實際踩過的。

| 症狀 | 原因 | 解法 |
|---|---|---|
| `Image 'mirror.gcr.io/...:tagname' not found` | 把 Docker Hub 頁面的佔位字 `:tagname` 當成真的 tag 貼上 | 改成 `:latest` 或實際 tag |
| `Container manifest type ... must support amd64/linux` | 在 Apple Silicon 上 build 出 arm64 | `buildx --platform linux/amd64` 重推 |
| 容器啟動失敗、healthcheck 逾時 | 沒指定 `--port=80`，Cloud Run 打 8080 | 加 `--port=80` |
| 部署成功但跑的是舊程式碼 | `mirror.gcr.io` 對 `:latest` 回了過期 digest | 用 `@sha256:...` 部署（見 §5） |
| 登入頁 `Failed to fetch` / CORS 錯誤 | 該 origin 沒登記進 provider 的 Redirect URIs | 見 §6.1 |
| `Client ID Error` | client_id 是從別台 Authentik（或 `docker-compose.yml` 的本機設定）複製的 | 從**這台** Authentik 的 provider 複製 |
| 登出時 Redirect URI Error | Post Logout 類型的列缺漏或網址不符 | 見 §6.1 |
| 登出後停在 Authentik 空白頁、不導回 | provider 一列 Post Logout 類型都沒有 | 見 §6.1 |
| 每 5 分鐘跳 `The Authorization Server requires End-User authentication` | 沒有 refresh token，續期退回跨站 iframe | 見 §6.2 |
| 改了 `VITE_AUTHENTIK_SCOPE` 但完全沒反應、也沒錯誤 | provider 的 Scopes 沒選 `offline_access`，被靜默丟棄 | 見 §6.2 |
| `Reauthentication failed. cannot prompt during non-interactive execution` | gcloud 憑證過期 | `gcloud auth login` |
| 指令跑在別的專案上 | 忘了 `--project=data-bonvies` | 每個指令都帶上 |

## 附錄：目前部署的四個服務

| 服務 | 網址 | 模式 | 主題色 |
|---|---|---|---|
| `authentik-react-demo-app-portal` | `https://authentik-react-demo-app-portal-659135873838.asia-east1.run.app` | portal | default |
| `authentik-react-demo-app-product-01` | `…-product-01-659135873838.asia-east1.run.app` | product | blue |
| `authentik-react-demo-app-product-02` | `…-product-02-…` | product | green |
| `authentik-react-demo-app-product-03` | `…-product-03-…` | product | yellow |

要新增第五個產品：在 Authentik 建 Application + Provider（Redirect URIs 兩種類型都要、Scopes 選 `offline_access`、Grant types 勾 Refresh token），然後複製 §3 的指令改服務名與 client_id，最後把新網址加進 portal 的 `VITE_PORTAL_PRODUCTS`（§4，不用 rebuild）。

要查目前線上的完整設定：

```bash
gcloud run services describe authentik-react-demo-app-portal \
  --project=data-bonvies --region=asia-east1 --format=yaml
```
