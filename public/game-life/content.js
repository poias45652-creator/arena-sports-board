/* 星準生涯事件：所有球員、球隊與事件皆為遊戲創作。 */
(function(root){
const choice=(label,hint,effect,extra={})=>({label,hint,effect,...extra});
const risk=(label,hint,chance,good,bad,extra={})=>choice(label,hint,{}, {chance,good,bad,...extra});
const event=(id,title,text,options,extra={})=>({id,title,text,options,category:'生涯日常',...extra});
const EVENTS=[
event('extra','最後離開球場的人','隊友已經收拾背包，教練卻留下一籃球。今晚多練一小時，還是把身體留給明天？',[risk('留下特訓','成功：技術 +4；失手：健康 -6。體力 -12。',.7,{a:[4,0,0,0]},{health:-6},{effect:{energy:-12},stat:0}),choice('依計畫收操','體力 +20，健康 +3。',{energy:20,health:3})]),
event('mentor','老將的置物櫃','一名即將退役的前輩願意教你他的獨門判讀，但條件是每週留下來研究比賽。',[choice('跟著前輩學習','心理 +3、默契 +5，開啟師徒後續。',{a:[0,0,3,0],chemistry:5,flags:{mentor:1}},{chain:'mentor-return',delay:2}),choice('相信自己的打法','技術 +2、體力 +8。',{a:[2,0,0,0],energy:8})],{once:true}),
event('rival','和天才同一屆','同齡對手又登上新聞。他的名字讓你想起第一次輸球的晚上。',[risk('正面挑戰他','成功：聲望 +12、技術 +3；失敗：士氣 -12。',.52,{fame:12,a:[3,0,0,0],flags:{rivalWin:1}},{morale:-12},{stat:0,chain:'rival-rematch',delay:2}),choice('照自己的節奏走','心理 +3、士氣 +8。',{a:[0,0,3,0],morale:8})],{once:true}),
event('pain','身體發出的警訊','熱身時一陣刺痛，你還能活動，但醫療團隊建議今天別逞強。',[choice('接受完整檢查','健康 +12、體力 +15，本季表現 -4。',{health:12,energy:15,form:-4}),risk('調整動作後上場','成功：士氣 +8；惡化：健康 -18、傷病紀錄 +1。',.62,{morale:8},{health:-18,injuries:1,flags:{rehab:1}},{stat:1})],{category:'健康',weight:1.2}),
event('sleep','凌晨的訊息','社群聲量讓你停不下來，明早卻有體能測試。',[choice('關機睡覺','體力 +25、心理 +1。',{energy:25,a:[0,0,1,0]}),risk('回覆球迷到深夜','成功：聲望 +8；失敗：士氣 -6。體力 -15。',.6,{fame:8},{morale:-6},{effect:{energy:-15}})]),
event('captain','誰來說那句話','連敗後更衣室一片安靜。你可以站起來，也可以把話留給隊長。',[risk('召集全隊開會','成功：默契 +12、領導紀錄 +1；失敗：默契 -6。',.64,{chemistry:12,flags:{leader:1}},{chemistry:-6},{stat:2}),choice('先做好自己的工作','防守 +2、心理 +1。',{a:[0,0,1,2]})]),
event('equipment','新裝備的誘惑','廠商送來一套實驗裝備。試用心得很兩極，你願不願意改變習慣？',[risk('整季試用','成功：技術 +3、本季表現 +6；失敗：技術 -2。',.55,{a:[3,0,0,0],form:6},{a:[-2,0,0,0]}),choice('使用熟悉的裝備','本季表現 +2、士氣 +4。',{form:2,morale:4})]),
event('rain','被大雨取消的練習','球場封閉，難得空出一整天。',[choice('室內重訓','體能 +3、體力 -10。',{a:[0,3,0,0],energy:-10}),choice('研究對手影片','心理 +2、防守 +2。',{a:[0,0,2,2]}),choice('回家吃頓飯','士氣 +12、健康 +4、家庭紀錄 +1。',{morale:12,health:4,flags:{family:1}})]),
event('interview','被截走的那句話','採訪的一小段被斷章取義，隊友開始擔心你不信任他們。',[choice('向隊友當面說清楚','默契 +8、士氣 +4。',{chemistry:8,morale:4}),risk('公開接受直播訪問','成功：聲望 +12；失言：聲望 -8、默契 -8。',.58,{fame:12},{fame:-8,chemistry:-8},{stat:2})]),
event('nutrition','營養師的新計畫','球隊希望你改掉熟悉的飲食。適應期可能不好受，長期卻有回報。',[choice('認真執行','健康 +8、體能 +2、士氣 -3。',{health:8,a:[0,2,0,0],morale:-3}),choice('折衷調整','健康 +3、士氣 +3。',{health:3,morale:3})]),
event('slump','怎麼練都不順','動作沒有變，手感卻突然離家出走。教練想聽聽你的打算。',[risk('徹底重修技術','成功：技術 +6；失敗：技術 -3。本季表現 -3。',.5,{a:[6,0,0,0],flags:{reinvent:1}},{a:[-3,0,0,0]},{effect:{form:-3}}),choice('回到基本功','技術 +2、士氣 +6。',{a:[2,0,0,0],morale:6})]),
event('friend','朋友的婚禮','一張婚禮邀請函撞上了非強制集訓。你很久沒見過那群老朋友了。',[choice('參加婚禮','士氣 +15、家庭紀錄 +1、體力 +8。',{morale:15,energy:8,flags:{family:1}}),choice('留在訓練營','體能 +2、技術 +2、士氣 -5。',{a:[2,2,0,0],morale:-5})]),
event('community','孩子們的邀請','家鄉球隊希望你帶一堂課，他們還沒有像樣的訓練器材。',[choice('回去帶隊一天','聲望 +5、士氣 +8、公益紀錄 +1。',{fame:5,morale:8,flags:{charity:1}}),choice('錄下訓練教學','心理 +2、聲望 +3。',{a:[0,0,2,0],fame:3})]),
event('coach-change','新的教練，新的規則','教練團更換，原本最熟悉的戰術突然不再保證你的位子。',[choice('主動學習新體系','防守 +3、默契 +5。',{a:[0,0,0,3],chemistry:5}),risk('用表現爭取自由','成功：本季表現 +10；失敗：本季表現 -10、默契 -6。',.5,{form:10},{form:-10,chemistry:-6},{stat:0})]),
event('pressure','比賽前的失眠','球迷期待越來越重。你發現自己開始害怕犯錯。',[choice('尋求運動心理師協助','士氣 +14、心理 +3。',{morale:14,a:[0,0,3,0]}),risk('把壓力變成燃料','成功：本季表現 +12；失敗：士氣 -15、體力 -8。',.5,{form:12},{morale:-15,energy:-8},{stat:2})]),
event('film','無人注意的細節','分析師找到一個對手的慣性，這次輪到你決定是否採用。',[risk('把這個細節帶上場','成功：本季表現 +9、防守 +2；失敗：本季表現 -3。',.7,{form:9,a:[0,0,0,2]},{form:-3},{stat:2}),choice('維持既定計畫','默契 +4、士氣 +4。',{chemistry:4,morale:4})]),
event('cross-train','跨項目的邀約','另一項運動的教練邀你參加移地訓練，或許能打開新的身體感覺。',[risk('跳出舒適圈','成功：體能 +4、防守 +2；拉傷：健康 -10。',.68,{a:[0,4,0,2]},{health:-10},{effect:{energy:-8}}),choice('專精自己的項目','技術 +2、體力 +5。',{a:[2,0,0,0],energy:5})]),
event('fan-letter','一封手寫的信','一位球迷說，你在逆風中的樣子讓他重新開始練球。',[choice('親筆回信','士氣 +10、聲望 +3。',{morale:10,fame:3}),choice('邀他參加公益訓練','公益紀錄 +1、默契 +3、體力 -5。',{flags:{charity:1},chemistry:3,energy:-5})]),
event('y-scholarship','教練桌上的獎學金','外縣市名校給了你名額；留下來，你會是這支球隊的核心。',[choice('接受名校訓練','技術 +4、體能 +2、士氣 -5。',{a:[4,2,0,0],morale:-5}),choice('留下帶領校隊','心理 +4、默契 +10、領導紀錄 +1。',{a:[0,0,4,0],chemistry:10,flags:{leader:1}})],{maxAge:18,once:true,category:'校園'}),
event('y-scout','球探坐在看台上','今天一名球探穿著素色外套進場。你知道他在看，但不能只想到自己。',[risk('打出招牌表現','成功：聲望 +14、球探紀錄 +1；失敗：士氣 -8。',.46,{fame:14,flags:{scouted:1}},{morale:-8},{stat:0}),choice('把團隊戰術做好','默契 +8、防守 +2。',{chemistry:8,a:[0,0,0,2]})],{maxAge:18,category:'校園'}),
event('y-academics','期末考與決賽週','老師願意幫你補課，但你需要重新安排練習時間。',[choice('把課業補上','心理 +3、士氣 +6。',{a:[0,0,3,0],morale:6}),risk('全心投入決賽','成功：本季表現 +12；失敗：士氣 -10。',.6,{form:12},{morale:-10},{effect:{energy:-8}})],{maxAge:18,category:'校園'}),
event('y-growth','突然長高的一個夏天','身體比例變了，原來自然的動作反而不協調。',[choice('重建動作節奏','體能 +4、技術 -1，後續有機會突破。',{a:[-1,4,0,0],flags:{growth:1}},{chain:'growth-payoff',delay:1}),choice('優先穩定當下表現','技術 +2、防守 +1。',{a:[2,0,0,1]})],{maxAge:18,once:true,category:'校園'}),
event('y-final','校園決賽的最後一幕','主力累得喘不過氣，教練看向板凳上的你。',[risk('站出來接下任務','成功：本季表現 +15、聲望 +10；失敗：士氣 -12。',.5,{form:15,fame:10,flags:{clutch:1}},{morale:-12},{stat:2}),choice('讓熟悉戰術的學長處理','默契 +8、心理 +2。',{chemistry:8,a:[0,0,2,0]})],{maxAge:18,category:'校園'}),
event('y-family','家人第一次坐滿看台','遠道而來的家人把你小時候的照片帶到現場，你笑得有點緊張。',[choice('把這一場獻給他們','士氣 +12、家庭紀錄 +1、本季表現 +3。',{morale:12,form:3,flags:{family:1}}),choice('請他們先別告訴媒體','心理 +3、默契 +3。',{a:[0,0,3,0],chemistry:3})],{maxAge:18,category:'校園'}),
event('y-camp','海外夏令營名單','一個短期交流名額落到你手上。費用有補助，但語言和環境全都陌生。',[risk('出國挑戰','成功：技術 +5、海外紀錄 +1；適應不良：士氣 -8。',.65,{a:[5,0,0,0],flags:{international:1}},{morale:-8},{stat:2}),choice('留在校隊加練','體能 +2、防守 +2。',{a:[0,2,0,2]})],{maxAge:18,once:true,category:'校園'}),
event('y-underdog','落選的那份名單','校際明星名單上沒有你。隊友問你要不要一起去看那場比賽。',[choice('去現場學習','心理 +4、逆境紀錄 +1。',{a:[0,0,4,0],flags:{underdog:1}}),risk('把不甘心帶進訓練','成功：技術 +5；失敗：健康 -8。體力 -12。',.6,{a:[5,0,0,0]},{health:-8},{effect:{energy:-12}})],{maxAge:18,once:true,category:'校園'}),
event('p-agent','經紀人的承諾','經紀人說，換一個談判方向，你的市場可能完全不同。',[risk('押注下一份大約','成功：市場倍率 +25%；失敗：聲望 -8。',.55,{market:.25,flags:{business:1}},{fame:-8},{stat:2,chain:'agent-call',delay:1}),choice('優先確保出賽','默契 +6、本季表現 +5。',{chemistry:6,form:5})],{minAge:19,category:'職業'}),
event('p-transfer','轉會傳聞滿天飛','新聞說你即將離隊，但球隊還沒有正式通知。',[choice('要求經紀人啟動談判','本季結束開啟合約市場，士氣 -4。',{flags:{wantTransfer:1},morale:-4}),choice('公開表態留隊','默契 +10、忠誠紀錄 +1。',{chemistry:10,flags:{loyal:1}})],{minAge:19,category:'職業'}),
event('p-sponsor','第一支個人廣告','一個品牌邀請你拍廣告，拍攝日就在休息日。',[choice('接受代言','收入 +500 萬、聲望 +8、體力 -15。',{money:500,fame:8,energy:-15,flags:{business:1}}),choice('把休息留給身體','健康 +7、體力 +20。',{health:7,energy:20})],{minAge:19,minFame:25,category:'商業'}),
event('p-bench','被換下先發的那一天','新秀的狀態正好，教練希望你從板凳提供火力。',[choice('接受新的責任','默契 +10、防守 +2、團隊紀錄 +1。',{chemistry:10,a:[0,0,0,2],flags:{teamFirst:1}}),risk('用表現搶回先發','成功：本季表現 +12；失敗：默契 -10、士氣 -8。',.54,{form:12},{chemistry:-10,morale:-8},{stat:0})],{minAge:19,category:'職業'}),
event('p-national','國家隊的電話','代表隊教練詢問你是否願意加入短期集訓，球團則擔心疲勞。',[risk('披上國家隊戰袍','成功：聲望 +20、國際榮譽 +1；失利：士氣 -6。體力 -20。',.54,{fame:20,flags:{national:1}},{morale:-6},{effect:{energy:-20},stat:0,chain:'national-final',delay:2}),choice('專注球團賽季','健康 +7、體力 +15、默契 +5。',{health:7,energy:15,chemistry:5})],{minAge:19,minOvr:62,category:'國際賽',weight:.8}),
event('p-trade','球隊宣布重建','主力接連離開，留下的人需要承擔更多。管理層想知道你的選擇。',[choice('留下陪球隊重建','領導紀錄 +1、忠誠紀錄 +1、士氣 -5。',{flags:{leader:1,loyal:1,rebuild:1},morale:-5},{chain:'rebuild-result',delay:2}),choice('要求更有競爭力的舞台','本季結束開啟合約市場、聲望 +4。',{flags:{wantTransfer:1},fame:4})],{minAge:20,once:true,category:'職業'}),
event('p-invest','朋友的創業邀請','朋友想用你的知名度開運動品牌。這是一筆沒有保證的投入。',[risk('投入 800 萬','成功：回收 2,400 萬；失敗：投入全數損失。',.4,{money:2400,flags:{business:2}},{morale:-5},{effect:{money:-800},cost:800}),choice('先當顧問，不出資','心理 +2、聲望 +3。',{a:[0,0,2,0],fame:3})],{minAge:19,minMoney:800,category:'商業'}),
event('p-charity','以你名字命名的球場','家鄉想整修一座舊球場，邀你成為計畫的第一個支持者。',[choice('捐出 300 萬並參與','收入 -300 萬、公益紀錄 +2、聲望 +10。',{money:-300,flags:{charity:2},fame:10},{cost:300}),choice('協助宣傳募款','公益紀錄 +1、聲望 +4、體力 -5。',{flags:{charity:1},fame:4,energy:-5})],{minAge:19,minMoney:300,category:'人生'}),
event('p-baby','新的家庭節奏','家中多了需要你陪伴的人。球場很重要，家也同樣重要。',[choice('減少額外活動陪伴家人','家庭紀錄 +2、士氣 +15、本季表現 -3。',{flags:{family:2},morale:15,form:-3}),choice('安排支援，維持訓練','收入 -100 萬、技術 +3、士氣 -4。',{money:-100,a:[3,0,0,0],morale:-4},{cost:100})],{minAge:24,once:true,category:'人生'}),
event('p-hostile','全場的噓聲','客場球迷從熱身就開始噓你，對手正等著你失去耐心。',[risk('把噓聲變成節奏','成功：本季表現 +12、關鍵紀錄 +1；失敗：士氣 -10。',.5,{form:12,flags:{clutch:1}},{morale:-10},{stat:2}),choice('和隊友一起守住節奏','默契 +8、防守 +1。',{chemistry:8,a:[0,0,0,1]})],{minAge:19,category:'比賽'}),
event('p-playoff','季後賽前的抉擇','對手反覆針對你的弱點。教練提出一套從未在正式賽用過的戰術。',[risk('把新戰術帶進大賽','成功：本季表現 +16；失敗：本季表現 -10。',.48,{form:16},{form:-10},{stat:2}),choice('相信成熟的體系','本季表現 +4、默契 +4。',{form:4,chemistry:4})],{minAge:19,category:'比賽'}),
event('p-return','家鄉球迷仍記得你','返鄉比賽的看台舉起你高中時的照片。有人喊著要你回來。',[choice('認真考慮回家','忠誠紀錄 +1、家庭紀錄 +1，開啟合約市場。',{flags:{loyal:1,family:1,wantTransfer:1}}),choice('在外地完成夢想','士氣 +10、心理 +2。',{morale:10,a:[0,0,2,0]})],{minAge:23,minTier:1,category:'人生'}),
event('p-language','更衣室裡的第二種語言','你聽懂戰術，但笑話總慢半拍。融入需要時間。',[choice('請隊友當語言老師','默契 +12、心理 +1。',{chemistry:12,a:[0,0,1,0]}),choice('用球技代替對話','技術 +3、默契 -4。',{a:[3,0,0,0],chemistry:-4})],{minAge:19,minTier:1,category:'海外'}),
event('p-underpay','薪水與表現不成比例','媒體拿你的薪水和同級球星比較。你開始想，自己是不是太好談了。',[risk('強硬爭取議價','成功：市場倍率 +30%；失敗：默契 -8。',.52,{market:.3},{chemistry:-8},{stat:2}),choice('讓成績替你說話','心理 +2、本季表現 +5。',{a:[0,0,2,0],form:5})],{minAge:22,minOvr:65,category:'商業'}),
event('v-young','菜鳥問你能不能留下','一名新秀遇到和你當年相同的問題，他不太敢問教練。',[choice('成為他的導師','傳承紀錄 +1、心理 +3、體力 -6。',{flags:{teaching:1},a:[0,0,3,0],energy:-6},{chain:'student-repay',delay:1}),choice('給建議，維持自己的安排','默契 +5、體力 +5。',{chemistry:5,energy:5})],{minAge:29,category:'生涯後期'}),
event('v-reinvent','速度不再是優勢','錄影不會說謊。你需要一種不用和年輕人拚速度的贏球方式。',[risk('轉型成技巧型球員','成功：技術 +5、心理 +4、轉型紀錄 +1；失敗：技術 -2。',.64,{a:[5,0,4,0],flags:{reinvent:1}},{a:[-2,0,0,0]},{stat:2}),choice('加練體能維持打法','體能 +3、健康 -5、體力 -12。',{a:[0,3,0,0],health:-5,energy:-12})],{minAge:30,category:'生涯後期'}),
event('v-final','再拚一座冠軍','經紀人找到爭冠隊的空缺，但他們需要你犧牲球權與薪水。',[choice('把團隊放在第一位','團隊紀錄 +2、默契 +12、市場倍率 -15%。',{flags:{teamFirst:2},chemistry:12,market:-.15}),choice('維持核心角色','聲望 +6、士氣 +8。',{fame:6,morale:8})],{minAge:31,category:'生涯後期'}),
event('v-body','醫師的長期建議','反覆的小傷讓醫師建議你重新安排負荷，甚至提前想一想退役之後。',[choice('接受保養計畫','健康 +15、體力 +20、本季表現 -5。',{health:15,energy:20,form:-5}),risk('再衝一次巔峰','成功：本季表現 +18；失敗：健康 -22、傷病紀錄 +1。',.42,{form:18},{health:-22,injuries:1},{stat:1})],{minAge:30,category:'健康'}),
event('v-school','一所學校向你招手','學校願意讓你在退休後成立訓練中心，也願意現在就讓你規劃課程。',[choice('開始準備教練人生','傳承紀錄 +2、心理 +3、體力 -8。',{flags:{teaching:2},a:[0,0,3,0],energy:-8}),choice('暫時專注球員生涯','士氣 +8、體力 +10。',{morale:8,energy:10})],{minAge:30,once:true,category:'人生'}),
event('v-last-home','最後一次家鄉巡迴','地方球迷邀你回母校打一場表演賽。你不知道自己還能穿多久的球衣。',[choice('帶著家人一起回去','家庭紀錄 +2、公益紀錄 +1、士氣 +10。',{flags:{family:2,charity:1},morale:10}),choice('將名額讓給新秀','傳承紀錄 +1、默契 +8。',{flags:{teaching:1},chemistry:8})],{minAge:33,category:'生涯後期'}),
event('b-grip','一顆新球種','投手教練把球放在你的手掌裡，要求你試一種陌生的握法。',[risk('開發變化球','成功：技術 +5、防守 +2；失敗：技術 -1、健康 -7。',.57,{a:[5,0,0,2],flags:{signature:1}},{a:[-1,0,0,0],health:-7},{stat:0}),choice('磨練既有球路','技術 +2、心理 +1。',{a:[2,0,1,0]})],{sport:0,positions:['投手','二刀流'],category:'棒球'}),
event('b-swing','打擊姿勢重建','打擊教練認為你的揮棒有更大的可能，但改姿勢會經歷一段低潮。',[risk('重建揮棒軌跡','成功：技術 +6；失敗：本季表現 -8。',.55,{a:[6,0,0,0],flags:{signature:1}},{form:-8}),choice('只微調站位','技術 +2、本季表現 +2。',{a:[2,0,0,0],form:2})],{sport:0,excludePositions:['投手'],category:'棒球'}),
event('b-dual','二刀流的兩份課表','投打兩邊都需要時間。教練問你，是否要為另一半天賦繼續付出代價。',[risk('維持二刀流','成功：技術 +4、防守 +4、雙修紀錄 +1；失敗：健康 -12。體力 -15。',.58,{a:[4,0,0,4],flags:{dual:1}},{health:-12},{effect:{energy:-15},stat:1}),choice('本季著重體能與恢復','體能 +2、健康 +8、體力 +10。',{a:[0,2,0,0],health:8,energy:10})],{sport:0,positions:['二刀流'],category:'棒球',weight:1.5}),
event('b-nine','第九局的信任','教練在最後關頭把你叫到身邊：這個局面，交給你。',[risk('承擔勝負的最後一球','成功：本季表現 +14、關鍵紀錄 +1；失敗：士氣 -10。',.5,{form:14,flags:{clutch:1}},{morale:-10},{stat:2}),choice('配合守備與跑壘戰術','默契 +8、防守 +2。',{chemistry:8,a:[0,0,0,2]})],{sport:0,category:'棒球'}),
event('b-catcher','搭檔之間的暗號','捕手認為對手已經看穿你的習慣，今晚他想和你一起重新研究配球。',[choice('一起研究到最後','防守 +3、默契 +7、體力 -10。',{a:[0,0,0,3],chemistry:7,energy:-10}),choice('相信場上直覺','心理 +2、體力 +8。',{a:[0,0,2,0],energy:8})],{sport:0,category:'棒球'}),
event('b-record','紀錄就在眼前','距離一項個人紀錄只差一點。對手已經開始刻意避開你。',[risk('主動追逐紀錄','成功：聲望 +18、紀錄 +1；失敗：本季表現 -6。',.4,{fame:18,flags:{record:1}},{form:-6},{stat:0}),choice('讓球隊需求優先','默契 +10、團隊紀錄 +1。',{chemistry:10,flags:{teamFirst:1}})],{sport:0,minOvr:65,category:'棒球'}),
event('f-freekick','定位球的順位','隊友提議讓你主罰定位球，教練希望你先在練習證明。',[risk('爭取主罰權','成功：技術 +4、本季表現 +8；失敗：默契 -5。',.57,{a:[4,0,0,0],form:8,flags:{signature:1}},{chemistry:-5},{stat:0}),choice('專注原本位置','防守 +3、默契 +4。',{a:[0,0,0,3],chemistry:4})],{sport:1,excludePositions:['門將'],category:'足球'}),
event('f-derby','德比戰前夜','整座城市都在談這場比賽。教練要求大家保持冷靜，球迷要的卻是激情。',[risk('用侵略性帶動全隊','成功：本季表現 +13；失敗：健康 -8、默契 -6。',.52,{form:13,flags:{clutch:1}},{health:-8,chemistry:-6},{stat:2}),choice('維持紀律與陣形','防守 +2、默契 +8。',{a:[0,0,0,2],chemistry:8})],{sport:1,category:'足球'}),
event('f-system','三中衛，還是四後衛','新的戰術需要你離開熟悉的活動區域。',[choice('成為戰術多面手','防守 +3、心理 +2、轉型紀錄 +1。',{a:[0,0,2,3],flags:{reinvent:1}}),risk('爭取進攻自由','成功：技術 +4、本季表現 +7；失敗：默契 -7。',.52,{a:[4,0,0,0],form:7},{chemistry:-7},{stat:0})],{sport:1,category:'足球'}),
event('f-penalty','十二碼前的安靜','教練把決勝十二碼的研究交給你。你有機會成為全場記住的人。',[risk('承擔關鍵任務','成功：聲望 +12、關鍵紀錄 +1；失敗：士氣 -12。',.55,{fame:12,flags:{clutch:1}},{morale:-12},{stat:2}),choice('和隊友分享分析','心理 +2、默契 +8。',{a:[0,0,2,0],chemistry:8})],{sport:1,category:'足球'}),
event('f-keeper','門將的出擊範圍','教練希望你把防線推得更前面。離開禁區，風險和價值一起增加。',[risk('嘗試清道夫門將','成功：防守 +5、技術 +2；失敗：本季表現 -8。',.56,{a:[2,0,0,5],flags:{signature:1}},{form:-8},{stat:3}),choice('專注門線反應','防守 +3、體能 +1。',{a:[0,1,0,3]})],{sport:1,positions:['門將'],category:'足球',weight:1.5}),
event('f-golden','射手榜的最後衝刺','媒體開始每天追蹤你的數字。對手把更多人放在你的周圍。',[risk('挑戰聯賽紀錄','成功：聲望 +20、紀錄 +1；失敗：體力 -12。',.38,{fame:20,flags:{record:1}},{energy:-12},{stat:0}),choice('吸引防守，成就隊友','默契 +12、團隊紀錄 +1。',{chemistry:12,flags:{teamFirst:1}})],{sport:1,positions:['前鋒','中場'],minOvr:65,category:'足球'}),
event('k-range','把射程再拉遠一步','訓練師建議你練新的出手點，但比賽中的命中率不會立刻回來。',[risk('開發遠距離武器','成功：技術 +5、本季表現 +6；失敗：本季表現 -6。',.56,{a:[5,0,0,0],form:6,flags:{signature:1}},{form:-6},{stat:0}),choice('磨練穩定的得分區','技術 +2、心理 +1。',{a:[2,0,1,0]})],{sport:2,category:'籃球'}),
event('k-buzzer','最後一擊的戰術板','暫停時，教練把戰術板轉向你。最後一球可以自己來，也可以相信隊友。',[risk('由我處理最後一球','成功：聲望 +14、關鍵紀錄 +1；失敗：士氣 -10。',.48,{fame:14,flags:{clutch:1}},{morale:-10},{stat:2}),choice('吸引包夾後傳球','默契 +10、防守 +1、團隊紀錄 +1。',{chemistry:10,a:[0,0,0,1],flags:{teamFirst:1}})],{sport:2,category:'籃球'}),
event('k-weight','增重還是保持速度','重訓團隊提出增肌計畫，你擔心腳步會變慢。',[risk('執行增肌計畫','成功：體能 +4、防守 +3；失敗：健康 -8。',.65,{a:[0,4,0,3]},{health:-8},{effect:{energy:-10}}),choice('維持靈活度','體能 +2、技術 +1。',{a:[1,2,0,0]})],{sport:2,category:'籃球'}),
event('k-switch','被要求換防所有位置','教練想讓你成為最可靠的防守開關，但每個位置都有不同功課。',[choice('接受防守任務','防守 +4、默契 +6、體力 -10。',{a:[0,0,0,4],chemistry:6,energy:-10}),risk('爭取更多持球機會','成功：技術 +4；失敗：默契 -8。',.55,{a:[4,0,0,0]},{chemistry:-8},{stat:0})],{sport:2,category:'籃球'}),
event('k-sixth','第六人的火力','球隊希望你帶領第二陣容，這不一定有最多鏡頭，卻可能贏得比賽。',[choice('成為替補領袖','團隊紀錄 +2、領導紀錄 +1、默契 +8。',{flags:{teamFirst:2,leader:1},chemistry:8}),risk('證明自己值得先發','成功：本季表現 +11；失敗：士氣 -8。',.5,{form:11},{morale:-8},{stat:0})],{sport:2,minAge:19,category:'籃球'}),
event('k-record','手感燙得不可思議','今晚你似乎怎麼投都會進，隊友開始問要不要繼續把球交給你。',[risk('挑戰個人得分紀錄','成功：聲望 +20、紀錄 +1；失敗：體力 -15。',.4,{fame:20,flags:{record:1}},{energy:-15},{stat:0}),choice('把好狀態分享給全隊','默契 +12、本季表現 +4。',{chemistry:12,form:4})],{sport:2,minOvr:65,category:'籃球'}),

// Expansion: rare encounters, position-specific moments, and branching arcs.
event('x-walkon','名單以外的名字','公開測試名單沒有你，但場邊教練願意給你最後一個自我推薦的機會。',[risk('爭取最後一次測試','成功：技術 +3、聲望 +8；失敗：士氣 -8。兩種結果會走向不同後續。',.43,{a:[3,0,0,0],fame:8},{morale:-8},{stat:0,chainSuccess:'x-walkon-pass',chainFailure:'x-walkon-retry',delay:1}),choice('先從基礎重新準備','體能 +3、心理 +3、逆境紀錄 +1。',{a:[0,3,3,0],flags:{underdog:1}})],{minAge:17,maxAge:23,maxOvr:65,once:true,rarity:'rare',category:'逆襲起點'}),
event('x-schoolbus','凌晨五點的校車','出發比賽前，學弟忘了帶裝備。全隊只剩十分鐘可以處理。',[choice('幫學弟借齊裝備','默契 +8、領導紀錄 +1、體力 -5。',{chemistry:8,flags:{leader:1},energy:-5}),choice('讓他自己解決，先專注比賽','心理 +2、體力 +5。',{a:[0,0,2,0],energy:5})],{maxAge:18,category:'校園'}),
event('x-viral-school','被轉傳的練習影片','一段同學拍的影片突然被大量轉傳。大家開始期待你真的像影片裡那麼強。',[risk('公開挑戰更高難度','成功：聲望 +12、技術 +2；失敗：士氣 -10。',.5,{fame:12,a:[2,0,0,0]},{morale:-10},{stat:0}),choice('請同學記錄完整訓練','心理 +2、聲望 +4、士氣 +4。',{a:[0,0,2,0],fame:4,morale:4})],{maxAge:18,category:'校園'}),
event('x-youth-academy','兩所學校，同一天考試','一邊是訓練資源豐富的名校，一邊願意給你穩定的比賽機會。你只能赴一個約。',[risk('挑戰名校測試','成功：技術 +5、球探紀錄 +1；失敗：士氣 -6。',.48,{a:[5,0,0,0],flags:{scouted:1}},{morale:-6},{stat:0}),choice('選能持續上場的環境','默契 +8、心理 +3。',{chemistry:8,a:[0,0,3,0]})],{maxAge:18,once:true,category:'校園'}),
event('x-youth-rival','那個對手成了隊友','交流賽把你和曾經最想擊敗的人分在同一隊。他伸手等你擊掌。',[choice('一起研究彼此的優勢','默契 +10、技術 +2。',{chemistry:10,a:[2,0,0,0]}),risk('比一比誰更能帶隊','成功：聲望 +8、領導紀錄 +1；失敗：默契 -8。',.5,{fame:8,flags:{leader:1}},{chemistry:-8},{stat:2})],{maxAge:18,category:'校園'}),
event('x-school-captain','隊長選舉前一天','學長即將畢業，有人把你的名字寫進了隊長候選名單。',[risk('主動爭取隊長','成功：領導紀錄 +2、默契 +8；失敗：士氣 -5。',.56,{flags:{leader:2},chemistry:8},{morale:-5},{stat:2}),choice('支持更適合的隊友','團隊紀錄 +1、防守 +2、默契 +5。',{flags:{teamFirst:1},a:[0,0,0,2],chemistry:5})],{maxAge:18,once:true,category:'校園'}),
event('x-rescue','降級區的求救聲','球隊陷入保級危機。隊友希望你擔任這段艱難時期的主心骨。',[choice('承擔保級任務','領導紀錄 +1、默契 +10、士氣 -5，開啟保級後續。',{flags:{leader:1},chemistry:10,morale:-5},{chain:'x-rescue-finish',delay:1}),choice('先穩住自己的表現','技術 +3、心理 +2。',{a:[3,0,2,0]})],{sport:1,minAge:20,once:true,rarity:'rare',category:'球隊命運'}),
event('x-reunion','老搭檔的訊息','曾陪你熬過低潮的搭檔又有機會與你一起訓練。當年未完成的默契，還有下文嗎？',[choice('重建兩人的招牌配合','默契 +10、體力 -8，開啟重逢後續。',{chemistry:10,energy:-8},{chain:'x-reunion-finish',delay:1}),choice('讓年輕人加入新組合','傳承紀錄 +1、防守 +3。',{flags:{teaching:1},a:[0,0,0,3]})],{minAge:23,once:true,category:'重逢'}),
event('x-documentary','鏡頭進入更衣室','紀錄片團隊想拍下你的一整年，包括失敗、復健和那些沒人看見的早晨。',[choice('讓鏡頭記錄真實的自己','聲望 +6、士氣 -4，開啟紀錄片後續。',{fame:6,morale:-4},{chain:'x-film-premiere',delay:2}),choice('保留私人空間','士氣 +12、心理 +2。',{morale:12,a:[0,0,2,0]})],{minAge:22,minFame:60,once:true,rarity:'rare',category:'人生紀錄'}),
event('x-sport-lab','運動實驗室的邀請','研究團隊希望用新的動作追蹤方式分析你的訓練，成果需要一段時間才能看見。',[choice('成為第一批合作球員','技術 +2、體力 -8，開啟研究後續。',{a:[2,0,0,0],energy:-8},{chain:'x-lab-result',delay:1}),choice('先把數據交給教練研究','心理 +3、防守 +1。',{a:[0,0,3,1]})],{minAge:19,once:true,rarity:'rare',category:'技術探索'}),
event('x-union','球員代表的空缺','隊友希望有人替年輕球員爭取合理的休息與訓練環境，他們推舉了你。',[choice('接受球員代表提名','領導紀錄 +1、體力 -8，開啟協商後續。',{flags:{leader:1},energy:-8},{chain:'x-union-vote',delay:1}),choice('支援代表蒐集意見','默契 +8、心理 +2。',{chemistry:8,a:[0,0,2,0]})],{minAge:26,once:true,category:'球員權益'}),
event('x-island','小島上的友誼賽','沒有巨大的看台，只有一座靠海的球場。當地孩子用手畫了歡迎你的海報。',[choice('留下來多教一天','公益紀錄 +1、傳承紀錄 +1、士氣 +10。',{flags:{charity:1,teaching:1},morale:10}),choice('打完比賽回去備戰','默契 +4、體力 +12。',{chemistry:4,energy:12})],{minAge:19,category:'場外人生'}),
event('x-failed-brand','品牌合作突然喊停','原本談好的合作夥伴臨時撤出，幾個月的心力可能白費。',[risk('自行接下計畫','成功：收入 +1,000 萬、商業紀錄 +1；失敗：損失 400 萬。',.42,{money:1000,flags:{business:1}},{money:-400},{cost:400,stat:2}),choice('接受終止，回到訓練','士氣 -4、技術 +3。',{morale:-4,a:[3,0,0,0]})],{minAge:21,minMoney:400,requiresFlag:'business',category:'商業轉折'}),
event('x-short-deal','短約的賭注','經紀人問你，下一次談判要不要用更短的保障換取更大的市場機會。',[risk('爭取高報酬條件','成功：市場倍率 +20%；失敗：市場倍率 -10%。',.5,{market:.2},{market:-.1},{stat:2}),choice('以穩定為優先','士氣 +10、默契 +4。',{morale:10,chemistry:4})],{minAge:23,category:'合約談判'}),
event('x-young-analyst','菜鳥分析師的報告','剛到職的分析師發現一個所有人都忽略的數據。資深教練還不太相信他。',[risk('用練習驗證他的想法','成功：心理 +3、本季表現 +8；失敗：體力 -10。',.65,{a:[0,0,3,0],form:8},{energy:-10},{stat:2}),choice('先請教練一起討論','默契 +6、防守 +2。',{chemistry:6,a:[0,0,0,2]})],{minAge:19,category:'團隊日常'}),
event('x-market-cold','市場突然安靜','幾支球隊縮減預算，經紀人的電話比往年少。你得在這個冬天留住競爭力。',[choice('提早安排測試與訓練','技術 +3、體力 -12、心理 +1。',{a:[3,0,1,0],energy:-12}),choice('重新評估生活步調','士氣 +12、健康 +5、家庭紀錄 +1。',{morale:12,health:5,flags:{family:1}})],{minAge:26,rarity:'rare',category:'職業逆風'}),
event('x-farewell','告別賽的提案','球團願意為你安排一場特別的主題賽。你還在打球，但已能聽見另一段人生的腳步。',[choice('接受這份心意','士氣 +8、家庭紀錄 +1，開啟告別主題賽後續。',{morale:8,flags:{family:1}},{chain:'x-farewell-moment',delay:1}),choice('現在只想專注下一季','心理 +3、體能 +2。',{a:[0,2,3,0]})],{minAge:32,once:true,category:'生涯後期'}),
event('x-old-letter','置物櫃最底層的信','搬球具時，你找到十六歲寫給自己的信。裡面的夢想，有些完成了，有些換了樣子。',[choice('把信念留給下一個新秀','傳承紀錄 +1、心理 +3、士氣 +6。',{flags:{teaching:1},a:[0,0,3,0],morale:6}),choice('帶回家和家人一起讀','家庭紀錄 +2、士氣 +12。',{flags:{family:2},morale:12})],{minAge:30,once:true,category:'人生回望'}),
event('x-home-camp','家鄉的夏季訓練營','母校空出一片場地，希望你來決定這裡未來會成為什麼。',[choice('成立免費少年訓練營','收入 -500 萬、公益紀錄 +2、傳承紀錄 +1。',{money:-500,flags:{charity:2,teaching:1}},{cost:500}),choice('建立球員交流日','公益紀錄 +1、領導紀錄 +1、體力 -8。',{flags:{charity:1,leader:1},energy:-8})],{minAge:28,minMoney:500,once:true,category:'下一段人生'}),
event('x-book','一本沒有寫完的自傳','出版社邀你談談那些沒成為頭條的賽季。你發現最難寫的是對自己的誠實。',[choice('坦白寫下低潮與失敗','士氣 +8、聲望 +8、心理 +2。',{morale:8,fame:8,a:[0,0,2,0]}),choice('把故事改成訓練教材','傳承紀錄 +2、心理 +3。',{flags:{teaching:2},a:[0,0,3,0]})],{minAge:31,once:true,category:'下一段人生'}),
event('x-b-perfect','誰都不敢提起的紀錄','比賽尾聲，對手還沒有人上壘。隊友開始刻意不和你說話，教練走向投手丘。',[risk('挑戰完全比賽','成功：完全比賽紀錄 +1、聲望 +25；失手：士氣 -8。體力 -15。',.27,{flags:{perfect:1},fame:25},{morale:-8},{effect:{energy:-15},stat:0}),choice('以健康和球隊勝利優先','健康 +8、團隊紀錄 +1、默契 +8。',{health:8,flags:{teamFirst:1},chemistry:8})],{sport:0,positions:['投手','二刀流'],minAge:19,minOvr:65,once:true,rarity:'rare',category:'棒球奇蹟'}),
event('x-b-steal','捕手起身以前','跑壘教練發現對手投手的抬腿節奏固定。現在是你用雙腿改變戰局的機會。',[risk('挑戰關鍵盜壘','成功：速度紀錄 +1、本季表現 +8；失敗：本季表現 -4。',.58,{flags:{speedster:1},form:8},{form:-4},{stat:1}),choice('等待隊友把球打出去','默契 +6、體力 +5。',{chemistry:6,energy:5})],{sport:0,excludePositions:['投手'],category:'棒球跑壘'}),
event('x-b-catcher','捕手的第二本筆記','你把對手的習慣記滿了一本又一本。教練想把配球決定交給你主導。',[risk('主導整場配球','成功：戰術紀錄 +1、防守 +4；失敗：士氣 -6。',.61,{flags:{architect:1},a:[0,0,0,4]},{morale:-6},{stat:2}),choice('和投手一起逐球討論','默契 +9、防守 +2。',{chemistry:9,a:[0,0,0,2]})],{sport:0,positions:['捕手'],category:'棒球守備'}),
event('x-b-glove','界外線旁的一躍','球飛向觀眾席邊緣。你看見了落點，也看見了護欄。',[risk('判斷落點完成美技','成功：金手套紀錄 +1、聲望 +8；失敗：健康 -9。',.57,{flags:{glove:1},fame:8},{health:-9},{stat:3}),choice('保護身體，阻止多進壘','防守 +2、健康 +4。',{a:[0,0,0,2],health:4})],{sport:0,positions:['內野手','外野手','二刀流'],category:'棒球守備'}),
event('x-b-bullpen','牛棚的最後一盞燈','教練想讓你在高壓局面接手。熱身的時間很短，心理準備得更快。',[risk('接下後援重任','成功：關鍵紀錄 +1、防守 +3；失敗：本季表現 -5。',.56,{flags:{clutch:1},a:[0,0,0,3]},{form:-5},{stat:2}),choice('以既定投球節奏備戰','技術 +2、健康 +4。',{a:[2,0,0,0],health:4})],{sport:0,positions:['投手','二刀流'],minAge:19,category:'棒球投手'}),
event('x-b-minors','低潮中的調整賽','教練安排你在壓力較小的比賽調整，觀眾不多，每一球卻都很重要。',[choice('把這裡當成重建起點','技術 +3、心理 +3、逆境紀錄 +1。',{a:[3,0,3,0],flags:{underdog:1}}),risk('用表現證明不需要調整','成功：本季表現 +10；失敗：士氣 -10。',.48,{form:10},{morale:-10},{stat:0})],{sport:0,minAge:19,maxOvr:70,category:'棒球逆風'}),
event('x-f-wall','禁區前的最後一道牆','對手把主攻方向放到你的防區。教練希望你能守住最後的空間。',[risk('承擔封鎖任務','成功：鐵壁紀錄 +1、防守 +4；失敗：本季表現 -5。',.59,{flags:{wall:1},a:[0,0,0,4]},{form:-5},{stat:3}),choice('縮小防線，與隊友協防','默契 +9、防守 +2。',{chemistry:9,a:[0,0,0,2]})],{sport:1,positions:['後衛','門將'],category:'足球防線'}),
event('x-f-conductor','中場的節拍器','教練讓你決定進攻速度。放慢，或是一腳把比賽推向前場？',[risk('掌握全隊節奏','成功：戰術紀錄 +1、心理 +3；失敗：默契 -6。',.61,{flags:{architect:1},a:[0,0,3,0]},{chemistry:-6},{stat:2}),choice('讓球更快離開腳下','技術 +2、默契 +6。',{a:[2,0,0,0],chemistry:6})],{sport:1,positions:['中場'],category:'足球中場'}),
event('x-f-shootout','門線上的十二碼大戰','射手從中圈走過來。你看過他的影片，但這次他會不會改變方向？',[risk('相信研究結果做出撲救','成功：鐵壁紀錄 +1、關鍵紀錄 +1；失敗：士氣 -8。',.45,{flags:{wall:1,clutch:1}},{morale:-8},{stat:3}),choice('專注自己的反應','防守 +3、心理 +2。',{a:[0,0,2,3]})],{sport:1,positions:['門將'],category:'足球門將'}),
event('x-f-space','一條沒有人看見的傳球路線','對手的防線往你這邊傾斜，另一側的隊友開始跑向空檔。',[risk('送出決定性的傳球','成功：戰術紀錄 +1、本季表現 +7；失敗：本季表現 -3。',.56,{flags:{architect:1},form:7},{form:-3},{stat:0}),choice('穩住控球重新組織','默契 +7、心理 +2。',{chemistry:7,a:[0,0,2,0]})],{sport:1,positions:['前鋒','中場'],category:'足球進攻'}),
event('x-f-continental','洲際舞台的決勝夜','你第一次感覺，今晚的看台遠比城市還大。這場淘汰賽是你在洲際賽場留下名字的機會。',[risk('挑戰洲際賽關鍵表現','成功：洲際紀錄 +1、聲望 +24；失敗：士氣 -10。體力 -12。',.4,{flags:{continental:1},fame:24},{morale:-10},{effect:{energy:-12},stat:2}),choice('以團隊紀律完成任務','團隊紀錄 +1、防守 +3、默契 +6。',{flags:{teamFirst:1},a:[0,0,0,3],chemistry:6})],{sport:1,minAge:20,minTier:1,minOvr:65,once:true,rarity:'rare',category:'洲際賽'}),
event('x-k-lockdown','守住對面的頭號得分手','對方球星連續得分，教練在暫停時指著他的名字，再看向你。',[risk('接下單防任務','成功：鐵壁紀錄 +1、防守 +4；失敗：體力 -12。',.55,{flags:{wall:1},a:[0,0,0,4]},{energy:-12},{stat:3}),choice('安排協防輪轉','默契 +9、心理 +2。',{chemistry:9,a:[0,0,2,0]})],{sport:2,category:'籃球防守'}),
event('x-k-triple','離大三元還差一點','數據台上三項數字都接近雙位數。隊友知道你想做什麼，但時間不多。',[risk('挑戰全能大三元','成功：大三元紀錄 +1、聲望 +10；失敗：本季表現 -4。',.48,{flags:{tripleDouble:1},fame:10},{form:-4},{stat:0}),choice('讓比賽自然發展','團隊紀錄 +1、默契 +8。',{flags:{teamFirst:1},chemistry:8})],{sport:2,minOvr:62,category:'籃球紀錄'}),
event('x-k-air','灌籃大賽的最後一跳','你準備了一個從沒在鏡頭前做過的動作，安全版本也足以讓觀眾歡呼。',[risk('挑戰最高難度','成功：天空紀錄 +1、聲望 +20；失敗：健康 -10。',.4,{flags:{skyKing:1},fame:20},{health:-10},{stat:1}),choice('完成最熟練的動作','聲望 +6、士氣 +6。',{fame:6,morale:6})],{sport:2,minAge:19,maxAge:30,minOvr:60,once:true,rarity:'rare',category:'全明星週末'}),
event('x-k-floor','場上的第二個教練','連續幾次進攻不順，教練把臨場調度交給你，球員們等著你叫出戰術。',[risk('接管場上指揮','成功：戰術紀錄 +1、領導紀錄 +1；失敗：默契 -7。',.6,{flags:{architect:1,leader:1}},{chemistry:-7},{stat:2}),choice('簡化戰術找回節奏','心理 +2、默契 +7。',{a:[0,0,2,0],chemistry:7})],{sport:2,positions:['控球後衛','得分後衛','小前鋒'],category:'籃球戰術'}),
event('x-k-sweep','連勝之後的隱患','球隊連續贏球，訓練氣氛開始鬆懈。你知道下一個對手正在等機會。',[choice('提醒隊友保持紀律','領導紀錄 +1、默契 +8、心理 +2。',{flags:{leader:1},chemistry:8,a:[0,0,2,0]}),risk('乘著氣勢繼續衝','成功：本季表現 +14；失敗：士氣 -8、體力 -8。',.54,{form:14},{morale:-8,energy:-8},{stat:2})],{sport:2,minAge:19,category:'籃球連勝'}),
event('x-walkon-pass','從候補到被看見','上次測試的表現換來了認真的邀請。球探說，你不是名單上的預定人選，但現在值得一個機會。',[choice('用這次機會證明自己','逆襲紀錄 +1、技術 +4、聲望 +12。',{flags:{walkon:1},a:[4,0,0,0],fame:12}),choice('先補足弱點再出發','防守 +4、心理 +3、逆境紀錄 +1。',{a:[0,0,3,4],flags:{underdog:1}})],{chainOnly:true,once:true,category:'落選逆襲・入選篇'}),
event('x-walkon-retry','第二次敲門','第一次測試失敗後，你收到了那位教練的訊息：如果還沒放棄，就再來一次。',[risk('再挑戰一次','成功：技術 +3、聲望 +8，開啟入選後續；失敗：士氣 -6。',.62,{a:[3,0,0,0],fame:8},{morale:-6},{stat:0,chainSuccess:'x-walkon-pass',delay:1}),choice('用另一種方式累積實力','心理 +4、體能 +3、逆境紀錄 +2。',{a:[0,3,4,0],flags:{underdog:2}})],{chainOnly:true,once:true,category:'落選逆襲・再起篇'}),
event('x-rescue-finish','留在這個聯賽','從低潮開始的努力到了最後關頭，隊友相信你能帶領大家完成保級任務。',[risk('帶隊撐過決戰','成功：保級英雄紀錄 +1、聲望 +20；失敗：士氣 -12。',.57,{flags:{savior:1},fame:20},{morale:-12},{stat:2}),choice('以團隊意志完成最後一戰','領導紀錄 +2、默契 +12。',{flags:{leader:2},chemistry:12})],{chainOnly:true,once:true,category:'保級後續'}),
event('x-reunion-finish','默契再次連上線','你和老搭檔終於找回熟悉的節奏。這次合作成了年輕隊友每天想學的東西。',[choice('把重逢寫成新的代表作','重逢紀錄 +1、技術 +3、默契 +12。',{flags:{reunion:1},a:[3,0,0,0],chemistry:12}),choice('把配合完整傳給下一代','傳承紀錄 +3、心理 +3。',{flags:{teaching:3},a:[0,0,3,0]})],{chainOnly:true,once:true,category:'重逢後續'}),
event('x-film-premiere','首映夜的掌聲','銀幕上的你沒有永遠贏球，卻始終在失敗後回到球場。片尾亮起，觀眾慢慢站起來。',[choice('把作品獻給所有努力的人','紀錄片紀錄 +1、聲望 +20、士氣 +10。',{flags:{documentary:1},fame:20,morale:10}),choice('將收益投入基層訓練','公益紀錄 +3、傳承紀錄 +1、聲望 +8。',{flags:{charity:3,teaching:1},fame:8})],{chainOnly:true,once:true,category:'紀錄片後續'}),
event('x-lab-result','一份改變訓練的報告','研究團隊找到更適合你的動作模式。你可以先自己使用，也可以讓其他球員一起試。',[risk('率先採用全新方法','成功：創新紀錄 +1、技術 +6；失敗：技術 -2、士氣 -5。',.68,{flags:{innovator:1},a:[6,0,0,0]},{a:[-2,0,0,0],morale:-5},{stat:2}),choice('把方法交給全隊共同研究','傳承紀錄 +2、默契 +10。',{flags:{teaching:2},chemistry:10})],{chainOnly:true,once:true,category:'研究後續'}),
event('x-union-vote','協商桌上的一票','長時間蒐集的意見終於被放進正式提案。你要替隊友把最後一段話說完。',[risk('代表球員完成協商','成功：球員代表紀錄 +1、領導紀錄 +2；失敗：士氣 -8。',.66,{flags:{unionVoice:1,leader:2}},{morale:-8},{stat:2}),choice('交棒給更有經驗的代表','默契 +12、心理 +3。',{chemistry:12,a:[0,0,3,0]})],{chainOnly:true,once:true,category:'協商後續'}),
event('x-farewell-moment','為你亮起的全場燈光','主題賽那天，看台坐著家人、老隊友與一路支持你的球迷。大家希望你留下最後一個難忘畫面。',[risk('為他們完成招牌表現','成功：告別高光紀錄 +1、聲望 +20；失敗：士氣 -4。',.63,{flags:{farewell:1},fame:20},{morale:-4},{stat:2}),choice('和每一位隊友一起謝幕','家庭紀錄 +2、傳承紀錄 +2、士氣 +15。',{flags:{family:2,teaching:2},morale:15})],{chainOnly:true,once:true,category:'告別主題賽後續'}),

// Choice-driven follow-ups only enter the pool after their originating decision.
event('mentor-return','那位前輩回來了','兩年前你留下來學的那一晚，他一直記得。現在他帶著更高層級的訓練機會回來。',[choice('再跟他學一次','技術 +5、心理 +3、師徒紀錄 +1。',{a:[5,0,3,0],flags:{mentor:1}}),choice('請他也指導年輕隊友','傳承紀錄 +2、默契 +12。',{flags:{teaching:2},chemistry:12})],{chainOnly:true,category:'師徒後續',once:true}),
event('rival-rematch','宿敵的重逢','熟悉的對手再次站在你面前。這一次，你們都不再是當年的孩子。',[risk('用自己的招牌決勝','成功：聲望 +20、宿敵勝利 +1；失敗：士氣 -10。',.53,{fame:20,flags:{rivalWin:1}},{morale:-10},{stat:0}),choice('承認對手，也相信團隊','心理 +4、默契 +10。',{a:[0,0,4,0],chemistry:10})],{chainOnly:true,category:'宿敵後續',once:true}),
event('growth-payoff','終於跟上了身體','那個不協調的夏天過去了，你第一次感覺身體完全聽話。',[choice('把新天賦用在進攻','技術 +5、體能 +3。',{a:[5,3,0,0]}),choice('把新天賦用在防守','防守 +5、體能 +3。',{a:[0,3,0,5]})],{chainOnly:true,category:'成長後續',once:true}),
event('agent-call','經紀人兌現承諾？','上次談判之後，市場終於有了回音。更大的舞台也意味著更大的不確定。',[risk('接受市場的考驗','成功：市場倍率 +25%、聲望 +10；失敗：士氣 -8。開啟合約市場。',.6,{market:.25,fame:10},{morale:-8},{effect:{flags:{wantTransfer:1}},stat:2}),choice('把籌碼換成穩定','默契 +10、忠誠紀錄 +1。',{chemistry:10,flags:{loyal:1}})],{chainOnly:true,category:'合約後續',once:true}),
event('national-final','為國家拚的那一場','代表隊再度徵召。你熟悉這件球衣的重量，這次的對手更強。',[risk('承擔決賽核心','成功：國際英雄紀錄 +1、聲望 +30；失敗：士氣 -12。體力 -18。',.42,{flags:{nationalHero:1},fame:30},{morale:-12},{effect:{energy:-18},stat:2}),choice('用經驗支援新秀','傳承紀錄 +1、國際榮譽 +1、默契 +10。',{flags:{teaching:1,national:1},chemistry:10})],{chainOnly:true,category:'國際賽後續',once:true}),
event('rebuild-result','重建之後的第一束光','你選擇留下的那年，球隊最難熬。如今新秀終於長大，管理層把承諾放上桌面。',[choice('繼續帶領這群人','本季表現 +12、默契 +15、忠誠紀錄 +2。',{form:12,chemistry:15,flags:{loyal:2}}),choice('帶著成果尋找新挑戰','聲望 +15、市場倍率 +15%，開啟合約市場。',{fame:15,market:.15,flags:{wantTransfer:1}})],{chainOnly:true,category:'重建後續',once:true}),
event('student-repay','輪到他扶你一把','你曾經指導的新秀站穩腳步，在你低潮的這週主動留下來陪練。',[choice('接受他的幫忙','士氣 +18、健康 +5、傳承紀錄 +1。',{morale:18,health:5,flags:{teaching:1}}),choice('一起設計新的戰術','心理 +4、本季表現 +7。',{a:[0,0,4,0],form:7})],{chainOnly:true,category:'傳承後續',once:true}),
event('rehab-return','復健室的倒數','漫長復健後，醫療團隊終於給你重返賽場的選擇。你比任何人都想回去。',[choice('完整復健後再出發','健康 +16、體力 +18、復出紀錄 +1、本季表現 -3。',{health:16,energy:18,flags:{comeback:1},form:-3}),risk('提前接受實戰測試','成功：健康 +8、本季表現 +12、復出紀錄 +1；失敗：健康 -14。',.5,{health:8,form:12,flags:{comeback:1}},{health:-14},{stat:1})],{chainOnly:true,category:'傷病後續'}),
event('legacy-extra','舊教練的特別訓練','教練留下來陪你修正動作，這是上一段生涯安排的延續。',[choice('接受特訓','技術 +4、體力 -15。',{a:[4,0,0,0],energy:-15}),choice('休息恢復','體力 +15。',{energy:15})],{chainOnly:true,category:'延續中的事件'}),
event('legacy-media','已排定的球迷活動','上次存檔時，你還沒決定是否出席這場活動。',[choice('參加活動','聲望 +5、體力 -10。',{fame:5,energy:-10}),choice('專注心理訓練','心理 +3。',{a:[0,0,3,0]})],{chainOnly:true,category:'延續中的事件'})
];
const ENDINGS=[
['dynasty','王朝締造者','至少 5 座職業冠軍','你把冠軍從偶然變成習慣，球迷用你的名字稱呼一整個時代。'],
['national','國家英雄','完成國際賽決賽支線','那件國家隊球衣留下了你的名字。球場之外，仍有人記得你為誰而戰。'],
['immortal','不朽名人堂','傳奇分數達 88','數據、榮譽與漫長的影響力，在退休那天匯成全場起立的掌聲。'],
['two-way','二刀流傳說','棒球二刀流、雙修紀錄 3、巔峰 76','你拒絕只讓一半天賦上場。投與打都寫下了只屬於你的答案。'],
['record','紀錄粉碎者','完成至少 2 次紀錄挑戰','人們打開紀錄簿，就會遇到你的名字。後來者知道那道標竿有多高。'],
['phoenix','浴火重生','重大傷病後復出並奪冠或拿下個人獎','曾經沒人確定你能否回來，最後的歡呼卻比第一次登場更響亮。'],
['one-club','一城一生','同隊效力 12 季且職業隊不超過 2 支','城市換了天際線，你的球衣卻始終在同一面看台飄揚。'],
['late','大器晚成','31 歲後刷新巔峰且能力達 76','當別人開始倒數，你才剛找到最好的自己。遲來的光，依然耀眼。'],
['comeback','不倒的鬥士','至少 3 次傷病並完成復出','傷痕沒有替你寫下句點，你每一次重返球場都讓觀眾重新相信。'],
['clutch','關鍵先生','至少 4 次關鍵表現','比賽最安靜、壓力最大的時刻，隊友習慣把最後的信任交給你。'],
['captain','更衣室靈魂','領導紀錄 5 且默契至少 70','你的價值不只在記分板。隊友記得你在最難的夜晚說過的話。'],
['teacher','傳承之火','傳承紀錄達 5','退休沒有讓你的影響力停下。下一代穿上球衣時，帶著你教過的東西。'],
['giver','球場外的光','公益紀錄達 5','獎盃會蒙塵，那些因你而打開的球場卻每天都有新的腳步。'],
['mogul','運動商業帝國','商業紀錄 3 且生涯收入 5 萬','你把球場上的名聲變成下一段事業，退役只是換了一個主場。'],
['nomad','世界浪人','效力至少 4 支職業球隊','不同語言、不同城市、不同看台，拼成了一本厚厚的球衣收藏。'],
['sixth','冠軍拼圖','團隊紀錄 5 且至少 1 座職業冠軍','你願意為勝利改變角色。最後舉起獎盃的那一刻，所有犧牲都有重量。'],
['family','回家的人','家庭紀錄 5，34 歲前自主退休','你在仍能奔跑的時候選擇回家。這次，把最好的時間留給最重要的人。'],
['injury','未完成的天賦','因傷結束生涯','你沒能走到原本想像的終點，但那些燃燒過的瞬間仍留在看台記憶裡。'],
['burnout','找回自己','因長期低潮決定離開','當掌聲不再能填滿心裡的位置，你選擇停下來，重新學習喜歡生活。'],
['crownless','無冕之王','巔峰至少 83、職業 10 季、沒有職業冠軍','你的能力毋庸置疑，只是命運始終把最後一座獎盃留在一球之外。'],
['meteor','流星天才','30 歲前退休且巔峰至少 75','你的巔峰很短，卻亮得讓人無法忘記。每次回放，都像第一次看見。'],
['star','時代明星','巔峰至少 80 或個人獎至少 3','一個世代的球迷在談起這項運動時，總會自然地提到你的名字。'],
['veteran','不老戰將','至少打到 40 歲','新秀一批批進場，你還在用經驗證明，年齡不是唯一的時鐘。'],
['grinder','職人之路','完成至少 12 個職業賽季','你靠穩定、紀律與每天不缺席的努力，換來一段值得驕傲的職業人生。'],

['walkon','落選逆襲','完成候補測試支線且巔峰至少 72','你的名字曾經不在名單上，後來卻成為別人不能忽略的存在。'],
['savior','保級救世主','完成保級決戰支線','那一年沒有冠軍遊行，但整座城市都記得，是誰把希望留在這個聯賽。'],
['reunion','重逢的答案','完成老搭檔重逢支線','隔著幾年的距離，你們再次找到同一個節奏。這一次，故事終於有了新的下文。'],
['documentary','銀幕裡的傳奇','完成紀錄片首映支線','球鞋收進櫃子以後，你真實的起伏仍留在銀幕裡，陪著下一個想放棄的人。'],
['innovator','球場革新者','成功採用實驗室新方法','你留下的不只有成績，還有一種被後來者沿用的訓練方式。'],
['union','球員的聲音','完成球員代表協商支線','你替沒有話語權的人說話。當制度往前走了一步，隊友知道你的努力沒有白費。'],
['farewell','最好的謝幕','完成告別主題賽的高光表現','最後留在大家眼裡的，是你最熟悉的招牌動作，和全場為你亮起的燈。'],
['perfect','完全比賽之夜','棒球投手或二刀流完成完全比賽挑戰','那一夜，所有打者都依序回到休息區。球場安靜了一秒，然後記住你一輩子。'],
['speedster','壘間疾風','棒球速度紀錄達 3','對手只要看見你站上壘包，就得重新計算時間。你的雙腿把一壘之差變成整段傳奇。'],
['glove','金色手套','棒球金手套紀錄達 3','許多本來應該落地的球，最後都停在你手套裡。投手知道，身後有你。'],
['architect','戰術建築師','戰術紀錄達 3','你先看見空間、節奏與下一步，才讓隊友看見得分的路。'],
['continental','洲際之星','足球完成洲際賽關鍵挑戰','跨越城市與國界，你在更大的看台前留下了無法被忽略的表現。'],
['triple-double','全能製造機','籃球大三元紀錄達 3','得分、籃板、助攻都需要你。你讓全面不再只是形容詞，而是每晚的工作。'],
['sky-king','天空之王','籃球完成高難度灌籃挑戰','起跳之後的幾秒，你把引力留在地面，把整座球場的呼吸帶到空中。'],
['wall','禁區鐵壁','足球或籃球鐵壁紀錄達 3','對手反覆尋找突破口，隊友卻早已放心。你站在那裡，就是一道答案。'],
['dreamer','逐夢旅人','完成一段屬於自己的生涯','你走進過球場，也為自己的夢用力跑過。這段人生的價值，不只是一張成績單。']
].map(([id,title,hint,text])=>({id,title,hint,text}));
const TRAITS=[{id:'steady',name:'穩定成長',desc:'狀態波動較小，成長平穩。'},{id:'prodigy',name:'早熟天才',desc:'起步較快，巔峰也可能較早。'},{id:'late',name:'晚成潛力',desc:'前期較慢，27 歲後訓練成長加快。'},{id:'wild',name:'爆發型天賦',desc:'可能大爆發，也可能陷入低潮。'},{id:'iron',name:'鋼鐵意志',desc:'身體較耐戰，傷病風險較低。'},{id:'fragile',name:'玻璃天才',desc:'天花板較高，身體需要更仔細照顧。'}];
const SPORTS=[{name:'棒球',icon:'⚾',key:'baseball',pos:['投手','捕手','內野手','外野手','二刀流'],desc:'一球，改寫命運。',teams:['台北雷霆','台中野火','大阪烈風','釜山海潮','洛城星辰','紐約鐵騎']},{name:'足球',icon:'⚽',key:'football',pos:['前鋒','中場','後衛','門將'],desc:'從青訓到世界之巔。',teams:['台北競技','高雄港灣','里斯本之光','阿姆斯特丹新月','馬德里王者','曼徹斯特北星']},{name:'籃球',icon:'🏀',key:'basketball',pos:['控球後衛','得分後衛','小前鋒','大前鋒','中鋒'],desc:'下一個時代，由你開場。',teams:['台北獵鷹','高雄海神星','東京火焰','首爾黑豹','紐約帝國','洛城日蝕']}];
const expansion=typeof module!=='undefined'?require('./expansion.js'):root.XZExpansion;
EVENTS.push(...expansion.events);ENDINGS.push(...expansion.endings);
const choiceExpansion=typeof module!=='undefined'?require('./choices.js'):root.XZChoices;choiceExpansion.enrich(EVENTS);
// First-time goal stories replace a random seasonal story; they do not add a mandatory turn.
EVENTS.push(
event('chapter-growth','影片裡的那個破綻','分析師把同一段畫面倒回三次：你的習慣，已經被對手看穿。改動作可能突破，也可能失去原有節奏。',[
 risk('拆掉重練','挑戰新動作；成功技術 +4，失敗士氣 -4。體力 -10。',.63,{a:[4,0,0,0],flags:{chapterCraft:1}},{morale:-4},{effect:{energy:-10},stat:0,chainSuccess:'chapter-return',delay:1}),
 choice('只改一個細節','技術 +1、心理 +1，保留熟悉的節奏。',{a:[1,0,1,0],energy:-5}),
 choice('邀請隊友一起研究','心理 +2、默契 +6，體力 -8。',{a:[0,0,2,0],chemistry:6,energy:-8}),
 choice('先把狀態養回來','健康 +5、心情 +7，這次不改動作。',{health:5,mood:7})
],{category:'突破專題',once:true,weight:2}),
event('chapter-trust','名單公布的前一天','教練沒有承諾位置，只問你：如果下一場需要你做一件不顯眼的事，你願意嗎？',[
 choice('接下最需要的角色','默契 +8、心理 +2，士氣 -2。',{chemistry:8,a:[0,0,2,0],morale:-2,flags:{teamFirst:1}}),
 risk('用加練爭取機會','成功技術 +3、聲望 +8；失敗心情 -6。體力 -12。',.65,{a:[3,0,0,0],fame:8},{mood:-6},{effect:{energy:-12},stat:0}),
 choice('請教練給明確回饋','心理 +2、心情 +3，開始建立長期溝通。',{a:[0,0,2,0],mood:3,flags:{leader:1}}),
 choice('陪替補隊友一起準備','默契 +10、士氣 +3，體力 -6。',{chemistry:10,morale:3,energy:-6})
],{category:'更衣室對話',once:true,weight:2}),
event('chapter-contend','對手留下的一句話','上一輪的對手在訪問中說，你們只是運氣好。群組已經炸開，下一場之前，你要怎麼回應？',[
 risk('把回應留在球場上','成功本季表現 +8、聲望 +10；失敗士氣 -5。體力 -8。',.6,{form:8,fame:10},{morale:-5},{effect:{energy:-8},stat:2}),
 choice('帶大家研究對方弱點','心理 +2、默契 +5，體力 -8。',{a:[0,0,2,0],chemistry:5,energy:-8}),
 choice('替隊友擋下媒體提問','默契 +8、聲望 +3，心情 -4。',{chemistry:8,fame:3,mood:-4,flags:{leader:1}}),
 choice('關掉手機，照常休養','體力 +16、心情 +6，不參與口水戰。',{energy:16,mood:6})
],{category:'宿敵戰帖',once:true,weight:2}),
event('chapter-balance','難得沒有鬧鐘的早晨','今天沒有強制集合。你看著排滿行程的日曆，第一次認真想：下一個高峰，或許需要從休息開始。',[
 choice('安排完整恢復日','健康 +8、體力 +18，沒有額外能力成長。',{health:8,energy:18}),
 choice('和家人好好吃頓飯','心情 +12、士氣 +4，留下生活的空間。',{mood:12,morale:4,flags:{family:1}}),
 choice('和隊友散步聊聊','心情 +7、默契 +6、體力 +8。',{mood:7,chemistry:6,energy:8}),
 risk('用低強度練習找手感','成功心理 +3、心情 +8；失敗體力 -8。',.78,{a:[0,0,3,0],mood:8},{energy:-8},{stat:2})
],{category:'生活片刻',once:true,weight:2}),
event('chapter-return','改動作之後的第一封信','去年一起研究動作的分析師傳來訊息：改變開始有成果了。這份經驗，要留給自己，還是傳給下一個卡關的人？',[
 choice('整理成球隊筆記','心理 +2、默契 +8，留下傳承。',{a:[0,0,2,0],chemistry:8,flags:{teaching:1}}),
 risk('繼續挑戰更高難度','成功技術 +4、聲望 +12；失敗健康 -4。體力 -10。',.65,{a:[4,0,0,0],fame:12},{health:-4},{effect:{energy:-10},stat:0}),
 choice('拍一支訓練紀錄','聲望 +10、心情 +5，讓努力被看見。',{fame:10,mood:5}),
 choice('把時間留給恢復','健康 +6、體力 +16，下一次再挑戰。',{health:6,energy:16})
],{category:'一年後的回聲',chainOnly:true,once:true})
);
const storytelling=typeof module!=='undefined'?require('./storytelling.js'):root.XZStorytelling;storytelling.enrich(EVENTS);
const family=typeof module!=='undefined'?require('./family.js'):root.XZFamily;EVENTS.push(...family.EVENTS.map(e=>({...e,options:e.options.map(c=>({...c,effect:{...c.effect}}))})));
const romance=typeof module!=='undefined'?require('./romance.js'):root.XZRomance;EVENTS.push(...romance.EVENTS.map(e=>({...e,options:e.options.map(c=>({...c,effect:{...c.effect}}))})));
const leagues=typeof module!=='undefined'?require('./leagues.js'):root.XZLeagues;EVENTS.push(...leagues.EVENTS);
// Balance negative condition costs once, alongside the actual displayed event data.
for(const e of EVENTS)for(const c of e.options){for(const key of ['effect','good','bad'])if(c[key]){c[key]={...c[key]};if(c[key].health<0)c[key].health=-Math.ceil(-c[key].health*1.6);if(c[key].morale<0)c[key].morale=-Math.ceil(-c[key].morale*1.75)}c.hint=c.hint.replace(/(健康|士氣)(\s*[-−]\s*)(\d+)/g,(_,label,sep,n)=>label+sep+Math.ceil(+n*(label==='健康'?1.6:1.75)))}
const COUNTS=Object.freeze({events:EVENTS.filter(e=>!e.chainOnly).length,sequels:EVENTS.filter(e=>e.chainOnly&&!e.id.startsWith('legacy-')).length,endings:ENDINGS.length});
const data={EVENTS,ENDINGS,TRAITS,SPORTS,COUNTS,ROUTE_NAMES:expansion.routeNames,GROUPS:expansion.groups};if(typeof module!=='undefined')module.exports=data;else root.XZContent=data;
})(typeof globalThis!=='undefined'?globalThis:this);
