# 遊戲人生球隊原型與強度

資料檢視日期：2026-10-21。資料集中於 `public/game-life/club-world.js`。

每個既有職業與育成球隊位置都有運動種類、永久存檔鍵、改編名稱、現實原型、強度與參考來源，共 256 筆。校園聯賽保留虛構校隊。這是精簡的遊戲世界，沿用每組八隊與原有短賽季，並非完整重製現實聯盟成員與賽制。台灣棒球八個位置採六支職棒原型及兩支二軍原型；台灣籃球混合兩個職業聯盟的原型。育成隊採母隊體系改編，並非宣稱每個原型都有同名的現役次級隊伍。

## 評分方式

`power` 是人工校準的遊戲評分，不是官方能力值、勝率或即時排名。參考近期可取得的戰績、聯盟層級及歐洲賽事表現，保留強隊、中段與發展球隊的差距；新球季樣本少時也參考最近完整球季。各國、各運動之間沒有可直接比較的官方能力尺度，跨聯盟落差是遊戲設計估計。育成體系比對應一軍降低 20 分。

此值直接寫入既有俱樂部資料的 `power`，原引擎會用於先發角色、對手能力、關鍵回合成功率及其他場次模擬。不覆寫玩家已收到的合約報價、不重算已開始的焦點比賽、不改動歷史賽果。未來的新報價與新比賽採更新後的球隊評分。數值是版本快照，不會在讀檔時重新連線或抽籤。

## 主要參考

- 中職：https://cpbl.com.tw/standings/season （官方索引與目前頁面擷取不一致；另核對 2026 全季資料 https://tw.sports.yahoo.com/cpbl/standings/?season=2026）
- 日職：https://npb.jp/bis/eng/2026/stats/
- 韓職：https://eng.koreabaseball.com/Standings/TeamStandings.aspx
- 大聯盟：https://www.mlb.com/standings/2026
- 西班牙棒球原型與近況：https://astrosbeisbolvalencia.com/tag/sbl/ 、https://www.rfebs.es/
- 台灣足球：https://www.ctfa.com.tw/2026-a/results/67-tfpl2026/467/0/0/0.html
- 日本足球：https://www.jleague.jp/en/j1/standings/
- 韓國足球：https://www.kleague.com/record/team.do
- 美國足球：https://www.mlssoccer.com/standings/2026/conference
- 歐洲足球：https://www.uefa.com/ 、https://www.premierleague.com/en/tables/premier-league
- 葡萄牙：https://www.ligaportugal.pt/competition/911/liga-portugal-betclic/round/20262027
- 荷蘭：https://www.knvb.nl/node/71918
- 台灣籃球：https://tpbl.basketball/stats/teams
- 日本籃球：https://www.bleague.jp/
- 韓國籃球：https://www.kbl.or.kr/
- NBA：https://www.nba.com/playoff-picture 、https://www.nba.com/news/offseason-power-rankings-west-2026
- 西班牙籃球：https://acb.com/

## 存檔相容

`id` 保留舊隊名作為永久識別，不得改成畫面名稱。球員、家庭、金錢、合約、歷史、賽程與亂數狀態均不遷移。介面只在明確的球隊欄位使用 `name(sport,id)`；球員、伴侶、孩子的姓名不經過此轉換。球隊產生的記事可使用 `text(sport,text)`，並維持 HTML 跳脫。

## 驗證

`tests/game-life-club-world.test.mjs` 檢查全部隊伍覆蓋、同運動名稱唯一、評分上下限、育成落差、舊合約與進行中比賽逐位元組不變、球隊顯示與人名分離、十五個運動／國家組合的起點和賽季長度。既有聯賽測試另外驗證強敵降低三種球類的關鍵回合成功率。
