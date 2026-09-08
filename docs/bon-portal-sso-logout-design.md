# bon-portal 中控台登出架構設計

> 這份文件記錄「多產品共用同一個 Authentik，各產品登出行為要如何設計」的架構決定與理由。適用情境：公司底下有多個系統（例如 3CX Report、BonAI Console、BonSIPS Operator Console……），全部共用同一台 Authentik 做身份驗證，未來規劃一個叫 `bon-portal` 的中控／入口平台。

## 問題背景

Authentik 的 OAuth2/OIDC Provider，登出行為由一個叫 **Invalidation Flow** 的設定決定，而且每個 Provider **只能設定一個**。這代表：

- 同一個 Provider 底下，不可能讓「一般登出」跟「切換使用者／完整登出」用不同強度——不管前端按鈕叫什麼名字，只要都是呼叫 `signoutRedirect()`，走的就是同一個 Invalidation Flow。
- Authentik 預設的 `default-provider-invalidation-flow`（多個 Provider 若未特別指定，通常共用這個）**只結束該應用自己的授權，不會終止 Authentik 本身的登入狀態**（`authentik_session` 這顆 cookie 不受影響）。這是刻意的業界標準設計，Google／Okta／Auth0 的「登出」預設都是這樣，目的是保留 SSO 的便利性。
  - 精確度補充：那條 Flow 實際上**綁了 0 個 Stage**、本身什麼事都不做。「結束該應用自己的授權」（刪掉這個 Provider 的 access token）是 `EndSessionView` 這支 view 做的，不是 Flow 做的。推理「換掉 Invalidation Flow 會影響什麼」時這點很重要——換 Flow 不會影響 token 撤銷，只會影響「要不要真的終止 Authentik 的 session」。
- 若想讓登出變成「連 Authentik 帳號、連其他串接應用都一起登出」（正式名稱叫 **Single Logout, SLO**），做法是在 Invalidation Flow 裡加一個 `UserLogoutStage`。但如果直接加在共用的 `default-provider-invalidation-flow` 上，**會讓所有共用這個 Flow 的產品，登出都變成 Single Logout**，沒辦法只讓某一個產品或某一顆按鈕變得比較「強」。

## 設計結論：中控台（bon-portal）獨立扮演「完整登出」的角色

不要試圖讓單一產品的登出按鈕同時具備「局部登出」跟「完整登出」兩種能力（架構上做不到，也不該做）。改成：**用不同應用程式的定位，分工出不同強度的登出**——這也是 Google（`myaccount.google.com`）、Okta 等實際產品的做法：一般產品的登出保持局部、方便；只有專屬的「帳號中控台」提供真正完整的登出。

| 應用程式 | Invalidation Flow | 登出效果 |
|---|---|---|
| `3CX Report`、`BonAI Console`、`BonSIPS Operator Console`……（一般產品） | 維持共用、目前預設的 `default-provider-invalidation-flow`（內容是空的） | 只登出這個應用，Authentik session 保留，符合業界標準、體驗最順 |
| `bon-portal`（中控台／入口平台） | **另外建立一個專屬的 Invalidation Flow** | 完整登出：連 Authentik session、其他串接應用的授權都一併結束 |

**使用情境**：使用者平常在 `3CX Report`、`BonAI Console` 之間切換完全無感、不用重複輸入密碼；只有當他明確跳到 `bon-portal` 並在那裡按下登出，才會是「這次是真的要登出、要換人用了」的完整登出。

## bon-portal 專屬 Invalidation Flow 的具體建立步驟

> **2026-09-08 更正**：本節原本寫著「**不要**直接用內建的 `default-invalidation-flow`，因為它沒有處理 OIDC 的 `client_id`／`post_logout_redirect_uri`，登出完會卡在空白頁面」。**這個歸因是錯的**：當時實測到的空白頁面是 Authentik 的一個 bug（詳見下面〈已知限制：Authentik 的登出白畫面 bug〉一節），跟選哪條 Flow 無關。`default-invalidation-flow` 是能正確導回 `bon-portal` 的。下面的建立步驟仍然建議照做，但理由不同，見本節末。

`post_logout_redirect_uri` 的處理**不在 Flow 裡**，而在 `EndSessionView` 以及它**強制附加**的 `SessionEndStage`：

```python
# authentik/providers/oauth2/views/end_session.py
context = { PLAN_CONTEXT_APPLICATION: self.application }
if self.post_logout_redirect_uri:
    context[PLAN_CONTEXT_POST_LOGOUT_REDIRECT_URI] = self.post_logout_redirect_uri
...
plan.append_stage(in_memory_stage(SessionEndStage))   # ← 不論指定哪條 Flow，都會被接上
return plan.to_redirect(self.request, self.flow)      # self.flow = provider.invalidation_flow
```

