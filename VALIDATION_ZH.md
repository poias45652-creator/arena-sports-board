# Arena 完整專案驗證

驗證日期：2026-09-11。本次在新的空白目錄解壓完整原始碼，重新安裝套件與正式編譯，最後只打包同一份原始碼清單中的檔案。

| 檢查 | 本次結果 |
| --- | --- |
| Node.js | 24.19.0；Render 設定為 Node.js 24 |
| 全新 npm ci --ignore-scripts | 通過，安裝 534 個套件 |
| 來源及結算測試 | 27 / 27 通過 |
| 分析及歷史資料測試 | 15 / 15 通過 |
| next build --webpack | 通過 |
| TypeScript | 通過 |
| Render standalone 包裝 | 通過，server.js、static 及 public 均存在 |
| 完整原始碼與歷史資料 | 255 個檔案，逐檔核對 |
| ZIP | 標準 ZIP / Deflate，檢查 CRC 與逐檔 SHA-256 |
| PostgreSQL 整合測試 | 本次環境無 PostgreSQL，尚未執行；保留 GitHub Actions 測試流程 |
| Render 實際上線與真實會員來源登入 | 尚未由本次交付驗證，需在完整上傳後確認 |

本包直接在 ZIP 根目錄放置 package.json 與 render.yaml，保留必要子資料夾，沒有額外的外層專案資料夾。release-manifest.json 列出其餘 254 個檔案的大小與 SHA-256。

前端、後端、分析、資料庫結構、歷史資料，以及套件 lockfile 均保留已驗證版本。這次整合只更新交付說明與清單，沒有重新設計畫面或修改分析邏輯。

不包含 node_modules、.next、Git 歷史或正式環境秘密。Render 所需的 DATABASE_URL、TZ_BINDING_KEY 與 ARENA_SETUP_TOKEN 使用現有 Environment 設定。

操作方式統一在 DEPLOY_RENDER_ZH.md。請一次透過 GitHub Desktop 提交完整內容，避免分批上傳時 Render 提前建置尚未完整的專案。
