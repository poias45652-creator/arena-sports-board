# 最新 Render v127 覆蓋包

把 ZIP 解壓縮後「所有檔案」一次上傳到 GitHub arena-sports-board 儲存庫根目錄，覆蓋同名檔案並提交。不要再套一層資料夾，也不要只上傳 ZIP 本身。

這些 .bin 是完整原始碼及媒體的分段封裝，不是缺少原始碼。每份小於 25 MB，適合 GitHub 網頁上傳；建置會先驗證並還原完整專案。必須全部上傳，不能與舊版混用。

Render 設定維持：
Build Command: npm ci --ignore-scripts && npm run build
Start Command: npm start
Health Check Path: /api/health
Node: 24

保留既有 DATABASE_URL、TZ_BINDING_KEY、ARENA_SETUP_TOKEN。
若 APP_ORIGIN 有設定，改為實際 Render 網址 https://arena-sports-board.onrender.com；未設定則使用 Render 自動提供的 RENDER_EXTERNAL_URL。

包含 GPT v127 畫面、MLB／CPBL／NPB／KBO 現有功能、最新獨贏手動選取修正；保留 Render 的帳密登入、會員建立、管理員與來源綁定，新增帳號使用權和 Turnstile。

Turnstile 的私密設定不會從 GPT 自動搬移：先在 Cloudflare 同一小工具的主機名稱加入 arena-sports-board.onrender.com，再於 Render 管理後台輸入 Secret Key、完成驗證並儲存。

已完成正式建置與本機獨立資料庫測試。既有資料採附加式遷移保留；未包含私密金鑰或會員資料，未直接部署線上 Render。
完整 README 與驗證紀錄會在建置還原後出現在專案根目錄。
