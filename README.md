# YJ體育分析｜第 91 版 Render 完整原始碼

這份是包含 Render 部署修正與最新文字修改的完整專案。

## 上傳方式

1. 解壓縮，進入 `arena-sports-board` 資料夾。
2. 將資料夾內的檔案與子資料夾上傳至 GitHub 儲存庫根目錄，覆蓋現有同名檔案。`package.json` 必須位於根目錄，並一併上傳 `.npmrc` 等設定檔。
3. Render 保持 Node.js 24，Build Command 為 `npm ci --ignore-scripts && npm run build`，Start Command 為 `npm start`，Health Check Path 為 `/api/health`。
4. 保留既有環境變數及資料庫，重新部署最新提交。

本包補回缺少的 `pg` 套件，並修復 Next.js 建置、PostgreSQL、登入身分與歷史檔案讀取的 Render 相容設定。已通過安裝、正式建置及 TypeScript 檢查；實際 Render 與線上資料庫連線仍需部署後確認。

本包保留目前使用的完整前端、後端、靜態資產、運動資料、套件鎖定檔、資料庫結構、測試與部署程式。舊第 74 版封存檔、重複散落的舊檔、Sites 專用建置入口與建置快取未放入本包。沒有加入真實帳密、環境變數、會員資料或資料庫備份。

最新文字：分析權重按鈕已移除；串關頁籤「盤口」改為「分析」；「SUPER 盤口」改為「SUPER」；「更新盤口」改為「更新」；「查看盤口與分析」改為「查看分析」；「盤口與串關結算試算」改為「串關結算試算」。

完整修正背景與驗證範圍請看 `RENDER_V91_FIX.zh-TW.md`。本專案使用 Render 的登入與 PostgreSQL 設定。
