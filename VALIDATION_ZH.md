# Arena Render 交付與修正驗證

更新：2026-09-11。完整程式基礎為提交 85dc906a2b7ace8f868fd91a8f653f8ad34f035e，保留原版 Sites v63 畫面、功能與歷史資料。

## 這次修正

使用者已將完整檔案上傳到 render-release，提交 94dbe8a8d453198b1da292763b5ba7889407f168。第一次 CI 的 42 個原版測試通過，但正式編譯因兩個上傳後損壞的 TSX 檔，以及缺少 react-is 而失敗；資料庫整合測試未執行。

修正包恢復兩個頁面的原版 UTF-8 位元組，並將 react-is 19.2.6 加入正式相依及固定 lockfile。沒有改動原本頁面設計或分析逻輯。

| 檢查 | 本次實際結果 |
| --- | --- |
| 真正乾淨安裝 npm ci --ignore-scripts | 通過，安裝 534 個套件 |
| react-is 明確正式相依與版本 | 19.2.6，與 React 一致 |
| 來源與結算測試 | 27／27 通過 |
| 分析與歷史資料測試 | 15／15 通過 |
| 清除舊建置後正式 build／TypeScript | 通過 |
| 兩個頁面 UTF-8 與原版內容核對 | 通過 |
| ZIP／逐檔清單 | 打包時核對 CRC 與 SHA-256 |
| 16 個 PostgreSQL 整合測試 | 尚待新提交的 GitHub Actions 執行 |
| 新版本 Render 部署及真實會員來源登入 | 尚未執行 |

完整 ZIP 共 255 個檔案，沒有最外層包裝資料夾；package.json 直接位於 ZIP 根目錄，必要子資料夾保留。完整來源的 248 個原始追蹤檔案均保留；不含 node_modules、Git 歷史、正式環境秘密或 build 輸出。release-manifest.json 列出除本身以外的 254 個檔案。

使用者需移除 GitHub 舊 repo 多出的 public/index.html、public/app.js、public/styles.css；這三個舊檔不在完整 ZIP 內。啟動入口仍是 npm start 對應的 scripts/render-start.mjs。
