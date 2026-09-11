# Arena 完整專案：GitHub → Render

本包保留 Arena v63 的頁面、分析、來源連線程式、歷史資料及資料庫結構，已包含先前所有補檔及套件修正。

## 一次放入 GitHub Desktop

1. 把本 ZIP 完整解壓縮。開啟後應直接看得到 package.json、app、components、lib、db、public 等。
2. 在 GitHub Desktop 選擇 arena-sports-board，Current branch 選 main。按 Fetch origin；若出現 Pull origin，先完成更新。
3. 按 Show in Explorer，開啟這個 GitHub 專案的本機資料夾。
4. 回到解壓後看得到 package.json 的那一層，按 Ctrl+A、Ctrl+C，再到專案資料夾按 Ctrl+V；同名檔案選擇取代。保留所有必要子資料夾的結構。
5. 如果專案內還有 public/index.html、public/app.js、public/styles.css，刪除這三個舊版介面檔。保留其他檔案、Git 管理資料與自己的環境設定。
6. 回 GitHub Desktop，Summary 填「更新 Arena 完整專案」，按 Commit to main，再按 Push origin。等上傳完成後，才檢查 Render 最新一次部署。

整個 ZIP 是交付用的壓縮包；Render 需要讀到解壓後的程式檔案。GitHub 網頁每次最多上傳 100 個檔案，而本包有 255 個，這份說明採 GitHub Desktop 一次提交完整內容。

## 既有 Render 服務設定

沿用原來的 arena-sports-board Web Service 與 PostgreSQL。

| 欄位 | 設定 |
| --- | --- |
| Repository | poias45652-creator/arena-sports-board |
| Branch | main |
| Runtime / Language | Node |
| Root Directory | 留空，package.json 位於 GitHub 根目錄 |
| Build Command | npm ci --ignore-scripts && npm run build |
| Start Command | npm start |
| Health Check Path | /api/health |
| NODE_VERSION | 24 |

保留現有 DATABASE_URL、TZ_BINDING_KEY、ARENA_SETUP_TOKEN 的值。真實帳密與金鑰留在 Render Environment，不包含在本 ZIP。

APP_ORIGIN 使用原 Render 網址時可不設定；若已設定，應等於實際網站的 HTTPS origin。程式會在未設定時採用 RENDER_EXTERNAL_URL。

啟動入口是 npm start 對應的 scripts/render-start.mjs。server.mjs、worker 及舊平台設定保留作原始參考。

## 上線後確認

1. Render 顯示 Live 後，開啟 /api/health，確認回傳 ok: true、database: true。
2. 開啟 /login，用既有 Arena 帳號登入。資料庫尚無管理員時，使用頁面的第一位管理員建立入口與既有 ARENA_SETUP_TOKEN。
3. 查看概覽、戰績、球隊、賽前分析及管理頁，再由各會員使用自己的來源授權連線。

程式啟動會執行 db/render-schema.sql 補齊 PostgreSQL 結構。既有資料庫及來源加密金鑰必須沿用。原 db/schema.ts 與 drizzle 目錄是 SQLite 版本參考。

此版本保留原版功能；Render 使用 Arena 帳密登入，Sites 平台登入及線上會員憑證不包含在原始碼匯出內。來源網站的網路限制與授權有效性，需在實際部署後驗證。

完整測試範圍見 VALIDATION_ZH.md。GitHub Actions 的 PostgreSQL 測試使用一次性測試資料庫，請勿填入正式資料庫連線字串。
