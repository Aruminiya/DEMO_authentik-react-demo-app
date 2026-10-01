# Google / Microsoft 365 第三方登入設定

> 這份文件記錄讓 Authentik 支援「用 Google 登入」與「用 Microsoft 365 登入」的完整設定步驟、帳號配對的設計取捨，以及實際踩過的坑。截至 2026-10-01，Google 登入已在本機 Authentik 跑通；正式機與 M365 尚未設定，等公司確定「誰能登入、帳號怎麼來」再做（見第 6 節）。
>
> 核心前提：**這個 React app 的程式碼完全不用改。** 第三方登入全部是 Authentik 端的設定。

## 0. 架構：兩層 OIDC

```
React demo app ──OIDC──▶ Authentik ──OIDC/OAuth──▶ Google / Microsoft Entra ID
  (client，不用改)         (在這層當 client)
```

這個 app 只認 Authentik：`signinRedirect()` 照常導到 Authentik 的 `/authorize`，拿回來的永遠是 **Authentik 簽發的** token。使用者在 Authentik 那頭是打密碼、按 Google 還是按 Microsoft，app 看不到也不在乎。用前端的心智模型理解，Authentik 就像一個 BFF，背後換接哪個上游，前端不受影響。

Authentik 把 Google / Microsoft 這種上游稱為 **Source**（admin → 使用者目錄 → 聯邦式認證和社群登入）。Source 要出現在登入頁上，還得被加進某個 **Identification Stage** 的「來源」欄位。

## 1. 先懂這個：帳號配對

第三方登入真正的設計問題不在串接，而在這一題：**Google 送來一個 email，跟 Authentik 裡同 email 的帳號，算不算同一個人？**

這就是為什麼有些網站「密碼註冊後再用同信箱的 Google 登入，會進到同一個帳號」，有些卻「直接變成一個新帳號」—— 背後選了不同的策略。

| 策略 | 使用者看到的 | Authentik「用戶配對模式」 |
|---|---|---|
| ① 自動用 email 合併 | 用 Google 登入，直接進到原本的帳號 | 使用 email 連結使用者 |
| ② 完全分開 | 用 Google 登入，變成一個全新的空帳號 | **使用唯一識別碼連結使用者**（預設） |
| ③ 擋下來請你先綁定 | 「此信箱已註冊，請先用密碼登入再綁定」 | 使用 email 拒絕 + 使用者到「已連結的服務」自行綁定 |

### 1.1 預設模式（②）實際會發生什麼

「唯一識別碼」不是 email，而是上游帳號永遠不變的 ID：Google 的 `sub`、Entra 的 Object ID（一串數字或 GUID）。

```
Google 回傳 { sub: "1098...", email: "leo@bonvies.com", name: "朱啟豪" }
        ↓
Authentik 查：有沒有「Google source + sub=1098...」的連結紀錄？
        ↓
   ┌── 有 → 走 Authentication flow（default-source-authentication），登入那個已連結的帳號
   └── 沒有 → 走 Enrollment flow（default-source-enrollment）
              ├─ 用 Google 給的 email / name 建立新使用者
              ├─ username 撞到既有帳號 → 跳出「Please select a username」請你另取
              ├─ 存一筆連結紀錄（source=google, identifier=1098...）
              └─ 登入
```

**它完全不看 email 有沒有重複。** 實測：本機已有 `leo@bonvies.com` 帳號，用同一個 Google 帳號登入後，Authentik 跳出選 username 的頁面，填 `leo` 之後多了第二個帳號 —— 兩個帳號 email 一樣、互不相干，新的那個不在任何群組裡（Dashboard 的 `engineering` 區塊會顯示上鎖）。這是預期行為，不是設定錯誤。

### 1.2 為什麼不是每個網站都選最方便的 ①

① 安全的前提是**兩邊的 email 都可信**：

- **上游那邊**：回傳的 email 有沒有被驗證、能不能被別人任意設定？
- **自己這邊**：使用者用密碼註冊時，有沒有寄驗證信確認信箱真的是他的？

兩個漏洞分別打這兩點：

**帳號預先劫持（pre-account hijacking）** —— 打「自己這邊沒驗證信箱」：

```
1. 攻擊者用「你的 email」+「他自己的密碼」先註冊    ← 網站沒驗證信箱，成功了
2. 你之後用 Google 登入，email 相同
3. 網站自動合併 → 你進到的是攻擊者事先建好的帳號
4. 攻擊者手上仍有密碼，隨時能登入看你存進去的資料
```

