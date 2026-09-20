# YJ體育分析 v172 Render 專用完整包

來源：原 GPT 網站 v172，commit `d3de8560f62115d693f3ce9329d35a5eb27027d0`。
本包使用 Node.js 24、Next.js 16.2.6、PostgreSQL，保留四聯盟畫面、資料來源、模型、登入、來源連線與後台。這是 Render 相容版本，請勿再使用先前的 Full-Source ZIP 覆蓋本包。

## 上傳既有 Render 網站

1. 將 ZIP 解壓縮。開啟裡面的 `YJ-Sports-v172-Render` 資料夾。
2. GitHub Desktop 選 `poias45652-creator/arena-sports-board` → Repository → Show in Explorer。
3. 把解壓後資料夾「裡面的全部檔案和資料夾」複製進專案根目錄，選擇取代。`package.json` 必須在專案根目錄，不能多包一層資料夾。保留 `.git`；不要上傳私人 `.env` 或金鑰。
4. 先到 Render → arena-sports-board → Environment，確認下表的必要設定。已有的 `DATABASE_URL` 和 `TZ_BINDING_KEY` 請保留，不要重新產生或貼到聊天。
5. GitHub Desktop 左下 Summary 輸入 `修復 Render v172` → Commit to main → Push origin。
6. 原服務已開啟自動部署。Push 後到 Render 的 Deploys 看結果，通常不用再按 Manual Deploy。看到 Live 後開啟 `/api/health`，應顯示 `v172-render.1`，再進入 `/login`。

原 Render 設定可繼續使用：

| 項目 | 值 |
| --- | --- |
| Build Command | `npm ci --ignore-scripts && npm run build` |
| Start Command | `npm start` |
| Health Check Path | `/api/health` |
| Node.js | `24` |

建置會將 14 個已確認不屬於最新版的舊登入等檔案移到 `.render-legacy-backup`，避免混版；不刪資料庫或會員資料。舊 v127 的還原腳本不會再執行。

## Render Environment

| 名稱 | 填寫方式 |
| --- | --- |
| `DATABASE_URL` | 必填。保留既有 PostgreSQL 連線網址。資料庫帳號需有建立 schema/table 的權限。 |
| `TZ_BINDING_KEY` | 必填。32 位元組的 Base64 加密金鑰；已有就保留。更換會使既有來源授權無法解密。 |
| `PLATFORM_ADMIN_USERNAME` | 必填。填你自己的平台主管理員帳號，不是密碼；須經來源平台驗證成功才取得管理權。 |
| `APP_ORIGIN` | 建議填 `https://arena-sports-board.onrender.com`；不填會使用 Render 提供的 `RENDER_EXTERNAL_URL`。自訂網域時請改成實際網域。 |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | 要啟用安全驗證時填 Cloudflare Site Key；必須在建置前設定。 |
| `TURNSTILE_SECRET` | 要啟用安全驗證時填同一小工具的 Secret Key。也相容 `TURNSTILE_SECRET_KEY` 名稱。 |
| `BASEBALL_SYNC_TOKEN` | 選填。只用於既有外部排程呼叫；本包不建立排程或付費服務。 |
| `BASEBALL_SYNC_URL` | 有排程時填 `https://arena-sports-board.onrender.com/api/international-sync`。 |

只有在沒有 `TZ_BINDING_KEY` 時，才在已安裝 Node.js 的本機終端機產生一次，將輸出存入 Render Environment：

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
```

Turnstile 小工具的允許主機名稱須包含 `arena-sports-board.onrender.com`。原 GPT 網域的設定不會自動涵蓋 Render 網域。若未設定金鑰且後台尚未啟用，登入頁不會載入驗證小工具；後台可啟用或停用。設定了 Secret 卻缺 Site Key 時會拒絕登入，不會略過驗證。

## 帳號與資料

- 保留最新版流程：平台驗證成功 → 等待網站管理員授權 → 才能登入。
- 主帳號由 `PLATFORM_ADMIN_USERNAME` 指定。其他帳號在第一次驗證後才會出現在後台待授權清單。
- 後台可以授權、設定到期、停用、刪除網站帳號；主帳號受保護。刪除不會刪掉來源平台帳號，日後再次驗證需重新授權。
- 新版資料表建立在 PostgreSQL 的 `yj_platform_v1` schema，避免與舊版不同格式的 `public.arena_sessions` 等資料表衝突。舊資料保留，但舊網站帳號與舊 Cookie 不會自動變成新平台授權。
- ZIP 不含 GPT 網站正式資料庫、會員、私人金鑰、實際 Token 或授權清單。GPT 網站的管理員授權不會自動搬到 Render。
- 分析模型、研究資料與來源連線程式完整保留。CPBL 不增加中職官網抓取。來源仍可能拒絕 Render 的連線；本地測試不代表來源平台已接受 Render IP。
- 三聯盟研究回測尚未達到套用完整校準的門檻，不宣稱校準已完成。本包沒有建立全天背景排程。

## 已完成的驗證與限制

- 正式 Next.js 建置，包含 TypeScript 檢查；47 項測試及 19 項本機 HTTP 檢查通過。
- 平台登入、來源綁定、SUPER 連線與帳號管理測試。
- PostgreSQL 相容引擎實測：完整表結構、重複遷移、原 public 資料保留、所有固定 SQL、授權、停用、原子交易回滾、JSON 與預測時間欄位。
- 正式建置的本機 HTTP 測試使用獨立 PostgreSQL 測試資料，不使用你的會員或帳密。
- 尚未替你推送 GitHub、部署此包、操作正式 PostgreSQL，或以你的平台帳密從 Render 實際登入。正式環境仍須具備上表設定。

重跑本地驗證：

```bash
npm ci --ignore-scripts
npm run build
npm run test:accounts
npm run test:render
node tests/run-render-http-smoke.mjs
```

`tests/render-http-preload.mjs` 只供本機自動測試。不要在 Render 設定 `YJ_RENDER_HTTP_TEST` 或測試專用 `NODE_OPTIONS`。

本檔為本包部署依據；`docs` 中較舊的 GPT/研究紀錄僅供歷史參考。
