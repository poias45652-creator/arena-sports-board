# Arena：一次上傳完整專案

本 ZIP 解壓後只有 10 個檔案，沒有資料夾。原 Arena 的完整 255 個原始檔案與歷史資料已封裝在兩個 arena-source 檔案內，每個檔案都小於 GitHub 網頁上傳的單檔上限。

## 上傳

1. 將這個 ZIP 完整解壓縮。
2. 打開 https://github.com/poias45652-creator/arena-sports-board/upload/main 。
3. 全選解壓後的 10 個檔案，一次上傳。等所有檔案上傳完，再按 Commit changes。
4. Render 會自動還原並核對全部 255 個檔案，安裝套件，再編譯完整 Arena。

GitHub 上既有的舊 app、lib、db 或其他檔案不會被這個上傳包刪除。建置及啟動會使用自動還原出的完整專案，不依賴那些分批上傳的舊檔案。既有的 Next.js root 設定檔也不會成為此版本的建置入口。

## Render

- Branch：main
- Root Directory：留空
- Build Command：npm ci --ignore-scripts && npm run build
- Start Command：npm start
- NODE_VERSION：24
- Health Check Path：/api/health
- 保留既有 DATABASE_URL、TZ_BINDING_KEY、ARENA_SETUP_TOKEN 與其他 Environment 設定。

成功還原時，日誌會顯示：Arena source restored and verified: 255 / 255 files.

兩個 arena-source 檔案不可混用不同版本；缺少任一檔案或內容不完整時，還原程式會列出檔名並停止。

## 原始碼與功能

原 Arena 的 255 個檔案逐位元保留，包括頁面、分析、來源連線程式、資料庫結構及歷史資料。執行 node arena-prepare.mjs 可在 .arena-app 內取得完整可編輯原始碼。Render 自動完成此步驟。

網站及會員來源的實際連線狀態，需在上線後確認。正式資料庫與金鑰不在這份交付包中。

## 本次驗證

- 原始碼還原：255 / 255，與完整原版逐檔位元比對通過。
- 在保留舊根目錄程式檔案的情境下，乾淨安裝與正式 build 通過。
- Next.js、TypeScript 與 standalone 靜態資源包裝通過。
- 27 個來源測試、15 個分析測試通過。
- 缺少來源封裝檔時，會在編譯前指出缺少的上傳檔名並停止。
- 建置時明確包含 devDependencies，讓 TypeScript 與樣式編譯套件可用。
- 此環境沒有 PostgreSQL；資料庫整合測試與 Render 實際上線仍待部署後確認。

## 日後修改程式

目前部署會讀取來源封裝檔，修改 GitHub 上舊的 app/lib 檔案不會改變此版本。需要修改功能時，先還原出 .arena-app 的完整專案，再修改原始碼並重新產生部署包；也可以直接使用完整原始碼專案的標準部署方式。