**nOAuth** —— 打「上游的 email 不可信」：在**多租戶**的 Entra app 裡，`email` claim 可以被任何其他公司的 tenant 管理員隨意設定、而且沒有驗證。別人在自己的 tenant 把某個使用者的 email 設成 `leo@bonvies.com`，用 email 合併的系統就會讓他登入你的帳號。2023 年公開，很多 SaaS 中過。

所以 ② 通常不是刻意選的，而是**沒處理這題時的預設結果**；① 要敢用，得同時滿足「上游 email 可信」與「沒有讓使用者自填 email 的入口」。

### 1.3 「註冊流程」決定找不到帳號時怎麼辦

Source 上的 **註冊流程（Enrollment flow）** 是另一個獨立的開關：

| 註冊流程 | 找不到對應帳號時 |
|---|---|
| `default-source-enrollment` | **自動建帳號**（本機目前的設定） |
| 留空 | 拒絕登入，顯示「此 source 未設定註冊」之類的錯誤頁 |
| 自訂流程，User Write Stage 勾 *Create users as inactive* | 建帳號但為停用狀態，管理員啟用後才能登入 |
| 自訂流程 + Expression Policy | 例如只允許特定網域的 email 註冊 |

**配對模式和註冊流程要一起看。** 正式機不能讓「任何通過 Google 驗證的人都自動拿到帳號」，推薦組合見第 6 節。

## 2. Google 設定

### 2.1 決定 slug 與 Redirect URI

Slug 是 Source 在 Authentik 裡的代號，會出現在 callback 網址裡。**Google 端與 Authentik 端必須一字不差**（含 http/https 與結尾 `/`）。

本專案用 `google`：

| 環境 | Redirect URI |
|---|---|
| 本機 | `http://localhost:9000/source/oauth/callback/google/` |
| 正式 | `https://authentik-sso.bonvies.com/source/oauth/callback/google/` |

注意這是 **Authentik 的** callback，不是這個 React app 的 `/`。

### 2.2 Google Cloud Console

OAuth Client 一定要掛在某個 GCP 專案底下；建專案、建 OAuth Client 都免費，不需要啟用 Billing。本專案放在公司的 `data-bonvies`（Bonvies-Website），跟 Cloud Run 同一個專案。

**⚠️ 一個專案只有一個「品牌」（同意畫面）。** app 名稱、logo、授權網域是同專案所有 OAuth Client 共用的。這個專案的品牌已經有別的用途在使用，所以原則是**只新增、不修改**：

| ✅ 可以做（只新增） | ❌ 不要碰 |
|---|---|
| 用戶端 → 建立新的 OAuth Client | 品牌的 app 名稱、logo、首頁 / 隱私權連結 |
| 授權網域**加一筆** `bonvies.com`（上正式機時才需要） | 刪除任何授權網域或既有 client |
| 目標對象加 test users（若為 External + 測試中） | 切換 Internal / External、發布或退回測試 |

使用者在 Google 同意畫面看到的會是那個共用品牌的名稱，demo 可以接受。動手前在公司群組講一聲，讓品牌的負責人知道。

**建立 OAuth Client**：Google Auth Platform → **用戶端** → **建立用戶端**

| 欄位 | 填什麼 |
|---|---|
| 應用程式類型 | **網頁應用程式** |
| 名稱 | `authentik-sso-demo`（讓同事一看就知道用途） |
| 已授權的 JavaScript 來源 | **留空**（那是給瀏覽器直接呼叫 Google 用的，Authentik 走伺服器端） |
| 已授權的重新導向 URI | 2.1 表格的兩筆都加 |

Google 對 `localhost` 特別放行：不必在授權網域裡、可以用 `http`。所以**只測本機的話，完全不用改共用品牌**。

建立後拿到 **用戶端 ID**（`xxxx.apps.googleusercontent.com`）與 **用戶端密鑰**（`GOCSPX-...`）。

> ⚠️ 用戶端密鑰是密碼：不要放進 repo、`.env`、截圖或聊天紀錄。新版 Console 可能只在建立當下顯示完整密鑰，當場存進密碼管理器。從 Console 下載的 `client_secret_*.json` 也含有密鑰，貼完就刪。

**目標對象（誰能登入）**：

