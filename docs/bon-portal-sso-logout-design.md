# bon-portal 中控台登出架構設計

> 這份文件記錄「多產品共用同一個 Authentik，各產品登出行為要如何設計」的架構決定與理由。適用情境：公司底下有多個系統（例如 3CX Report、BonAI Console、BonSIPS Operator Console……），全部共用同一台 Authentik 做身份驗證，未來規劃一個叫 `bon-portal` 的中控／入口平台。

## 問題背景

Authentik 的 OAuth2/OIDC Provider，登出行為由一個叫 **Invalidation Flow** 的設定決定，而且每個 Provider **只能設定一個**。這代表：

- 同一個 Provider 底下，不可能讓「一般登出」跟「切換使用者／完整登出」用不同強度——不管前端按鈕叫什麼名字，只要都是呼叫 `signoutRedirect()`，走的就是同一個 Invalidation Flow。
- Authentik 預設的 `default-provider-invalidation-flow`（多個 Provider 若未特別指定，通常共用這個）**只結束該應用自己的授權，不會終止 Authentik 本身的登入狀態**（`authentik_session` 這顆 cookie 不受影響）。這是刻意的業界標準設計，Google／Okta／Auth0 的「登出」預設都是這樣，目的是保留 SSO 的便利性。
- 若想讓登出變成「連 Authentik 帳號、連其他串接應用都一起登出」（正式名稱叫 **Single Logout, SLO**），做法是在 Invalidation Flow 裡加一個 `UserLogoutStage`。但如果直接加在共用的 `default-provider-invalidation-flow` 上，**會讓所有共用這個 Flow 的產品，登出都變成 Single Logout**，沒辦法只讓某一個產品或某一顆按鈕變得比較「強」。

## 設計結論：中控台（bon-portal）獨立扮演「完整登出」的角色

不要試圖讓單一產品的登出按鈕同時具備「局部登出」跟「完整登出」兩種能力（架構上做不到，也不該做）。改成：**用不同應用程式的定位，分工出不同強度的登出**——這也是 Google（`myaccount.google.com`）、Okta 等實際產品的做法：一般產品的登出保持局部、方便；只有專屬的「帳號中控台」提供真正完整的登出。

| 應用程式 | Invalidation Flow | 登出效果 |
|---|---|---|
| `3CX Report`、`BonAI Console`、`BonSIPS Operator Console`……（一般產品） | 維持共用、目前預設的 `default-provider-invalidation-flow`（內容是空的） | 只登出這個應用，Authentik session 保留，符合業界標準、體驗最順 |
| `bon-portal`（中控台／入口平台） | **另外建立一個專屬的 Invalidation Flow** | 完整登出：連 Authentik session、其他串接應用的授權都一併結束 |

**使用情境**：使用者平常在 `3CX Report`、`BonAI Console` 之間切換完全無感、不用重複輸入密碼；只有當他明確跳到 `bon-portal` 並在那裡按下登出，才會是「這次是真的要登出、要換人用了」的完整登出。

## bon-portal 專屬 Invalidation Flow 的具體建立步驟

**不要**把 `bon-portal` 的 Invalidation Flow 直接設成 Authentik 內建的 `default-invalidation-flow`——那個 Flow 沒有處理 OIDC 的 `client_id`／`post_logout_redirect_uri`，登出完會卡在 Authentik 自己的空白頁面，回不到 `bon-portal`（已實測驗證過）。正確做法是「複製一個空殼 + 自己加登出用的 Stage」：

1. **流程與階段 → 流程 → 建立**：新建一個 Flow，例如叫 `bon-portal-full-invalidation-flow`，**使用目的（Designation）選「Invalidation」**，其餘設定比照 `default-provider-invalidation-flow`（讓它保留正確處理 OIDC 導回的能力，一開始內容是空的）。
2. **流程與階段 → 階段 → 建立**（或直接沿用 Authentik 內建的 `default-invalidation-logout`）：型別選 **User Logout Stage**。這個 Stage 才是真正會呼叫終止 session 動作的元件。
3. 回到剛剛新建的 `bon-portal-full-invalidation-flow` → 階段附加 → 把這個 User Logout Stage 綁進去（Order 設 0 或最前面）。
4. **應用程式 → 供應商 → `bon-portal` 對應的 Provider → 編輯 → Invalidation Flow**：改選成剛剛建立的 `bon-portal-full-invalidation-flow`（**不要**動到其他產品的 Provider，它們繼續用原本共用的 `default-provider-invalidation-flow`）。
5. 用無痕視窗實測：在 `bon-portal` 登出後，確認 (a) 有正確導回 `bon-portal` 自己的登入頁，(b) `authentik_session` 這顆 cookie 真的被清掉、下次任何產品登入都要重新輸入密碼。

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
