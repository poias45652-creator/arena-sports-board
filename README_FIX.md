# Arena Render 修正包

此修正包供已上傳 render-release 的專案覆蓋使用；不需要重新上傳全部歷史資料。

## 操作

1. 解壓本 ZIP。
2. 在 GitHub Desktop 確認 Current branch 是 render-release，按 Show in Explorer。
3. 將本 ZIP 解壓出的全部內容複製到該專案資料夾，選擇取代同名檔案。app 子資料夾內兩個檔案也需要覆蓋。
4. 到專案的 public 資料夾，如果還有舊版 index.html、app.js、styles.css，僅刪除這三個檔案。這三個是完整移轉版已移除、但舊 repo 仍留下的介面檔；其餘資料保留。
5. 回 GitHub Desktop，Summary 填「修正 Render 編譯」，Commit 到 render-release，然後按 Push origin。
6. 等待 GitHub Actions 的 Arena Render verification。全部通過後才進行合併與 Render 部署。

## 實際修正

- package.json／package-lock.json：將 react-is 19.2.6 明確列為正式相依，與 React 19.2.6 對齊。先前只有 peer 標記，在 legacy-peer-deps 的乾淨安裝中未被裝入，造成 Recharts 編譯失敗。[Recharts 官方安裝說明](https://github.com/recharts/recharts#installation)
- app/settlement-calculator.tsx／app/teams-directory.tsx：恢復為已驗證的原版 UTF-8 程式內容。GitHub 上這兩個檔案的內容與交付包不同，CI 回報不是有效 UTF-8。
- 更新完整專案的 release-manifest.json 與 VALIDATION_ZH.md。

## 驗證

本次真正執行乾淨 npm ci --ignore-scripts，安裝 534 個套件；27 個來源測試及 15 個分析測試全數通過。移除舊 .next 後正式 build／TypeScript 通過。不是沿用原本的 node_modules 編譯結果。

16 個 PostgreSQL 整合測試需由你 Push 後的 GitHub Actions 執行；本次沒有替你更新 GitHub、合併或部署 Render。

## 檔案清單

本小包共 7 個檔案：2 個頁面、package.json、package-lock.json、release-manifest.json、VALIDATION_ZH.md，以及本操作說明。release-manifest.json 是完整專案的清單，不是這個小包的清單。
