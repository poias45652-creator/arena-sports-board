# YJ 三聯盟當日資料採集與網站接口

這是新增檔案補丁及採集程式，不是完整網站原始碼，也不是已部署完成的版本。

## 本次實際取得

2026-09-15 台灣時間 11:55，NPB 6 場、KBO 4 場、CPBL 3 場，共 13 場。
所有場次均為賽前；比分保留 null。本包沒有已驗證的場中數值變化。
中職共讀到 18 筆來源列出的打序，集中於一場；不代表全部場次先發均已正式確認。
來源擷取時間與來源本身的更新時間分開記錄；後者未知時為 null。

## 執行採集

使用 Node.js 22 以上；網站原專案指定 Node.js 24。
在本資料夾根目錄執行：

```bash
node scripts/collect-baseball-live.mjs
```

採集器使用公開頁面或公開 JSON，不需新增 API Key。
執行環境必須能連接 Naver、Sportsnavi、Yahoo 台灣。
輸出位於 `baseball-current/current.json`、各聯盟 JSON 及 `verification.json`。
這是單次採集命令，不會自行安裝常駐服務或排程。
偵測到 live 比賽時，會等待至少 65 秒再抓一輪，另存第二次觀測並比對場況。
403、428、驗證碼或來源失效不會繞過，會回報錯誤。

## 接入現有網站

`server/`、`scripts/`、`app/api/international-live/` 三個目錄內為新增程式。
在現有 YJ v127 R6 原專案使用，保留原本的套件、登入與資料庫設定。
不要用這個資料夾取代整個原始專案。
新增管理員驗證接口：

```text
/api/international-live?league=NPB
/api/international-live?league=KBO
/api/international-live?league=CPBL
```

接口使用原本 `getArenaUser` 與 `getPool`，目前僅管理員可讀取。
接口實際被呼叫時，取得當日資料並寫入 `arena_baseball_current_v1`；不會覆寫既有會員、分析或帳號資料表。
場中快取 60 秒、賽前快取 300 秒；失敗時保留原有資料與原擷取時間。
這是請求觸發更新的驗證接口，不是已接上會員畫面的背景即時服務。
本包不含會員頁面的接線修改，也未完成整站 Next.js 建置或 Render 實機驗證。

## 已完成的測試

1. 真實網路回應：三聯盟 13 場，解析全部成功。
2. GitHub Actions 獨立 PostgreSQL 16：13 筆成功寫入、13 筆讀回，重複寫入 0 筆。
3. 本地解析器單元測試：見 `evidence/unit-tests.txt`。測試中的過去完賽樣本或合成 live 狀態不是今日即時證據。

```bash
node --test tests/live-providers.test.mjs
```

採集與資料庫測試紀錄為 GitHub run 34926808234。
工作分支：`data/live-source-probe-20260915`。
本包採集程式與當日觀測來自該次通過的執行；API route 另外包含後續的正確入口匯入修正，blob SHA `d2baa0b888cd6896cc8bac31aed70b014ced764f`。

## 尚未完成

尚未驗證三聯盟各自實際進行中比賽的連續數值變化。
中職已查看的完賽樣本用球數為 null，逐球資料亦未提供；不會以 0 代替。
日職與中職的壘包、好壞球、出局數尚未驗證。
來源列出打序不等於官方已確認先發；來源可能修正即時紀錄。
沒有更動正式 main、Render、登入、帳號或正式資料庫。
公開可讀與再散布授權不同，本包的技術讀取驗證不代表取得長期對外商業展示授權。

## 已啟用的後續驗證

ChatGPT 任務「驗證三聯盟即時資料」已設定每日台灣時間 13 至 23 點每小時驗證。
每一輪重新執行隔離分支採集工作，遇 live 時做雙次觀測。
每個聯盟需有真正場中數值變動的證據才可標記通過；未通過不宣稱完成。
這個任務與網站本身的逐秒或逐分鐘更新是不同功能。
