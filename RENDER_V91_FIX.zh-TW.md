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

## 上傳完整 Render 原始碼 ZIP

解壓縮後，將 `arena-sports-board` 資料夾內的內容放到 GitHub 儲存庫根目錄，使 `package.json` 位於根目錄。請包含所有程式資料夾與設定檔，並保留 Render 現有環境變數。

## 套用 GitHub 修正

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

GitHub PR 是對上述第 91 版專案的修補；另提供包含完整前端、後端與部署設定的 Render 專用原始碼 ZIP。GPT / Sites 網站不使用這份 Render 設定。

## 本次文字調整

- 「查看盤口與分析」改為「查看分析」。
- 「盤口與串關結算試算」改為「串關結算試算」。
- 串關頁籤「盤口」改為「分析」。
- 來源選單「SUPER 盤口」改為「SUPER」。
- 「更新盤口」按鈕改為「更新」。

## 登入與登出入口修正

- 首頁右上角補回「登出」按鈕，點擊後呼叫既有登出 API，成功後回到 `/login`。
- 登出失敗時保留頁面並顯示可重試的訊息。
- 保留既有登入、註冊與首次管理員設定頁；登入頁網址為 `/login`。
- 已驗證正式建置、登入表單、未登入時導向登入頁、受保護 API、登出 Cookie 與目前工作階段撤銷行為。測試使用本機伺服器與模擬資料庫，不修改線上會員資料。

## 管理員後台入口

- 管理員登入後，首頁右上角會顯示「管理後台」，點擊前往 `/admin`。
- 入口由伺服器依登入帳號的管理員角色顯示；一般會員不顯示入口，直接開啟 `/admin` 也無法取得後台內容。
- 後台保留原有管理工具，右上角提供「返回前台」與「登出」。
- 使用既有管理員帳號登入即可，不需重新註冊或重建管理員。
- 已在本機正式伺服器驗證管理員可見入口並進入後台、一般會員無法讀取後台或管理 API、未登入者導向登入頁，以及管理員登出後工作階段失效；資料庫使用隔離的模擬工作階段。
