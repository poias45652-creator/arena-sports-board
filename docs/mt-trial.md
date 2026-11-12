# MT 個人試玩帳號

管理員登入星準，在「會員管理」展開「MT 試玩帳號」，按「建立試玩帳號」。將產生的帳號、一次顯示的密碼與試玩入口私下交給對方。帳號僅授權 MT 試玩。既有會員與唯讀帳號維持各自的授權方式。

訪客在品牌官網的 MT 區塊或獨立入口 `/mt-trial` 登入。登入沿用星準的安全驗證設定。開始牌桌或選擇試用牌路工具後開始計時。每組帳號可使用 10 分鐘，到期後 24 小時可再試。重新整理、重新登入或更換網路會接續同一筆資料庫紀錄。管理員可在同一頁停用帳號。個人試玩帳號的密碼只儲存 scrypt 雜湊。

## 部署

品牌前端提供不可變的試玩資源，版本與 SRI 值見 `lib/mt-trial-workspace.ts`。先提供新資源並在目前使用的牌桌服務分支部署支援 `/v2/sessions` 的版本，再部署會員服務。資料表於既有啟動遷移時建立。畫面服務使用現有的 `MT_SCREEN_KEY` 檢查帳號是否仍有效。舊版 IP 紀錄無法對應至新發的個人帳號，各自首次成功開桌起算。

既有的 `OFA_MT_TRIAL_ENABLED` 與伺服器端 `OFA_MT_TRIAL_PASSWORD` 控制原廠測試牌桌。訪客取得個人試玩登入，原廠試玩帳號與點數仍由既有 OFA/MT 測試環境提供。原廠拒絕連線時頁面會顯示連線失敗。

## 驗證

```sh
node --test tests/mt-trial-accounts.test.mjs tests/mt-trial-limit.test.mjs tests/mt-trial.test.mjs tests/yj-viewer-account.test.mjs
(cd mt-trial-browser && python -m unittest test_screen)
```
