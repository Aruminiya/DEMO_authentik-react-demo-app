# OAuth 2.0 / OIDC 在這個專案裡是怎麼運作的

> 這份文件用**這個專案實際跑出來的值**解釋 OAuth 2.0 與 OIDC 的機制。不是通用教學 —— 每個概念都對應到你在瀏覽器 DevTools 裡看得到的東西、以及 repo 裡的某一行程式碼。
>
> 想補通用基礎：[oauth.com](https://oauth.com)（OAuth 2.0 Simplified，作者是多份 OAuth 規範的共同作者）比 RFC 6749 好讀太多。RFC 9700（Security BCP）則會告訴你哪些老做法已經不該用。

## 四個角色

| 角色 | 在這個專案裡是誰 |
|---|---|
| **Resource Owner**（資源擁有者） | 使用者本人 |
| **Client**（客戶端） | 這個 React app |
| **Authorization Server**（授權伺服器） | Authentik |
| **Resource Server**（資源伺服器） | 用 token 保護的 API（本專案沒有，token 純粹用來顯示） |

一句話分清楚兩個規格：

- **OAuth 2.0** 管「這個 app 被允許做什麼」→ 產出 `access_token`
- **OIDC** 疊在 OAuth 上，管「這個人是誰」→ 產出 `id_token`

Authentik 兩者都做，所以它的 provider 叫 **OAuth2/OpenID Provider**。

## 三種 token

用健身房比喻最好記：

| Token | 比喻 | 有效期 | 格式 |
|---|---|---|---|
| `access_token` | 當日手環 | **5 分鐘** | JWT |
| `id_token` | 身分證 | 5 分鐘 | JWT |
| `refresh_token` | 會員卡 | **30 天** | opaque（不透明） |

（有效期是這個 provider 的實際設定：`access_token_validity=minutes=5`、`refresh_token_validity=days=30`。）

### JWT vs opaque

`access_token` 和 `id_token` 是 **JWT**，`eyJ` 開頭（那是 base64 編碼 `{"` 的結果）。三段用 `.` 分隔：`標頭.內容.簽章`。

**前兩段只是 base64 編碼，不是加密** —— 任何人都能直接讀出裡面的 email、群組、過期時間。`src/utils/jwt.ts` 做的就是這件事，十幾行、不需要任何金鑰。第三段簽章的作用不是隱藏內容，是**防止竄改**。

`refresh_token` 是 **opaque** —— 一串沒有結構的隨機字元，什麼都看不出來，只是資料庫裡一筆記錄的鑰匙。

為什麼混著用：

| | JWT | Opaque |
|---|---|---|
| 驗證 | 用公鑰驗簽章，**不用連線** | 必須查發行方的資料庫 |
| **能否立即撤銷** | ❌ 不能 | ✅ 刪掉那筆就失效 |

`access_token` 每秒可能被驗證無數次，所以用 JWT 換效能 —— 代價是撤銷不了，而 **5 分鐘的短命就是對「撤銷不了」的補償**。`refresh_token` 活 30 天，這麼長的憑證必須能立即作廢，所以用 opaque。

### access_token vs id_token 的差別

兩者內容看起來很像（都有 email、groups），但用途完全不同：

- `id_token` 是**給你的 app 看的** —— 「這個人是 leo，他在 authentik Admins 群組」。用完就該丟，不要拿去呼叫 API。
- `access_token` 是**給 API 看的** —— 「持有這張票的人可以存取這些資源」。

本專案兩者都只用來顯示（`TokenPanel.tsx`），沒有真的 API。

## 登入流程：為什麼是兩次請求

Authorization Code Flow 一定是兩次請求，因為它們走**不同的管道**：

```
前通道（網址列，會外洩）          後通道（POST body，安全）
      /authorize                        /token
          │                                │
          └────── 授權碼 code ─────────────┘
                （接力棒，一次性、幾秒過期）
                                           └──► access_token / id_token / refresh_token
```

**第 1 次走前通道** —— 整頁導頁到 Authentik。必須這樣，因為要讓使用者**看到登入畫面**輸入密碼。代價是網址會留在瀏覽器歷史、Referer 標頭、伺服器 log 裡。

**第 2 次走後通道** —— JS 發的 `POST`，參數在 HTTPS 加密的 body 裡，不進網址列。

**所以 token 絕對不能走前通道。** 授權碼的存在意義就是當接力棒：用一個「一次性、幾秒過期、本身不是通行證」的東西，把流程從危險的前通道交棒到安全的後通道。

`src/config/oidc.ts` 裡這段就是在收尾：

```ts
onSigninCallback: () => {
  window.history.replaceState({}, document.title, window.location.pathname)
}
```

換完 token 立刻把網址列的 `?code=...&state=...` 洗掉，免得被上一頁、複製網址、歷史記錄留存。

## PKCE：沒有密碼要怎麼證明身分

**PKCE = Proof Key for Code Exchange**（唸 "pixy"，RFC 7636）。名字拆開就是它做的事：在「用授權碼換 token」時，額外拿出一把鑰匙證明「這個授權碼確實是發給我的」。

### 用郵局的比喻

1. **打電話預約**：「我等一下要領包裹。我的暗號的**指紋**是 `sDcW6t...`」—— 沒說暗號本身
2. **郵局給你領取單**：號碼 `85759624`
3. **到櫃台，這時才說暗號**：`yWTuLV...`
4. **櫃台驗證**：算一下你說的話的指紋，跟電話裡抄的比對 → 一樣就給包裹

**小偷撿到領取單也沒用** —— 櫃台問暗號他答不出來。就算他偷聽到第 1 步，他聽到的只有指紋，而指紋算不回原文。

### 對應到實際參數

| 郵局 | 實際 |
|---|---|
| 暗號 | `code_verifier`：瀏覽器產生的隨機字串 |
| 暗號的指紋 | `code_challenge`：那串亂數的 SHA-256 |
| 打電話預約 | `GET /authorize?...&code_challenge=xxx&code_challenge_method=S256` |
| 領取單 | 導回來的網址 `?code=85759624...` |
| 到櫃台說暗號 | `POST /token` 帶 `code_verifier=原文` |

自己算一次就懂了：

```python
import hashlib, base64
verifier  = "yWTuLVVBfPKyePl7CbzidBnEhc5Q5rGrqnRjrzJYOg8"
challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).decode().rstrip('=')
# challenge == "sDcW6tSQ6X8BUzCARvvP3P3WJ2wLILDtMgHqsbGcw9U"
```

### verifier 存在哪

**不是記憶體。** 因為 `signinRedirect()` 會把整頁導走，JS 記憶體整個清空，所以那串亂數必須落地才活得過這趟往返。`oidc-client-ts` 的 `stateStore` 預設是 **`localStorage`**（注意：跟存 token 的 `userStore` 用的 `sessionStorage` 不是同一個地方），換完 token 後那筆會被刪掉。

### `S256` vs `plain`

`code_challenge_method` 有兩種，Authentik 兩種都支援（見 discovery 文件的 `code_challenge_methods_supported`）：

- **`S256`** —— 送 SHA-256 雜湊。**一律用這個。**
- **`plain`** —— 直接送原文，等於沒防護。只為了相容算不出 SHA-256 的老舊嵌入式裝置而存在。

`oidc-client-ts` 預設就是 `S256`，程式碼裡不用寫任何東西。

## 公開 vs 機密 Client

**這跟 PKCE 是兩條獨立的軸**，很容易搞混：

| 軸 | 選項 | 差在哪 |
|---|---|---|
| **Client Type** | 機密 / 公開 | 有沒有一組**長期不變**的 `client_secret` |
| **PKCE method** | S256 / plain | 那個**一次性**暗號要不要雜湊 |

### 為什麼 SPA 只能選公開

前端程式碼整包下載到使用者瀏覽器，藏不住任何東西。這件事在本專案可以直接驗證 —— 不需要登入，任何人都能看到：

```bash
curl -s https://authentik-react-demo-app-portal-659135873838.asia-east1.run.app/env-config.js
```

如果 `client_secret` 放在裡面，等於公告週知。

**選「公開」不是選了比較弱的方案，是誠實承認「我沒有秘密可言」。** 反過來說，硬把 SPA 標成機密才危險：secret 一定外洩，而 Authentik 會**繼續相信它有效** —— 系統以為有一道鎖，實際上鑰匙貼在門上。撿到 `client_id` + `client_secret` 的人可以完整冒充你的應用程式發起釣魚流程，從 Authentik 的角度看那**就是**你的 app。

### 那為什麼還需要 client_secret

因為兩者證明的是不同的事：

- **PKCE** 證明「來換 token 的人 = 發起這次登入的人」（**連續性**）
- **client_secret** 證明「我就是那個 app 本人」（**身分**）

PKCE 不證明身分。`client_id` 是公開的，任何人都能拿它發起一次流程、自己產一組暗號 —— PKCE 完全不會阻止。攔住他的是 **`redirect_uri` 白名單**：授權碼只會送到登記過的網址。

所以公開 client 的安全靠兩根柱子：

```
PKCE          擋「授權碼在傳輸途中被攔截」
redirect_uri  擋「授權碼被送到錯的地方」
```

這也是為什麼 Authentik 的 redirect URI 是 strict 比對、連結尾斜線都算 —— 對公開 client 來說**它是主要防線之一**，不是設定潔癖。

### client_secret 真正在保護的是什麼

PKCE 全名是 Proof Key for **Code Exchange** —— 它只保護「用授權碼換 token」這一個動作。而 OAuth 裡**有很多請求根本沒有授權碼**：

| 請求 | 有授權碼嗎 | PKCE 保護得到嗎 |
|---|---|---|
| 用授權碼換 token | ✅ | ✅ |
| **用 refresh token 換新 token** | ❌ | ❌ |
| **`client_credentials`**（程式對程式） | ❌ | ❌ |
| 撤銷 token、查詢 token 狀態 | ❌ | ❌ |

最貼近本專案的是第二列。你的 app 每 5 分鐘發一次這個請求：

```
POST /token
grant_type=refresh_token
client_id=fSjMDAxLZqBrJ7lKBGkfxq7V4KGjoEZAbDlWErAt      ← 公開資訊
refresh_token=jta3GFNBuEdjfOswnZnms5chdy7...
```

**這裡沒有任何 PKCE**（沒有授權碼，就沒有 `code_verifier`）。所以那張 refresh token 是純粹的 bearer token —— **誰拿到誰能用，用滿 30 天**。機密 client 的同一個請求會多一個 `client_secret`，小偷光有 refresh token 還不夠。

`client_credentials` 更極端：沒有使用者、沒有瀏覽器、沒有導頁，整個交易只有一次請求，連「兩次請求」的結構都不存在。secret 是唯一能證明身分的東西。本專案的 provider 都開著這個 grant type，只是 SPA 沒用到 —— 哪天要寫排程或後端整合就會用上。

**所以不是「有 PKCE 就不需要 secret」，而是兩者範圍不同：PKCE 保護「一次登入」，client_secret 保護「這個 client 的所有請求」。**

### 現代做法：能疊就疊

OAuth 2.0 Security BCP 建議**所有 client 都用 PKCE**，包括有 secret 的 —— 它們擋的威脅不重疊。

| Client 類型 | 用什麼 |
|---|---|
| 機密（後端服務） | `client_secret` **＋** PKCE |
| 公開（SPA、手機 App） | PKCE ＋ 嚴格的 `redirect_uri` |

**本專案的五個 provider 全是「公開 + S256」。**

## 每個機制擋什麼、不擋什麼

安全是一層一層疊的，沒有任何單一機制擋得住所有攻擊。

| 威脅 | PKCE | redirect_uri 白名單 | 短命 token |
|---|---|---|---|
| 授權碼從網址列外洩（歷史、Referer、log） | ✅ | | |
| 授權碼在傳輸中被攔截 | ✅ | | |
| 手機上惡意 App 搶註冊同一個 URL scheme | ✅ | | |
| 授權碼被導去攻擊者的網站 | | ✅ | |
| token 外洩後的損害範圍 | | | ✅ |
| **XSS —— 攻擊者在你頁面上執行 JS** | ❌ | ❌ | 部分 |

### 關於 XSS

如果攻擊者能在你的頁面上跑 JS，他**偷得到 `code_verifier`**（就在 localStorage 裡）。但他根本不需要 —— 他可以直接讀走 `access_token`，或自己靜靜發起一次登入（Authentik 的 session cookie 還在，不會問密碼），拿到全新的一整套。

回到郵局的比喻：暗號寫在你家便條紙上，但小偷如果已經能進你家，包裹本身就在客廳。

**PKCE 保護的是傳輸過程，不是你的執行環境。** XSS 那一層要用別的東西守：CSP、避免 `dangerouslySetInnerHTML` / `eval`（React 預設會跳脫，所以 SPA 的 XSS 比傳統網頁少）、留意被入侵的 npm 套件（現在最常見的來源）、token 存 `sessionStorage` 而非 `localStorage`（本專案預設如此）、以及 access_token 只給 5 分鐘。

## token 該放在哪裡：SPA / DPoP / BFF

上一節說到 SPA 的 refresh token 沒有 secret 保護。那要怎麼辦？這是個架構選擇，有三個層級。

### 白話版：鑰匙放哪裡

**SPA = 鑰匙帶在自己身上。** 想進門直接開，不用問任何人，也不用請管理員 —— 你的網站可以是純靜態檔案。風險是被扒手偷走，他就能拿著鑰匙去你家，什麼時候去都行。

**BFF = 鑰匙寄放在大樓管理室。** 你身上只帶一張「我是住戶」的識別證，要進門時給管理員看，管理員幫你開。鑰匙偷不走，因為它根本不在你身上。

**但 BFF 不是萬靈丹** —— 識別證還是會被偷，小偷拿著它一樣能叫管理員開門。它把「鑰匙被複製、小偷永遠能進你家」降級成「小偷得拿著識別證親自來，而且留得下痕跡」。是實質改善，不是免疫。代價是你得付管理員薪水：一台一直開著的伺服器。

**DPoP = 鑰匙還是帶在身上，但只認你的指紋。** 別人撿到也打不開。

### 技術版

| | SPA（公開 client） | BFF |
|---|---|---|
| token 存在哪 | 瀏覽器 | **只在伺服器** |
| 瀏覽器拿到什麼 | token 本身 | 一個 `HttpOnly` session cookie |
| XSS 能偷走 token 嗎 | ✅ 能 | ❌ 不能（`HttpOnly` 的 JS 讀不到） |
| 需要後端嗎 | ❌ 純靜態就行 | ✅ 必須有 runtime |
| 要處理 CSRF 嗎 | ❌ 不用（沒用 cookie） | ✅ 要（改用 cookie 就有這問題） |
| client type | 只能公開 | 可以機密 |

BFF 擋不住的部分，具體長這樣 —— 攻擊者不需要偷 token，直接用使用者的身分發請求就好，cookie 會自動附上：

```js
// XSS 在你的頁面上跑
fetch('/api/transfer', { method: 'POST', body: '...' })
```

**XSS 該用 CSP 和程式碼品質守，不是用架構守。**

### DPoP：純前端就能做的強化

`dpop_signing_alg_values_supported` 出現在本專案 Authentik 的 discovery 文件裡，`oidc-client-ts` 也支援 —— 兩邊都具備，只是沒啟用。

做法是在瀏覽器產生一組**私鑰不可匯出**的金鑰對（Web Crypto API 的 `extractable: false`），每個請求都用私鑰簽一次名。於是 token 從「誰拿到誰能用」變成「綁定在這台裝置的這個瀏覽器上」—— 偷走 refresh token 也沒用，而且私鑰因為不可匯出，XSS 也拿不到。

概念上跟 PKCE 同源（都是「證明我持有某個秘密」），差別在 PKCE 一次登入用一次，DPoP 是每個請求都做一次。

### 本專案為什麼停在最左邊

```
純 SPA          →  簡單、可靜態部署、token 在瀏覽器
  ＋ DPoP       →  token 綁裝置，偷走也沒用，仍然純前端
      BFF       →  token 完全不進瀏覽器，但要養一個後端
```

判斷標準很簡單：**這個 app 拿到 token 能做什麼壞事？**

本專案沒有真正的 API、沒有客戶資料，token 純粹拿來顯示。而且改成 BFF 會直接摧毀這個專案的核心特性 —— 現在整個網站是 nginx 靜態檔，所以同一個 image 能跑四個服務、`--min-instances=0` 沒流量不計費、任何人 `docker run` 就能接自己的 Authentik。加了後端這些全部消失，而且每個環境都要各自的 secret（secret 不能烤進公開 image），環境無關這個賣點就沒了。

**放的是雜物就自己帶鑰匙，放的是金庫就請管理員。** 金融、醫療、或任何「token 能動到錢或個資」的系統該用 BFF；這個 demo 停在最左邊是正確的位置。

## 在這個專案的哪裡看得到

| 概念 | 去哪看 |
|---|---|
| PKCE 的 `code_challenge` | DevTools → 網路（篩選器要切「全部」，`/authorize` 是文件請求不是 Fetch/XHR） |
| 授權碼 | 導回來那筆 `login?code=...` |
| 換 token | `POST token/`，回應裡有全部三種 token |
| Authentik **核准**的 scope | Session Storage → `oidc.user:...` → `scope` 欄位（不是你要求的，是伺服器回的） |
| 解碼後的 claims | Dashboard 的「Token 詳細內容」，或 `src/utils/jwt.ts` |
| PKCE 的 verifier | Local Storage → `oidc.<state>`（只在登入流程進行中存在） |
| provider 的所有端點 | `<authority>/.well-known/openid-configuration` |

## 相關文件

| 主題 | 檔案 |
|---|---|
| Token 續期為什麼需要 `offline_access`、iframe 為什麼在雲端會壞 | `CLAUDE.md` → Token renewal |
| 登出、session、三個信任邊界 | `CLAUDE.md` → Session, logout & trust boundaries |
| Cloud Run 部署指令與疑難排解 | `docs/cloud-run-deployment.md` |
| 多產品共用 Authentik 的登出架構 | `docs/bon-portal-sso-logout-design.md` |

**規範裡讀不到的東西**：每家 IdP 的實作差異 —— Authentik 會靜默丟棄沒設定的 scope、Redirect URI 分「授權 / Post Logout」兩種類型、`prompt=login` 不可靠、登出白畫面 bug。這些只能靠踩坑累積，都記在上面那兩份文件裡。遇到問題時先分辨「這是規範層面的事，還是 Authentik 的怪癖」，能省下大量瞎猜的時間。
