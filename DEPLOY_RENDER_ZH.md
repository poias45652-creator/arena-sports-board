# Arena：GitHub → Render 部署說明

這是現有完整 Arena v63 的 Render 適配包。包含原本前端、後端、分析、歷史資料、PostgreSQL 結構與 GitHub Actions 驗證流程。本次交付檔案；尚未替你上傳或部署。

## 1. 將程式放進 GitHub

1. 將 ZIP 解壓到一個空白資料夾。本包已移除最外層的 `arena-sports-board` 包裝資料夾，解壓位置會直接看到 `package.json`、`app/`、`public/` 等內容。
2. 在你的 `poias45652-creator/arena-sports-board` 專案建立 `render-release` 分支。
3. 把解壓出的全部檔案與子資料夾放到儲存庫根目錄。根目錄要直接看得到 `package.json`、`package-lock.json`、`render.yaml`、`app/`、`server/`、`public/`；保留 `.github/`、`.npmrc`、`.node-version` 及 `.gitignore`。
4. 如果舊版儲存庫仍有 `public/index.html`、`public/app.js`、`public/styles.css`，刪除這三個舊版介面檔。這份新包已移除它們。保留 Git 管理資料及你自己的環境秘密，不要清空整個本機專案。
5. Commit 並 Push。到 GitHub 的 Actions 查看 **Arena Render verification**，等待驗證結果。先完成下面第 2 節的 Render 設定，再將通過驗證的分支合併到 `main`。