換句話說，**任何** Invalidation Flow 都會正確處理 OIDC 導回；Flow 的內容只決定「要不要真的終止 session」。DB 逐欄位比對也證實，兩條內建 Flow 除了 Stage 綁定之外完全相同：

| | `default-invalidation-flow` | `default-provider-invalidation-flow` |
|---|---|---|
| authentication | none | none |
| denied_action | message_continue | message_continue |
| compatibility_mode | false | false |
| layout | stacked | stacked |
| policy bindings | 0 | 0 |
| **stages** | **1（`default-invalidation-logout`）** | **0** |

實測驗證（2026-09-08）：把 `bon-portal` 的 Invalidation Flow 設成 `default-invalidation-flow` 後，end-session 回 **302** → 執行 Flow → 觸發 `{"action": "logout"}` 事件 → 正確導回 `bon-portal`。

所以下面「複製一個空殼 + 自己加登出用的 Stage」的步驟**仍然建議照做**，但理由要換成：

- 不要動到內建 Flow 的語意——它可能被其他 Provider 或 Brand 層級的設定共用，改它會有連帶影響
- 以後要在完整登出流程裡加東西（稽核事件、清快取、跳一頁「你已登出」提示）時，有自己的地方可以加

建立步驟（「複製一個空殼 + 自己加登出用的 Stage」）：

1. **流程與階段 → 流程 → 建立**：新建一個 Flow，例如叫 `bon-portal-full-invalidation-flow`，**使用目的（Designation）選「Invalidation」**，其餘設定比照 `default-provider-invalidation-flow`（一開始內容是空的；OIDC 導回不需要 Flow 做任何事，見本節開頭）。
2. **流程與階段 → 階段 → 建立**（或直接沿用 Authentik 內建的 `default-invalidation-logout`）：型別選 **User Logout Stage**。這個 Stage 才是真正會呼叫終止 session 動作的元件。
3. 回到剛剛新建的 `bon-portal-full-invalidation-flow` → 階段附加 → 把這個 User Logout Stage 綁進去（Order 設 0 或最前面）。
4. **應用程式 → 供應商 → `bon-portal` 對應的 Provider → 編輯 → Invalidation Flow**：改選成剛剛建立的 `bon-portal-full-invalidation-flow`（**不要**動到其他產品的 Provider，它們繼續用原本共用的 `default-provider-invalidation-flow`）。
5. 用無痕視窗實測：在 `bon-portal` 登出後，確認 (a) 有正確導回 `bon-portal` 自己的登入頁，(b) `authentik_session` 這顆 cookie 真的被清掉、下次任何產品登入都要重新輸入密碼。

## 已知限制：Authentik 的登出白畫面 bug（跨產品，每個 RP 都要繞道）

> 這一節是 2026-09-08 追查出來的，適用 authentik **2026.8.0**。它會影響本文件表格裡的**每一個**產品，不只 `bon-portal`。

**症狀**：按下登出後停在 Authentik 網域的一片空白頁，URL 還停在 `/application/o/<slug>/end-session/?...`，而且**根本沒有登出**。

### 成因

`EndSessionView.dispatch` 最前面有一個早退：

```python
# authentik/providers/oauth2/views/end_session.py
def dispatch(self, request, *args, **kwargs):
    """Return early when a flow plan is already executing in this session. ..."""
    if SESSION_KEY_PLAN in request.session:   # SESSION_KEY_PLAN = "authentik/flows/plan"
        return HttpResponse(status=200)        # ← body 全空的 200，就是那片白畫面
    return super().dispatch(request, *args, **kwargs)
```

這個早退原本只是要處理 front-channel logout 的 iframe 請求，但它**只看 session 裡有沒有殘留的 flow plan，不判斷請求是不是來自 iframe**，所以正常的整頁導覽也會被誤傷。

判斷方法：這個端點成功是 **302**、參數錯是 **400**、沒權限是可見的 Access denied 頁——**只有這條路徑會回 body 全空的 200**。看到白畫面就是這個。

而殘留幾乎是必然發生的：

1. Invalidation Flow 最後的 `SessionEndStage` 是用 **redirect challenge** 收尾——瀏覽器直接跳走，不會把結果回報給 flow executor
2. 於是負責清掉 plan 的 `FlowExecutorView.cancel()` 永遠不會被呼叫
3. 就算 Flow 裡有 `UserLogoutStage`（`logout()` → Django `session.flush()`）也沒用：executor 隨後又會把新的 plan 寫進那個剛建立的**匿名** session（`executor.py` 裡的 `self.request.session[SESSION_KEY_PLAN] = self.plan`）
4. 之後重新登入時 Django 的 `cycle_key()` 會保留 session 內容，把殘留一路帶進新 session

