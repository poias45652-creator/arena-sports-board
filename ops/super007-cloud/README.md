# Arena Super007 雲端更新

此程式已備妥，但尚未部署到你的 Cloudflare 帳號。沒有部署、ODDS 綁定與 Cron 排程就不會自動執行。

每分鐘直接讀取 Super007。登入授權只放在 Worker 的 Secret，程式碼及盤口回應均不包含授權。最新盤口存入 KV，成功或失敗時間保留兩天。失敗只重試一次，不刷新舊資料的時間；超過 150 秒的盤口不供推薦。

## 使用 Cloudflare 控制台

1. 登入 Cloudflare，建立名為 `arena-super007-cloud` 的 Worker。
2. 在程式編輯器貼上同資料夾 `worker.mjs` 的完整內容，儲存部署。
3. 建立 Workers KV namespace，名稱可填 `arena-super007-odds`。
4. 在 Worker 的 Bindings 加入 KV，變數名稱必須是 `ODDS`，選取剛建立的 namespace，再部署。
5. 在 Worker 的 Settings → Variables and Secrets 新增 Secret，名稱 `SUPER007_HEADERS`；值是從你自己的 HAR 取出的必要請求標頭 JSON（含 ssstoken、sssmbid、ssslang、content-type、user-agent、origin、referer、accept）。不要公開這個值。
6. 在 Worker 的 Settings → Trigger Events 新增 Cron：`* * * * *`（每分鐘一次）。設定可能需要一段時間生效。
7. 開啟 Worker 網址加 `/health`。確認 `fresh: true`、`lastFetchedAt` 前進、`attempts` 增加。
8. 將 Worker 網址交回 Arena 維護者，將 Arena 後端環境變數 `SUPER007_COLLECTOR_URL` 設成 `https://你的-worker.workers.dev/odds` 並重新發布。

Token 必須放在 Secret，不可寫入程式碼；不要把 HAR 上傳到公開儲存庫。

## 方案額度

每分鐘抓取一次，正常每天約 1,440 次來源請求及 2,880 次 KV 寫入，另有網站讀取與監測請求。啟用前確認帳戶額度足夠；本程式沒有替你開通付費方案。

## 全天驗證

關閉 Arena 後，再檢查 `/health`，確認排程仍增加。運作至少 24 小時後檢查過去 24 小時的成功數、失敗數、最大間隔與觀察時數；不能只看單次 `fresh: true`。

來源 Token 失效時，需透過來源站正常登入取得新授權，再更新 Worker 的 `SUPER007_HEADERS` 秘密設定。本程式不包含未確認的自動登入或續期功能，也不能保證來源持續允許連線。

文件：https://developers.cloudflare.com/workers/configuration/cron-triggers/

KV 設定：https://developers.cloudflare.com/kv/get-started/

若使用 Wrangler 部署，先將真實 KV namespace ID 加入設定；不要填虛構 ID。此資料夾沒有帳戶 ID、權杖或其他秘密。
