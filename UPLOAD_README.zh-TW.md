# Render 修正版：GPT v127 完整同步 + 管理員復原（R2）

此包取自 GPT d502240ad7901fde4c64b50e23c2c700295fcbcc。
包含最新版版面、獨贏手動選取、多因素分析、國際聯盟解析、立即更新與後台資料檢查。
保留 Render PostgreSQL、獨立帳號、會員資料隔離、登入影片及管理員建立會員。

## 上傳
將此 ZIP 解壓縮後的全部 10 個檔案覆蓋 GitHub 專案根目錄，Commit / Push。
Render Build Command：npm ci --ignore-scripts && npm run build
Start Command：npm start
等待部署 Live。
四個 .bin 是完整原始碼的分片，建置前會驗證雜湊並還原。不要單獨上傳 ZIP。
/api/health 的 release 應為 render-v127-r2。

## 免費方案重設管理員密碼
新版上線後：Render → arena-sports-board → Environment → Edit，新增：

ARENA_RECOVERY_USERNAME：dvp03002
ARENA_RECOVERY_PASSWORD：自行輸入的新密碼（不要傳給其他人）
ARENA_RECOVERY_ID：自己填入至少 16 個字元的一次性識別字，例如 recovery-20260914-first

保留原本其他環境變數，按 Save, rebuild, and deploy（或儲存後手動部署）。
此功能只接受已有管理員；若資料庫完全沒有管理員，才建立或復原指定帳號為首位管理員。
若指定帳號不是管理員且資料庫已有其他管理員，會拒絕操作，不會擅自升權。
成功日誌：Arena administrator recovery: completed。
同一識別字再次啟動：already-applied，不會反覆重設密碼或踢出登入。
成功後刪除上述三個環境變數並儲存部署，再使用新密碼登入。
登入成功後仍需用「連接 SUPER」輸入你自己的來源站帳號。

密碼重設會撤銷該帳號舊登入、清除登入嘗試限制，恢复管理員使用權。
不會停用 Turnstile 或改動其他會員；沒有預設密碼。若日誌拒絕操作，請提供該錯誤文字，不要提供密碼或資料庫連線字串。

目前完成程式及隔離資料庫測試；尚未替你的正式資料庫實際變更密碼。