也就是「**任何一次登出（任何一個產品都算）都會埋下地雷，下一次登出就白畫面**」。

### 實測 log（2026-09-08）

| 時間 | 請求 | 結果 |
|---|---|---|
| 08:52:58 | `bon-portal-app/end-session`（已加繞道） | **302** ✅ 登出成功 |
| 08:52:59 | `executor/default-invalidation-flow` | 200，`auth_via=unauthenticated`（確實已登出） |
| 08:53:00 | `authentik-react-demo-app/end-session`（未加繞道） | **200 空白** ← 被上一步的殘留打到 |

更荒謬的是第 3 列時使用者**早已登出**。authentik 自己在 `handle_no_permission` 的註解寫著 *"RP-Initiated Logout is idempotent: an unauthenticated request is a valid no-op"*，本該跑 Invalidation Flow 顯示「已登出」頁；但 guard 位在權限檢查**之前**，連 no-op 都做不到。

### 繞道：導向 end-session 前先繞一次 CancelView

Authentik 的 `CancelView`（`/flows/-/cancel/`）就是專門刪 `SESSION_KEY_PLAN` 的，刪完會導向 `next`（只吃相對路徑，而 end-session 剛好在同一個 host 上）：

```ts
const endSession = new URL(END_SESSION_ENDPOINT);
endSession.search = params.toString();   // client_id / id_token_hint / post_logout_redirect_uri

// 先繞去 CancelView 清掉殘留的 flow plan，再讓它導向真正的 end-session
const logoutUrl = new URL("/flows/-/cancel/", endSession);
logoutUrl.searchParams.set("next", `${endSession.pathname}${endSession.search}`);
window.location.href = logoutUrl.toString();
```

實測：帶真實長度的 `id_token`（2558 字元，整條 URL 2794 字元）第一跳回 302，`id_token_hint` 與 `post_logout_redirect_uri` 都完整無損。

**注意**：這個繞道會取消該 session 裡任何進行中的 flow（例如另一個分頁正卡在登入中）。對「登出」這個動作來說語意合理，但要知道有這件事。

**要寫進跨產品實作規範**：每個接 Authentik 的產品，登出都要走這個繞道，不是只有 `bon-portal`。上游修好之後這段可以拿掉——正確的修法應該是讓 guard 判斷請求是否來自 iframe（例如看 `Sec-Fetch-Dest: iframe`），而不是看 session 有沒有 plan。

## 已知限制：post_logout_redirect_uri 是字串完全比對

另一個會回「Bad Request / The request is otherwise malformed」的坑，跟上面的白畫面是不同問題：

Authentik 2026.8 的 Provider Redirect URIs 清單，每一筆都有 **type**（`authorization` 或 `logout`）。`post_logout_redirect_uri` 只會跟 type=`logout` 那幾筆比對，而 matching mode 是 `strict` 時是**字串完全比對**——**連結尾斜線都算不同**：

```
{ "url": "http://localhost:6174/auth/authentik/callback", "matching_mode": "strict", "redirect_uri_type": "authorization" }
{ "url": "http://localhost:6174",                         "matching_mode": "strict", "redirect_uri_type": "logout" }
```

送 `http://localhost:6174/`（結尾多一個斜線）就會被擋成 `invalid_request`，錯誤頁只寫「The request is otherwise malformed」，完全不會告訴你是哪個參數、差在哪裡。前端與 Authentik 兩邊必須一模一樣，改 port 或改網域時這是最容易漏的一項。

另外，`id_token_hint` 是帶 `post_logout_redirect_uri` 的**必要**參數（OIDC 規範要求，否則任何人光憑公開的 client_id 就能亂指定登出後的導向網址）。這代表前端必須留著 `id_token` 才能在登出時自動導回。

## 為什麼不能「只加在某個按鈕上」

前端（不管是這個 demo 專案還是 `bon-portal` 自己）呼叫的都是同一支 `auth.signoutRedirect()`，打到 Authentik 同一個 end-session endpoint，而**該次登出要執行的邏輯，是由那個請求所屬的 Provider 的 Invalidation Flow 決定的**——不是前端按鈕的名字、也不是呼叫時多帶了什麼參數。想要「兩種不同強度的登出」，唯一乾淨的做法就是「兩個不同的 Provider（也就是兩個不同的應用程式），各自指定不同的 Invalidation Flow」，而不是試圖在同一個 Provider 上做出兩種行為。