| 設定 | 誰能通過 Google 登入 |
|---|---|
| Internal | 只有該 Workspace 組織的帳號，沒有測試模式 |
| External + 測試中 | 只有 test users（上限 100），其他人看到 `access_denied` |
| External + 正式版 | 任何 Google 帳號 |

### 2.3 Authentik：建立 Google Source

使用者目錄 → **聯邦式認證和社群登入** → **New Source** → **Google OAuth Source**

| 欄位 | 填什麼 |
|---|---|
| Source Name | `Google`（Promoted 開啟時就是按鈕文字，可改成 `使用 Google 登入`） |
| Slug | `google` |
| 啟用中 | ✅ |
| Promoted | 建議開：從底部小圖示變成整排大按鈕 |
| 用戶配對模式 | 見第 1 節與第 6 節。本機目前是預設的「使用唯一識別碼連結使用者」 |
| Group matching mode | 預設（只有從上游同步群組時才用到） |
| 使用者路徑 | 預設 `goauthentik.io/sources/%(slug)s`，Google 來的帳號會歸在這底下 |
| 圖示 | 留空會用內建單色 G；可上傳 Google 官方四色 G |
| 客戶金鑰 | 用戶端 ID |
| 客戶機密密碼 | 用戶端密鑰 |
| 範疇 | 留空（預設就會要 `openid email profile`） |
| 使用者 / 群組屬性對應 | 留空（內建會帶入 email 與名字） |
| Authentication Flow | `default-source-authentication` |
| 註冊流程 | 見第 1.3 節。本機目前是 `default-source-enrollment` |

建立後點進 source，確認頁面上的 **Callback URL** 跟 Google 端登記的一字不差。

**Callback URL 是依「你從哪個網址打開 admin」動態組出來的**（概念上就是 `${window.location.origin}/source/oauth/callback/${slug}/`），不是寫死的設定。所以在本機 admin 看到 `http://localhost:9000/...` 是正確的。

另外，本機 Authentik 與正式機是**兩個不同的資料庫**（見 `cloud-run-deployment.md`）：在本機建的 source 只存在本機，正式機要用同一組用戶端 ID / 密鑰**再建一次**。Google 的 redirect URI 白名單同時登記兩筆，兩台各送各的就都會通過 —— Authentik 不會去讀 Google 的白名單，只是每次送出自己的那一筆給 Google 核對。

## 3. 登入頁：給 demo 開一條專用的 flow

### 3.1 為什麼不改預設的

最快的做法是把 Source 加進 `default-authentication-identification` 的「來源」欄位，但那是**所有應用共用**的登入畫面 —— 改了，每個接這台 Authentik 的產品登入頁都會冒出 Google 按鈕。這跟 `CLAUDE.md` 說「不要改共用的 `default-provider-invalidation-flow`」是同一個道理。

正確做法：開一條只給 demo provider 用的 authentication flow。本機也照這個做，等於先演練正式機的步驟。

### 3.2 建立 Identification Stage

流程與階段 → **階段** → 建立 → **Identification Stage**

| 欄位 | 填什麼 |
|---|---|
| 名稱 | `demo-google-identification`（之後加 M365 也用這個，名稱可改成 `demo-social-identification`，改名不影響綁定） |
| 使用者欄位 | 勾 Username、Email（保留帳號密碼登入）；全部取消 = 只能用第三方登入 |
| 密碼階段 | `default-authentication-password`（帳密在同一頁輸入） |
| 來源 | 加入 `Google`（多選，之後再加 `Microsoft 365`，登入頁就同時有兩顆按鈕） |

### 3.3 建立 Flow 並綁定 Stage

流程與階段 → **流程** → 建立

| 欄位 | 填什麼 |
|---|---|
| Flow Name / Slug | `demo-google-authentication` |
| 標題 | 例如 `登入 authentik-react-demo-app`（顯示在登入頁最上方） |
| 使用目的 | **身分認證**（= Authentication。不要選「授權」，那是 Authorization，登入後的同意畫面） |
| 身分認證 | **不需要**（登入流程本來就是給還沒登入的人用的） |

建好後點進去 → **階段附加** 分頁（= Stage Bindings）→ **Bind existing stage**，照抄 `default-authentication-flow` 的順序（它有 4 個 stage），只把第一個換掉：

| Order | Stage |
|---|---|
| 10 | `demo-google-identification` |
| 30 | `default-authentication-mfa-validation` |
| 100 | `default-authentication-login` |

