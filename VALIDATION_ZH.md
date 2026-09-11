# Arena Render 檔案包驗證

交付日期：2026-09-11。

來源為完整移轉提交 `85dc906a2b7ace8f868fd91a8f653f8ad34f035e`，其原版介面基礎為 Sites v63。完整保留全部 248 個來源追蹤檔案；本次調整僅涉及 Node 版本範圍、範例環境變數、Render 網域預設、GitHub CI 觸發與交付說明。未修改 app／components／lib／data／public／server／db 的內容。

| 檢查 | 本次結果 |
| --- | --- |
| 原始追蹤檔案完整性 | 248 個全部保留，0 個遺漏 |
| 既有核心內容比對 | app／components／lib／data／public／server／db 的 177 個檔案逐 byte 不變 |
| 套件鎖檔 | dependencies、devDependencies、Node 版本範圍一致 |
| 原版來源與結算測試 | 27／27 通過 |
| 原版分析與歷史資料測試 | 15／15 通過 |
| 正式編譯與 TypeScript | 本次在 Node.js 24.19.0 正式 build 通過，沒有忽略型別錯誤 |
| standalone 交付步驟 | public 靜態資產逐檔相符，.next/static 已複製 |
| 設定檔 | render.yaml 與 CI YAML 可解析，建置、啟動及 health 設定已核對 |
| 特定秘密格式掃描 | 私鑰、GitHub／AWS／OpenAI／Render 金鑰及非測試資料庫密碼網址的檢查無命中；不是完整資安稽核 |
| ZIP 完整性 | CRC 與內含逐檔 SHA-256 核對通過 |

本機驗證使用既有固定版本相依目錄，未執行新的乾淨網路安裝；GitHub CI 才會重新執行 npm ci。


以下項目仍待你上傳及部署後驗證：乾淨 CI 安裝、16 個真正 PostgreSQL 整合測試、Render Live 狀態、實際登入及會員來源連線。本機沒有 PostgreSQL server，不能將尚未執行的資料庫測試描述為通過。

包內 `release-manifest.json` 列出交付檔案大小與 SHA-256（manifest 本身除外），供核對傳輸完整性。沒有打包 node_modules、build 輸出、Git 歷史或正式環境秘密。

## 壓縮檔修復

先前交付的 ZIP 發現結尾缺失。本包已從全部 253 個已核對雜湊的來源檔重新產生，維持相同程式內容；部署與驗證說明改為英文檔名，內容仍為繁體中文。使用標準 ZIP 2.0 Deflate、ASCII 路徑與 Windows 屬性。

## 根目錄包裝調整

依要求移除 ZIP 最外層的 arena-sports-board 包裝資料夾。程式必要的 app／components／data／public 等子資料夾完整保留；只更新包裝與操作說明，核心程式內容不變。ZIP 共 254 個檔案，package.json 直接位於 ZIP 根目錄。
