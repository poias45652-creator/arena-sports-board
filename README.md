# YJ體育分析：GPT 第 74 版同步包

這是給 arena-sports-board 的 Render 上傳包。以 GPT 網站實際發布的第 74 版為來源，不再使用第 63 版的介面。

來源： https://arena-sports-board.poias45652.chatgpt.site

來源版本：74

來源提交：53be8a1dd616a42fcad20f87e7810af56c7d0b0d

## 怎麼上傳

1. 解壓這份 ZIP。
2. GitHub Desktop 選 arena-sports-board，點 Show in Explorer。
3. 把解壓後的**全部檔案**複製到專案資料夾，選擇取代同名檔案。不要只複製 ZIP，也不要多套一層資料夾。
4. 回 GitHub Desktop，填入「同步 GPT 第 74 版」，按 Commit to main，再按 Push origin。
5. 等 Render 建置完成後開啟網站，按 Ctrl + F5 重新載入。

不用刪除帳號、資料庫、舊資料夾或重新設定金鑰；也不要上傳 .env、帳密或金鑰。

## 這份包包含什麼

- GPT 第 74 版的球場背景、YJ Logo、球隊圖示、導覽框線與完整字體樣式。
- 概覽、排名、球隊列表與各隊頁面、即時比分、每日對戰勝率與盤口。
- 合併的賽事卡片、先發投手 ERA／WHIP、讓分／大小和勝負串關雙分頁。
- 新版各方向盤口正負號、全贏／中洞贏／中洞輸／全輸顏色與排列。
- 右側串關區獨立捲動，以及後台的新增比賽對照功能。
- 保留 Render 登入與管理員新增會員，前台不提供自行註冊。
- 登入頁使用你提供的影片；分析頁使用 GPT 新版球場照片，兩者不混用。

平台必要差別：Render 使用原本的 PostgreSQL、會員登入與環境變數，不使用 GPT 的 Cloudflare 綁定或 ChatGPT 登入標頭。來源授權與即時數值仍取決於各站會員自己的有效連線，不會複製另一站的登入權杖或會員資料。

## 保持既有 Render 設定

- Root Directory：留空
- Build Command：`npm ci --ignore-scripts && npm run build`
- Start Command：`npm start`
- Node：24
- Health Check：`/api/health`
- 保留既有 DATABASE_URL、TZ_BINDING_KEY、ARENA_SETUP_TOKEN 與其他 Environment 值。

成功建置會顯示 `YJ GPT v74 source restored and verified`。根目錄既有的舊 app/lib 程式不會被拿來組裝新版，避免只改到一半。任何封裝檔遺漏或混用舊版，都會在建置前停止。

## 原始碼與驗證

所有可編輯原始碼包含在 arena-source 檔案中；執行 `node arena-prepare.mjs` 可完整還原到 `.arena-app`。逐檔來源比對與版本資訊也在包內。另一份 Arena_GPT_latest_source.zip 是真正的 GPT 第 74 版原始碼備份，**不是 Render 上傳包**。

本地已完成正式建置、TypeScript、39 項來源與盤口測試、15 項分析測試、6 項 ERA／WHIP 測試，並逐檔核對 GPT 第 74 版。185 個共用產品檔案完全相同，其餘為平台登入／資料庫／帳號功能及先前要求的品牌文字調整。

未直接推送 GitHub 或更新線上網站。此環境沒有 PostgreSQL，正式會員資料庫與實際授權盤口仍須在你上傳後驗證；未將這些項目標示為已通過。新版沒有用假資料填補缺少的來源。