## 附錄：BonPortal 畫面呈現方式，會不會影響上面這套設計

主管的 BonPortal 設計稿（側邊欄列出 BonSale／BonTalk／BonAI，點下去切換內容）背後，實際上有兩種完全不同的技術做法，**只有其中一種跟本文件的設計相容**：

### 做法一：導覽入口（Launcher）模式——不受影響，直接套用上面的設計

BonPortal 只是一份「你能用哪些產品」的清單，點下去是**整頁導頁**到該產品自己獨立部署的網域（截圖裡產品名稱旁的外部連結圖示 ↗ 暗示的就是這種）。這種模式下，每個產品都還是各自獨立、最上層的分頁在跑 `signinRedirect()`／`signoutRedirect()`，跟本文件從頭到尾討論的架構完全一致，**不用做任何調整**。

### 做法二：iframe 嵌入模式——會直接讓整個構想卡死，技術上跑不起來

如果 BonPortal 這個畫面本身要把各產品的內容**嵌**進來顯示（例如用 iframe 把 BonSale/BonTalk/BonAI 的網頁塞進同一個畫面），會撞到一個無法繞過的硬限制：

- **實測確認**：Authentik 的 Django 設定裡有 `django.middleware.clickjacking.XFrameOptionsMiddleware`，沒有被覆寫，代表用的是預設值 **`X-Frame-Options: DENY`**——Authentik 的任何頁面（登入頁、授權頁）**一律拒絕被放進任何 iframe，不分同網域或跨網域**。這是 Authentik 主動的防點擊劫持（Clickjacking）保護，合理且不該關掉。
- 後果：**被嵌入的產品只要需要走一次 Authentik 登入（第一次登入、或 session 過期），那個登入畫面在 iframe 裡會直接顯示空白**，使用者卡住進不去，不是變醜、是完全用不了。
- 就算已登入不用重新驗證，跨網域 iframe 也會撞上瀏覽器的**第三方 cookie 封鎖**（Safari ITP、Chrome 淘汰第三方 cookie、Firefox ETP），被嵌入產品自己的登入狀態可能說斷就斷。
- 本文件「bon-portal 專屬 Invalidation Flow」那套設計，前提也是「每個產品都是最上層分頁在導頁」——如果變成 iframe 內的子頁面，連「導去 Authentik 登出」這個動作要不要跳出 iframe（`target="_top"`）都要另外處理，複雜度完全是另一個等級，且無法保證能正常運作。

**結論**：這件事應該在設計階段就跟提案的人確認清楚，屬於會決定整個 BonPortal 能不能做出來的關鍵技術限制，越早釐清、後續設計與開發成本影響越小。

## 參考

- 這個結論是排除掉以下幾條路之後得出的，細節記錄在本專案的 `CLAUDE.md` →「Session, logout & trust boundaries」章節：
  - `prompt: 'login'` 在 Authentik 上不可靠（官方已知 bug）
  - Authentik 原生的「使用者帳號切換」功能只存在於 Authentik 自己的介面，OIDC 的 `/authorize` 端點不支援 `select_account`，第三方應用程式完全觸發不到
  - [goauthentik/authentik#20845](https://github.com/goauthentik/authentik/issues/20845)：Authentik 官方自己也承認，目前沒有乾淨的方式讓第三方應用程式強制要求重新驗證
- [Authentik 官方文件：Single Logout (SLO)](https://docs.goauthentik.io/add-secure-apps/providers/single-logout/)
- [Authentik 官方文件：User logout stage](https://docs.goauthentik.io/add-secure-apps/flows-stages/stages/user_logout/)
- 上面兩節〈已知限制〉的結論來自直接讀 authentik 2026.8.0 容器內的原始碼，要重新驗證時可以從這幾個檔案開始：
  - `authentik/providers/oauth2/views/end_session.py` — `EndSessionView`（白畫面的 guard、`post_logout_redirect_uri` 的完全比對、`id_token_hint` 驗證時刻意關掉 exp 檢查都在這裡）
  - `authentik/flows/views/executor.py` — `SESSION_KEY_PLAN`、`FlowExecutorView.cancel()`、`CancelView`
  - `authentik/flows/stage.py` — `SessionEndStage`（用 redirect challenge 收尾，因此 plan 不會被清掉）
  - `authentik/providers/oauth2/models.py` — `redirect_uris` / `authorization_redirect_uris` / `post_logout_redirect_uris` 三個 property 的關係