**密碼已經併在 identification stage 裡，就不要再把 `default-authentication-password` 綁成獨立一步**，否則要輸入兩次密碼。每個 stage 都要開一次彈窗、填好按建立；只關掉彈窗不會存。

綁完回 **流程概覽**，示意圖應該是 `Flow → identification → mfa-validation → login → End of the flow`。如果只有 `Flow → End of the flow`，代表沒綁上（流程列表那欄 stage 數量也會是 0）。

**單獨預覽**：無痕視窗打開 `http://localhost:9000/if/flow/demo-google-authentication/`，不用動 provider 就能看到這個登入頁。直接從這個網址登入會停在 Authentik 自己的使用者介面，不會回 app，這是正常的。

### 3.4 讓 demo provider 改用這條 flow

應用程式 → **供應商** → 這個 app 用的 provider（client_id 對得上 `VITE_AUTHENTIK_CLIENT_ID`）→ 編輯 → **Advanced flow settings** → **Authentication Flow** 選 `demo-google-authentication`。

欄位說明是「使用者存取此供應商但未獲授權時的流程」；留空時會用品牌預設的 `default-authentication-flow`，所以之前看不到 Google 按鈕。

這條 flow **只在 Authentik 還沒登入時才會出現**。同一個瀏覽器已經從別的 app 登入過 Authentik，就會直接 SSO 進去、看不到登入頁 —— 重測時要把無痕視窗整個關掉重開。

### 3.5 按鈕外觀

由小到大三種改法：

1. **Source 開 Promoted + 改 Source Name**：變成整排大按鈕，文字就是 Source Name（slug 不要動，callback 是看 slug 的）。
2. **Source 的「圖示」欄位**：上傳官方四色 G 等圖片或填 URL。
3. **自訂 CSS**（系統 → 品牌，或掛載 `custom.css`）：可以改顏色圓角，但這是**整個品牌**的設定，所有共用品牌的應用一起變；Authentik 介面用 Web Components + Shadow DOM，selector 不一定照預期生效。

前兩種只影響這個 source，建議先做。

## 4. Microsoft 365（Entra ID）設定

架構跟 Google 完全一樣，第 1 節的配對問題也全部適用；差別在申請的地方與幾個 Microsoft 特有的坑。

### 4.1 Microsoft 帳號有兩種

| 種類 | 例子 |
|---|---|
| 工作或學校帳號 | 公司 M365 帳號，背後是公司的 **Entra ID tenant** |
| 個人 Microsoft 帳號 | `@outlook.com`、`@hotmail.com`、Xbox 帳號 |

「誰能登入」由註冊 app 時的 **Supported account types** 決定，對照 Google：

| | Google | Microsoft |
|---|---|---|
| 只限公司帳號 | 目標對象 Internal | **Single tenant** |
| 任何組織帳號 | （無直接對應） | Multitenant |
| 連個人帳號都可以 | External | Multitenant + personal accounts |

公司內部用 M365，所以用 **Single tenant**。公司另一個內部系統串 M365 登入時，也是用指定 tenant ID 的端點（不是 `common`），判斷同為 Single tenant；tenant ID 向該系統的後端負責人要即可（**tenant ID 不是機密**，client secret 才是）。

**不要共用那個系統的 App registration**，另外註冊一個：redirect URI、secret、到期日各自管理，demo 出問題不會牽連正式系統。

> 公開查詢（`https://login.microsoftonline.com/getuserrealm.srf?login=test@<網域>&json=1`）顯示 `bonvies.com` 不是任何 Entra tenant 的已驗證網域，所以公司 M365 帳號的 email **可能不是 `@bonvies.com`**（例如 `xxx.onmicrosoft.com`）。這會影響第 6 節 email 配對要填的值，上線前先確認。

### 4.2 slug 與 Redirect URI

本專案用 `entra`：

| 環境 | Redirect URI |
|---|---|
| 本機 | `http://localhost:9000/source/oauth/callback/entra/` |
| 正式 | `https://authentik-sso.bonvies.com/source/oauth/callback/entra/` |

### 4.3 Microsoft Entra 端

**https://entra.microsoft.com**（或 Azure Portal → Microsoft Entra ID），用公司 M365 帳號登入。需要能註冊 App 的權限；按鈕是灰的就請 IT 給 **Application Developer** 角色或代為註冊。

**① 註冊 App**：Identity → Applications → **App registrations** → **New registration**

