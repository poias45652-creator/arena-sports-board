# Arena — Render 完整部署包

保留現有 Arena v63 畫面、功能與歷史資料，使用 Node.js 24、Next.js 及 PostgreSQL 執行。

**先讀 [DEPLOY_RENDER_ZH.md](DEPLOY_RENDER_ZH.md)**：包含 GitHub 上傳方式、Render 各欄位填法、環境變數、第一次登入及排錯。

| Render 設定 | 內容 |
| --- | --- |
| Runtime | Node |
| Node version | 24 |
| Build Command | `npm ci --ignore-scripts && npm run build` |
| Start Command | `npm start` |
| Health Check Path | `/api/health` |

本 ZIP 沒有最外層包裝資料夾。解壓後，將全部檔案與子資料夾放進 GitHub 儲存庫根目錄，讓 `package.json` 直接位於根目錄。`app/`、`public/` 等是程式必需的子資料夾，請保留其結構。實際秘密填在 Render Environment；保留既有 DATABASE_URL、TZ_BINDING_KEY 及 ARENA_SETUP_TOKEN。

[VALIDATION_ZH.md](VALIDATION_ZH.md) 記錄已完成與待完成的檢查。GitHub Actions 會執行原版測試、正式 build 與一次性 PostgreSQL 整合測試。本包尚未實際部署到 Render。

原始平台移轉說明保存在 [docs/ORIGINAL_MIGRATION_NOTES.md](docs/ORIGINAL_MIGRATION_NOTES.md)。
