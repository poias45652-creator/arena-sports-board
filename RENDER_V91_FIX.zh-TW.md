# 第 91 版 Render 修補說明

本修補適用於 `poias45652-creator/arena-sports-board` 已上傳第 91 版的 Render 專案，基底提交為 `c9eff761f2076e00ab3fed35bedcf4e3ba9ec597`。

## 為什麼建置失敗

上傳 GPT / Sites 原始碼後，Render 專用的套件、建置、登入和資料庫設定被覆蓋，而 `server/database.mjs` 等 Render 程式仍保留。第一個錯誤是缺少 `pg`，後續還會遇到 Cloudflare 綁定、登入身分和部署輸出格式不相容。

## 本次修正

- 補回 `pg`、`react-is` 與對應的套件鎖定檔。
- 使用 Next.js 正式建置與 standalone 輸出，由既有的 Render 啟動程式啟動。
- 恢復既有 PostgreSQL 介接、Cookie 登入、管理員角色驗證及會員資料分隔。
- 歷史資料從專案的 `public` 目錄讀取，保留路徑檢查。
- TypeScript 檢查目前使用的程式目錄，避免把根目錄遺留的重複舊檔視為程式入口。
- 保留第 91 版前端、球員資料頁、比分板、LINE 連結與已移除的「分析權重」按鈕狀態。

## 套用修補包

1. 解壓縮修補 ZIP，將裡面的檔案與資料夾覆蓋到目前 GitHub 專案根目錄，與現有 `package.json` 放在同一層。不要只上傳 ZIP 本身。
2. 一次提交全部修補檔，包含 `package.json`、`package-lock.json`、`.npmrc` 和所有修補的程式檔。
3. Render 使用下列設定，重新部署最新提交：

   - Node.js：24
   - Build Command：`npm ci --ignore-scripts && npm run build`
   - Start Command：`npm start`
   - Health Check Path：`/api/health`

既有 `DATABASE_URL`、`TZ_BINDING_KEY`、`ARENA_SETUP_TOKEN` 和資料庫保持原設定。修補包不包含真實帳密、環境變數、會員資料或資料庫備份。

不要重新啟用 `arena-prepare.mjs` 作為建置入口；該檔案會還原舊的第 74 版封存程式。

## 驗證結果與範圍

- `npm ci --ignore-scripts`：通過。
- `npm run build`：通過，包括 TypeScript 檢查與 standalone 打包。
- PostgreSQL 套件載入、SQL 參數綁定與登入 Cookie／來源檢查：通過。
- 實際 Render 部署與線上資料庫連線尚待部署後確認。

本包是 Render 修補檔，不是完整原始碼；請套用到上述第 91 版專案。GPT / Sites 網站不使用這份 Render 設定。