上傳的是解壓後的程式檔，不能只把整個 ZIP 放進 GitHub。使用 GitHub Desktop 或 Git 可以一次送出完整專案；GitHub 網頁每次最多上傳 100 個檔案，而本包超過 100 個，需分批才完整。[GitHub 官方上傳說明](https://docs.github.com/en/repositories/working-with-files/managing-files/adding-a-file-to-a-repository)

## 2. 設定既有 Render 網站

打開你原本的 `arena-sports-board` Web Service，沿用既有 PostgreSQL。這份專案有登入與後端，需要 Node Web Service。[Render Next.js 官方說明](https://render.com/docs/deploy-nextjs-app)

| 欄位 | 填入內容 |
| --- | --- |
| Repository | 你上傳完整程式的 GitHub 專案 |
| Branch | `main`，待驗證通過後合併 |
| Runtime / Language | `Node` |
| Root Directory | 留空；前提是 `package.json` 直接放在儲存庫根目錄 |
| Build Command | `npm ci --ignore-scripts && npm run build` |
| Start Command | `npm start` |
| Health Check Path | `/api/health` |
| Region / Plan | 沿用既有 Singapore 與原方案 |

既有服務的 `npm install` 也有相容啟動建置流程，但上表指令使用固定 lockfile，並避免重複 build。不要改用 `node server.mjs`；那是保留的舊版程式。

### Environment 要填什麼

| 變數名稱 | 內容 |
| --- | --- |
| `NODE_VERSION` | `24`；套件與 `.node-version` 也限制使用 Node.js 24 |
| `DATABASE_URL` | 保留目前正在使用的 PostgreSQL 連線字串 |
| `TZ_BINDING_KEY` | 保留既有值；若從未設定，才產生 32 bytes 的 base64 金鑰 |
| `ARENA_SETUP_TOKEN` | 保留既有管理員設定碼；只有第一次建立且從未設定時才新增 |
| `APP_ORIGIN` | 使用原 Render 網址時可不設定；若已有值，確認是網站實際 origin，例如 `https://arena-sports-board.onrender.com`；自訂網域則填自訂網域的 HTTPS origin，不加 `/login` 等路徑 |

`.env.example` 只有空白欄位作參考。實際密碼、Token 及金鑰填在 Render 的 Environment，不能 Commit 到 GitHub。

Node 版本選擇會優先採用 Render 的 `NODE_VERSION`，因此也要確認舊環境變數沒有指定其他版本。[Render Node.js 版本說明](https://render.com/docs/node-version)

如果需要重新取得 `DATABASE_URL`，到你既有的 Render Postgres 頁面，複製 **Internal Database URL**；網站與資料庫需在同一帳號及同一地區。不要將連線字串貼到 README。[Render PostgreSQL 連線說明](https://render.com/docs/postgresql-creating-connecting)

僅限全新環境且沒有既有金鑰時，可在自己電腦的 Node.js 終端機執行以下指令。輸出各自貼到 Render，不存進原始碼。

產生 `TZ_BINDING_KEY`：

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
```

產生 `ARENA_SETUP_TOKEN`：

```bash
node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
```

## 3. 驗證通過後部署

1. GitHub Actions 的 **Arena Render verification** 全部成功後，把 `render-release` 合併至 `main`。
2. 既有 Render 若已啟用自動部署，等待這次更新部署即可；若沒有啟用，手動選擇部署最新提交。
3. 等 Render 顯示 `Live`，打開網站的 `/api/health`，應回傳 `ok: true`、`database: true`。
4. 打開 `/login`。已有 Arena 帳號就用原帳號登入。資料庫尚無管理員時，頁面提供第一位管理員建立入口，輸入 Render 裡的 `ARENA_SETUP_TOKEN`、新管理員帳號及密碼。
5. 查看概覽、戰績排名、球隊一覽、即時比分、賽前分析及管理頁。各會員再使用自己的來源授權完成連線，Device ID 由程式自動處理。

GitHub 通過的是程式與一次性測試資料庫的驗證；網站是否成功上線，以 Render 部署狀態與實際頁面為準。

## 資料與原版功能

- 啟動時會自動執行 `db/render-schema.sql` 的新增／補齊結構遷移，程式採交易及鎖定；不提供清空正式資料庫的步驟。
- 原 `db/schema.ts`、`drizzle/` 是 SQLite 版本參考，不能拿來初始化正式 PostgreSQL。
- 此包保留原頁面與資料。Render 使用 Arena 帳密登入；Sites 的平台登入、線上會員及憑證不包含在原始碼匯出內。
- 程式設計為相容既有 Render 帳密及 session，舊 `source_bindings` 資料保留。新的個人來源 Token 仍需各會員走登入／綁定流程建立。
- 真實來源網站仍可能拒絕 Render 網路或過期授權。部署成功不代表盤口來源一定可連；失敗會顯示原錯誤，不會假造成功。
- 本版依頁面／API 請求更新，沒有另外啟動 24 小時常駐抓取或排程服務。

## 驗證指令與範圍

```bash
npm ci --ignore-scripts
npm run test:source
npm run test:analysis
npm run build
```

本包的 `VALIDATION_ZH.md` 記錄這次實際檢查結果。GitHub Actions 還會啟動一次性 PostgreSQL 18，再執行 `npm run test:render` 的 16 個整合測試；不需要填正式資料庫秘密。

`test:render` 有會清空測試資料的 fixture，只允許指定的本機／CI 測試資料庫。不要將 `TEST_DATABASE_URL` 設成正式資料庫，也不要移除其檢查。

`render.yaml` 提供同樣設定作參考，並要求手動提供現有資料庫及秘密，不會宣告新資料庫。使用既有服務時，在服務設定填上表內容即可，不必另外建立 Blueprint。`worker/`、`vite.config.ts`、舊 ops／研究脚本保留作原始參考，不是這次的部署入口。

## 常見問題

| 畫面或訊息 | 檢查位置 |
| --- | --- |
| 找不到 `package.json` | GitHub 根目錄是否多套一層資料夾，或只上傳 ZIP |
| Build 找不到模組 | 是否完整上傳 lockfile、`.npmrc`、原始碼；是否自行省略 devDependencies |
| `Arena database migration failed` 或 health 回傳 503 | `DATABASE_URL`、資料庫是否可用、網站與資料庫地區是否一致 |
| 登入／註冊回報來源不符 | `APP_ORIGIN` 是否等於瀏覽器正在開啟的網站 origin |
| SUPER／tz 連線被拒 | 在會員介面核對個人授權與來源狀態；不需要手動尋找 Device ID |

資源需求與 Render 上線驗證仍需以你實際部署結果為準；本次沒有替你更動方案或執行部署。
