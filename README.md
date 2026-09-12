# YJ體育分析｜Render 完整修復版

本包取代前一份 arena-sports-board-v91-render.zip，補齊遺漏的管理員建立會員功能與原本修改過的登入畫面。

## 本次恢復

- 管理後台最上方的「新增會員帳號」：填寫帳號、密碼後按「新增帳號」。新帳號固定為會員，管理員維持自己的登入狀態。
- 前台維持原版「不開放自行註冊」設定；會員由管理員建立。
- 登入頁恢復 YJ 圖示、「YJ體育分析」、「登入 YJ體育分析」，欄位為「帳號」「密碼」。
- 登入背景恢復原始 30 秒、1920 × 1080 影片，靜音自動循環播放。
- 首頁的管理後台／登出入口、後台登出按鈕及前一包的文字修改仍保留。

這些指定功能從已驗證校驗碼的既有 Render 原版封存檔取回，再套用到目前第 91 版；目前的完整首頁、投打對照、賽事資料及其他頁面保留。

## 上傳與部署

1. 解壓縮後，將 arena-sports-board 資料夾內的完整內容放到 GitHub 專案根目錄，package.json 必須在根目錄。
2. 一併提交所有程式、設定及 public/0912-bg.mp4 影片；本包包含原始影片，請勿漏傳。
3. Render 使用 Node.js 24，Build Command：npm ci --ignore-scripts && npm run build；Start Command：npm start；Health Check Path：/api/health。
4. 保留原有環境變數與 PostgreSQL 資料庫，重新部署最新提交。既有帳號與管理員不需重建。

不包含真實帳密、Token、金鑰、.env、會員資料或資料庫備份。本包已包含 pg、鎖定檔、完整前後端、靜態資產及資料庫結構。

## 驗證

- npm run build：正式建置、TypeScript 與 standalone 打包通過。
- npm run test:accounts：在本機正式伺服器、隔離模擬資料庫測試管理員建立會員、新會員密碼登入、管理員工作階段保留、重複帳號／會員／跨站阻擋、公開註冊禁止、登入頁品牌文字、影片分段讀取及登出。
- tests/render-auth.test.mjs 為原版專用 PostgreSQL 整合測試，需另設專用測試資料庫；本次未執行此資料庫測試，未修改線上資料。
- 本包尚未推送至 GitHub 或部署至 Render。

更完整的恢復來源與說明見 RENDER_V91_FIX.zh-TW.md；檔案校驗見 SOURCE_SHA256SUMS.txt。