| 欄位 | 填什麼 |
|---|---|
| Name | `authentik-sso-demo`（使用者在同意畫面會看到） |
| Supported account types | **Accounts in this organizational directory only（Single tenant）** |
| Redirect URI | Platform **Web**，`http://localhost:9000/source/oauth/callback/entra/` |

**② 抄下兩個 ID**（Overview 頁）：**Application (client) ID**、**Directory (tenant) ID**。

**③ 建 Client secret**：Manage → **Certificates & secrets** → New client secret，Expires 建議 180 天或 12 個月。

| 欄位 | 要不要 |
|---|---|
| **Value** | ✅ 這才是 secret，**只顯示這一次** |
| Secret ID | ❌ 貼成這個會得到 `AADSTS7000215` |

> ⚠️ **Entra 的 secret 一定會過期**（Google 的不會）。到期當天 Microsoft 登入直接壞掉，錯誤訊息不一定看得出原因 —— 建立時就在行事曆記下到期日。

**④ API permissions**：預設的 **Microsoft Graph → User.Read（Delegated）** 不要刪，Authentik 靠它讀使用者資料。有權限的話按 **Grant admin consent for <公司>**，同事第一次登入就不會卡在「需要管理員核准」。

### 4.4 Authentik：建立 Entra ID Source

聯邦式認證和社群登入 → New Source → **Entra ID OAuth Source**

| 欄位 | 填什麼 |
|---|---|
| Source Name / Slug | `Microsoft 365` / `entra` |
| 用戶配對模式 | 見第 6 節。**多租戶時絕對不能用 email 連結**（nOAuth） |
| 客戶金鑰 | Application (client) ID |
| 客戶機密密碼 | Client secret 的 **Value** |
| 範疇 | 留空 |
| Authentication Flow / 註冊流程 | 同 Google |

**⚠️ URL 要把 `common` 換成 tenant ID。** 通訊協定設定裡的預設 URL 帶 `common`（給多租戶用），Single tenant 用了會得到 `AADSTS50194`：

| 欄位 | 值 |
|---|---|
| Authorization URL | `https://login.microsoftonline.com/<tenant-id>/oauth2/v2.0/authorize` |
| Access token URL | `https://login.microsoftonline.com/<tenant-id>/oauth2/v2.0/token` |
| OIDC Well-known URL（如果有） | `https://login.microsoftonline.com/<tenant-id>/v2.0/.well-known/openid-configuration` |
| Profile URL | `https://graph.microsoft.com/v1.0/me`（不用改） |

建好後確認 Callback URL，再把 `Microsoft 365` 加進 `demo-google-identification` 的「來源」。

## 5. 驗證

1. 開**新的無痕視窗**（避免沿用既有的 `authentik_session` 直接 SSO 進去）
2. 打開 React app → 被導到 demo 的登入頁，看得到 Google（與 Microsoft）按鈕
3. 點按鈕 → 選帳號 → 回到 Authentik → 回到 app 的 Dashboard
4. 使用者目錄 → 使用者：檢查登入的是哪個帳號、該帳號的「來源連結」有沒有對應的 source

## 6. 正式機：推薦方案與前提（待公司確認商業流程）

正式機**不能**沿用本機的「唯一識別碼配對 + 自動開戶」—— 那代表任何通過 Google / M365 驗證的人都會自動拿到 Authentik 帳號，也就能登入接這台 Authentik 的 app。

### 6.1 選項

| 方案 | 用戶配對模式 | 註冊流程 | 結果 |
|---|---|---|---|
| **A. 管理員預建帳號，email 對應**（推薦） | 使用 email 連結使用者 | **留空** | 只有 Authentik 裡已存在、email 相同的帳號能登入；一人一帳號，帳密 / Google / M365 都進同一個 |
| B. 使用者自行綁定 | 唯一識別碼 | 留空 | 先用帳密登入，到 使用者介面 → 設定 → **已連結的服務** 綁定，之後才能用第三方登入 |
| C. 自動開戶但需審核 | 唯一識別碼 | 自訂，User Write Stage 勾 *Create users as inactive* | 帳號建立時為停用，管理員啟用後才能登入 |
| D. 自動開戶但限網域 | 唯一識別碼 | 自訂 + Expression Policy | 公司網域的人都能自己開帳號 |

