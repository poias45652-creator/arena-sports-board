# YJ體育分析｜GPT 版完整原始碼 v91

本壓縮包對應已上線的 arena-sports-board 第 91 版。
網站：https://arena-sports-board.poias45652.chatgpt.site
原始碼提交：b7f9047e951239f41540381c123d5364a83f1674
匯出日期：2026-09-12

## 本次更新

已移除頁面上的「分析權重」按鈕。

## 內容

保留完整前端、後端 API、計算程式、登入與來源連線程式、球員／球隊頁面、即時比分、圖片、歷史運動資料、套件鎖定檔、資料庫結構與遷移 SQL、測試及部署設定。

包含本次對話完成的中央逐局比分板、開賽前留白、盤口展開、串關區域與文字對齊、隊伍分組、球員資料連結、LINE 圖示與連結，以及 LINE 圖示白邊修正。

未加入真實環境變數、帳密、登入 Token、Cookie、會員資料、線上資料庫內容、Git 歷史、node_modules、建置輸出或執行快取。`.env.example` 只含空白設定範本。

## 上傳方式

1. 先解壓縮，進入 `arena-sports-board` 資料夾。
2. 若上傳至 GitHub，請將資料夾內的專案檔案放到儲存庫根目錄，讓 `package.json` 位於根目錄；不要只上傳 ZIP 檔，也不要漏掉 `.openai/hosting.json` 等設定檔。
3. 保留既有主機上的環境變數與資料庫。ZIP 未匯出線上會員或連線工作階段，這些資料不會隨原始碼自動搬移。

## 執行環境

這是目前 GPT / Sites 網站的原始程式。登入依賴平台提供的 ChatGPT 身分與登入路由；資料庫使用 Cloudflare D1 的 `DB` 綁定，歷史資料讀取使用 Worker 的 `ASSETS` 綁定。來源帳號資料使用伺服器端 `TZ_BINDING_KEY` 加密。

部署到不同主機（例如 Render）時，需要先對接該主機的登入、資料庫及資產讀取方式；單純上傳此 ZIP 不會完成這些環境的轉換。本次只匯出 GPT 最新版本，沒有修改 Render 版。

## 本機建置

使用 Node.js 22.13.0 以上版本，以及提供 bash、flock、curl、GNU timeout 的 Linux 環境。Windows 可在 WSL 中執行。

```bash
npm run install:ci
npm run build
```

安裝及建置成功後，可依需要執行 `npm run dev`。本機能啟動畫面，不表示其他主機已具備 GPT 平台的登入與雲端資料庫綁定。原始開發說明另見 `README.md`。

## 版本核對

`EXPORT_VERSION.json` 記錄版本與提交編號。
`SOURCE_SHA256SUMS.txt` 記錄每份原始檔及本說明的 SHA-256，可檢查上傳檔案是否完整。
原始程式與上線版本的提交一致；匯出過程只新增本說明及版本核對檔，未更動網站程式。