推薦 A：帳號只有管理員能建、email 只有管理員能填，不存在「使用者自填 email」的入口，所以 1.2 的預先劫持不成立；公司另一個內部系統的 SSO 也是同樣的策略（不自動開戶，用 email 對應管理員建立的人員），兩邊規則一致。

**配對模式與註冊流程要一起改。** 只改成 email 連結卻保留自動註冊（或任何讓使用者自填 email 的地方），就是把 1.2 的門打開。

### 6.2 方案 A 的前提

1. **M365 必須維持 Single tenant。** 多租戶 + email 連結 = nOAuth。
2. **Google 品牌的目標對象要確認。** Internal 最理想；External 的話任何 Google 帳號都能通過 Google，但 Authentik 找不到對應 email 會拒絕，仍擋得住 —— 前提是 Authentik 帳號的 email 不會被填成外人能控制的 Gmail。
3. **管理員帳號的 email 不要跟任何人日常用的 Google / M365 帳號相同。** 本機實測的那個 `leo@bonvies.com` 正是 `authentik Default Admin`（超級管理員）—— 若用 email 連結，誰能登入那個 Google 帳號，誰就是 Authentik 管理員。另開專用管理員帳號，或把管理員的 email 改掉。
4. **email 要跟上游實際回傳的值完全一致。** M365 預設回傳 `mail`，沒有的話退回 UPN，而公司的 M365 網域可能不是 `bonvies.com`（見 4.1）。先在本機測一次看實際拿到什麼。
5. **同一個 email 不能有兩個帳號。** email 連結遇到多筆會出錯；本機測試時 Google 自動建的重複帳號要先刪（刪帳號會一併刪掉它的來源連結）。

找不到帳號時，使用者會看到 Authentik 的錯誤頁（大意是此 source 未設定註冊），訊息不太友善，內部系統通常可接受。

### 6.3 上正式機的步驟清單

1. Google Console：確認 redirect URI 已有正式那筆；品牌授權網域加 `bonvies.com`
2. Entra：App → Manage → Authentication → Web → Add URI 加正式那筆
3. 正式 Authentik 重建 Google / Entra source（同一組 ID 與密鑰，slug 不變），套用 6.1 選定的方案
4. 正式 Authentik 重建 `demo-google-identification` 與 `demo-google-authentication`，demo provider 的 Authentication Flow 指過去 —— **不要改共用的 `default-authentication-identification`**
5. 確認正式機顯示的 Callback URL 是 `https://` 開頭（見第 7 節最後一列）

## 7. 疑難排解

**Google**

| 症狀 | 原因 |
|---|---|
| `Error 400: redirect_uri_mismatch` | Google 登記的 URI 與 Authentik 送出的不一致（http/https、slug、結尾 `/`）。錯誤頁的 error details 會顯示 Authentik 實際送了什麼 |
| `access_denied` / 此應用程式僅限組織內部使用 | 目標對象是 Internal 但用了組織外帳號；或 External + 測試中但帳號不在 test users |
| 登入頁沒有 Google 按鈕 | Source 沒加進 identification stage 的「來源」，或 provider 沒指向 demo flow |
| 用 Google 登入後多了一個新帳號 | 預設的唯一識別碼配對，見 1.1 |
| 新帳號的 Dashboard 群組是空的 | 預期行為，新帳號不在任何群組 |
| app 登出後再按登入直接進去 | 預期行為：Authentik 與 Google 的 session 都還在（見 `CLAUDE.md` 三層信任邊界） |

**Microsoft**（錯誤頁都有 `AADSTS` 錯誤碼，照碼查最快）

| 錯誤碼 | 原因 |
|---|---|
| `AADSTS50011` | Redirect URI 不一致 |
| `AADSTS50194` | Single tenant app 用了 `common` 端點 → 換成 tenant ID |
| `AADSTS7000215` | Secret 錯誤，通常是貼成 Secret ID 而不是 Value |
| `AADSTS7000222` | Secret 過期 → 建新的貼進 Authentik |
| `AADSTS65001` / 需要管理員核准 | 公司不允許使用者自行同意 → Grant admin consent |
| `AADSTS50020` | 帳號不在這個 tenant（例如個人 Outlook 帳號） |

**正式機共通**

| 症狀 | 原因 |
|---|---|
| 正式 Authentik 顯示的 Callback URL 是 `http://` | Cloudflare Tunnel / proxy 沒把 `X-Forwarded-Proto: https` 傳給 Authentik，Google / Microsoft 一定會回 redirect URI 不符 |
