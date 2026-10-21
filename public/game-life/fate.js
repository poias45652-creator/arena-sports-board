/* Original fictional life circumstances. Draw only during actions, never during rendering or loading. */
(function(root){
'use strict';
const BACKGROUNDS=[
 {id:'night-shift',name:'夜班家庭的孩子',text:'家人下班時，你正要出門練球。冰箱上的便條，總比看台上的掌聲早一步陪著你。',effect:{a:[0,0,3,0],money:8,energy:-5,mood:6,morale:3}},
 {id:'community',name:'被整條街養大的球員',text:'球具來自鄰居，球場是大家一起整理的。你帶著許多人的期待出發，也習慣把好消息先說給他們聽。',effect:{a:[0,0,0,3],money:15,chemistry:9,mood:5,morale:4}},
 {id:'boarding',name:'提早離家的寄宿生',text:'你很早就學會自己洗球衣、獨自搭車。宿舍床頭貼著一張合照，想家的時候，會把它重新壓平。',effect:{a:[0,3,2,0],money:20,energy:-4,mood:-8,morale:6}},
 {id:'resources',name:'有完整訓練資源的孩子',text:'從小有教練、有器材，也有人替你安排好下一站。走進職業球場後，第一次沒人能替你保證結果。',effect:{a:[4,0,0,0],money:90,health:3,mood:2,morale:-5}},
 {id:'late-start',name:'很晚才被看見的天分',text:'你曾借著場邊的燈練到熄燈。被叫去試訓那天，家人還以為你只是又要出門打球。',effect:{a:[-2,2,4,0],money:5,energy:-3,mood:7,morale:7}},
 {id:'moving',name:'行李箱裡長大的孩子',text:'搬過幾次家，球衣卻一直留著。你不怕陌生的更衣室，只是偶爾也想有人記得你最早的樣子。',effect:{a:[0,2,0,2],money:25,chemistry:5,mood:-5,morale:3}},
 {id:'injury-return',name:'帶著舊傷重新出發',text:'年少時曾停下一段時間。那張復健進度表還留在抽屜裡，提醒你：能再走進球場，已經走過很遠。',effect:{a:[0,-2,4,0],money:20,health:-9,mood:4,morale:6}},
 {id:'siblings',name:'和手足共用一雙夢想',text:'你們輪著用球具，也輪著替對方撿球。輪到你先踏上職業舞台時，家裡的人只叮嚀記得報平安。',effect:{a:[2,0,0,1],money:12,chemistry:7,mood:6,morale:2}},
 {id:'heritage',name:'從上一代的球衣裡長大',text:'你認得家人的掌聲，也聽過低潮時的沉默。這次穿上的背號，會留下屬於你自己的故事。',effect:{a:[1,0,2,0],money:30,chemistry:5,mood:5,morale:3}}
];
// id, title, narrative, effect, tone, context (optional), rarity weight (optional)
const rows=[
 ['coach-leaves','教練的位置突然空了','早上進休息室時，白板已經擦乾淨。教練因家事離隊，沒來得及完成的計畫留給了你們；今晚的訓練，忽然沒有熟悉的聲音。',{morale:-13,chemistry:-8,mood:-8},-1],
 ['new-coach','新教練，記住了你的名字','你以為自己只是替補名單上的一行字。新教練卻在第一次集合時叫住你，說他看過那些沒被剪進精華的努力。',{morale:14,chemistry:8,mood:9},1],
 ['storm','風雨把熟悉的球場關上','場館因風雨受損，訓練臨時搬到更遠的地方。沒有人選擇這場雨，你只能和隊友提早出門，把日子重新排好。',{energy:-14,health:-5,chemistry:5,mood:-7},-1],
 ['forced-rest','行程取消，多出一個下午','交通中斷讓球隊取消了原訂活動。你難得在天還亮著時回到住處，吃完一頓熱飯，睡了沒有鬧鐘的一覺。',{energy:18,health:5,mood:9},1],
 ['flu','不是不努力，是身體突然病了','醒來時你知道今天不對勁。隊醫讓你暫停練習、安排照護；進度表還在牆上，身體卻需要先被照顧。',{energy:-18,health:-15,morale:-5,mood:-6},-1],
 ['slip','那一下，來得毫無預警','離開球場時踩到濕滑地面，你扭了一下腳。檢查後需要休養，沒做錯什麼，行程卻突然全得改寫。',{health:-20,energy:-9,injuries:1,mood:-10},-1],
 ['quiet-recovery','身體，比預期早一步回應','連日的不適終於緩了下來。今天熱身時，那個一直卡住的動作順了；防護員點點頭，你才發現自己已經好久沒笑得這麼輕。',{health:11,energy:10,mood:8},1],
 ['sponsor-draw','一封沒有預期的贊助信','地方品牌在一群新秀中選中了你。不是最大的合約，卻剛好讓你不用再為下一副器材算得那麼緊。',{money:45,mood:10,morale:7},1],
 ['lost-bag','行李轉盤停下來，你的袋子沒出現','常用球具和幾件有紀念意義的衣服都在裡面。球隊借來備用品，你在旅館補辦手續，原本要休息的晚上就這樣過了。',{money:-20,energy:-10,mood:-12},-1],
 ['viral-praise','那段沒想過會紅的影片','有人拍下你替小球迷撿球的樣子。隔天醒來，多了許多陌生人的鼓勵；你把手機遞給家人，還有點不敢相信。',{fame:12,mood:14,morale:6},1],
 ['viral-cut','被剪掉前後文的十秒鐘','一段剪輯讓你成了討論焦點。你知道事情原本不是那樣，但流言傳得比完整說明更快，休息時也很難不去想。',{mood:-18,morale:-10,chemistry:-4},-1],
 ['old-letter','寄錯時間，卻剛好抵達的信','以前的啟蒙教練整理抽屜，寄來你少年時寫的目標。那時的字歪歪斜斜，卻讓今天的你重新想起為什麼站在這裡。',{mood:15,morale:10,a:[0,0,2,0]},1],
 ['roommate','室友先一步離隊了','回到住處時，隔壁床已經空了。你們約好以後要一起站上更大的舞台，卻沒想到這一站先剩下自己。',{mood:-13,chemistry:-7,morale:-6},-1],
 ['unexpected-friend','有人記得你不吃什麼','陌生的隊友替你多留了一份晚餐。那不是什麼大事，你卻在那一刻覺得，這個地方也許可以慢慢像家。',{mood:12,chemistry:10,energy:5},1],
 ['family-work','家裡說，最近工作不太順','電話那頭刻意說得很輕，你還是聽出了停頓。家裡的收入少了一截，你開始更在意每一筆花費，也更難在練球時完全放空。',{money:-30,mood:-14,morale:-5},-1],
 ['family-relief','家裡終於傳來好消息','一直讓家人掛心的事有了著落。你讀完訊息，在空蕩的走道站了一會兒；那口氣，原來自己也憋了很久。',{mood:17,morale:7,energy:6},1],
 ['rent','房東的通知，夾在比賽行程裡','住處需要整修，你得在短時間內搬家。球場上的成績沒變，生活卻突然多了一堆箱子和帳單。',{money:-25,energy:-12,mood:-8},-1],
 ['grant','一筆差點沒領到的補助','球隊行政替你追到了符合資格的訓練補助。通知很短，你卻看了好幾遍：原來有人在看不見的地方替你把事情做好。',{money:30,morale:8,mood:10},1],
 ['schedule','連著轉車的那一週','賽程臨時調整，旅途變得比原先更長。你在車窗倒影裡看見疲倦的自己，抵達時，天已經快亮了。',{energy:-18,health:-6,mood:-5},-1],
 ['breakthrough','睡醒以後，那個動作接上了','反覆卡住的細節忽然變得清楚。你沒有突然多做什麼，只是長久累積的練習，在某個普通早晨一起找到了出口。',{a:[6,2,4,2],mood:16,morale:12},1,null,.22],
 ['plateau','熟悉的節奏，突然找不回來','昨天還做得到的動作，今天怎麼試都差一點。教練說有時就是會遇到這種階段；你不喜歡這個答案，卻還是得先接受現在的自己。',{a:[-4,0,-2,0],mood:-12,morale:-12},-1],
 ['senior-retires','沒有預告的告別','前輩在練習後宣布退休。你還沒學完的細節、還沒問出口的問題，都突然有了期限；離開前，他把筆記留在你的櫃子裡。',{a:[0,0,3,2],mood:-8,morale:5},0],
 ['sleep','一整夜，怎麼也睡不著','窗外的施工聲響了一夜。你試過換枕頭、關手機，卻還是在鬧鐘響起前就盯著天花板，知道今天得帶著疲倦出門。',{energy:-15,health:-4,mood:-8},-1],
 ['scout-seat','看台最後一排，坐著陌生球探','原本要看別人的球探，順手記下了你的名字。還沒有合約，也沒有保證，但你的表現第一次走進了另一份評估名單。',{fame:8,morale:11,mood:7},1],
 ['base-catcher','今天接球的人，忽然懂了你','新搭檔沒有多說什麼，只調整了接球的節奏。你發現對方能看懂自己的猶豫，那幾顆球投出去時，心裡安定了不少。',{a:[2,0,2,0],chemistry:11,morale:6},1,'base-pitch'],
 ['base-bat','借來的球棒，意外合手','常用球棒送修，你只好借用備用品。沒想到重量分配剛好打開了新的感覺，幾次紮實擊球讓打擊教練也停下腳步。',{a:[4,1,0,0],mood:10,morale:7},1,'base-bat'],
 ['base-position','隊友回歸，輪替順序變了','傷癒歸隊的隊友回到了原本的位置。這不是你的失誤，但你必須重新適應等待；有人拍拍你的肩，說準備不能因此停下。',{morale:-15,mood:-9,chemistry:-3},-1,'base'],
 ['foot-partner','跑位第一次被另一個人讀懂','新隊友的傳球落在你下一步將到的位置。那不是白板上的計畫，只是兩個人在某一刻忽然懂了彼此。',{a:[2,0,2,0],chemistry:12,morale:8},1,'foot'],
 ['foot-system','新的體系，暫時沒有你的位置','球隊臨時更換戰術重心，你熟悉的跑動路線不再被需要。這不代表你不夠好，卻代表那些習慣得先重新整理。',{a:[-2,0,0,0],chemistry:-12,morale:-13,mood:-8},-1,'foot'],
 ['foot-analysis','分析師發現了一個你沒看過的空間','原本只是例行看片，分析師卻指出你一直忽略的那一格空間。下一次上場前，你腦中的球場似乎變寬了一些。',{a:[2,0,4,0],morale:8,mood:6},1,'foot'],
 ['basket-shot','那天，籃框像是聽懂了你','平常最彆扭的出手突然變順。你沒有把它當成永遠的保證，只把那個節奏記在心裡，盼著下一次還認得出來。',{a:[5,0,1,0],morale:10,mood:11},1,'basket'],
 ['basket-trade','熟悉的傳球手，被交易了','消息傳來時，你還留著明天一起加練的約定。球隊做了自己的決定，你們只能先把告別說完，再練習適應新的節奏。',{chemistry:-13,mood:-12,morale:-7},-1,'basket'],
 ['basket-growth','對抗時，身體忽然撐得住了','日復一日的力量課終於在對抗中有了回聲。你站穩腳步，抬頭時看見訓練師笑了一下，什麼都沒再解釋。',{a:[0,5,0,2],health:4,morale:9},1,'basket'],
 ['partner-away','她的工作，突然去了另一座城市','她收到了一直等待的機會，目的地卻離你很遠。你替她高興，也在通話結束後默默看了一眼原本約好的行程。',{mood:-10,energy:-5,chemistry:-4},0,'partner'],
 ['partner-surprise','觀眾席上，多了一個熟悉的身影','你以為她今天忙得走不開，抬頭卻看見那個熟悉的笑。她沒替你贏下任何一場球，卻讓你知道自己不是一個人。',{mood:18,morale:10},1,'partner'],
 ['child-drawing','孩子把你的背號畫反了','訊息裡是一張蠟筆畫，背號畫反、球也不像球。孩子卻很認真地說，那就是最喜歡的你；你看著看著，忽然不那麼在意今天的評語。',{mood:20,morale:7,energy:5},1,'child']
];
const EVENTS=rows.map(([id,title,text,effect,tone,context,weight=1])=>({id:'fate-'+id,title,text,effect:{mood:0,...effect},tone,context,weight}));
const hash=t=>{let h=2166136261;for(const c of t)h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0};
function init(s,ctx,heir=false){const b=heir?BACKGROUNDS.at(-1):BACKGROUNDS[hash(s.seed+'|'+s.sport+'|upbringing')%(BACKGROUNDS.length-1)];const applied=ctx.apply(s,b.effect);s.fate={v:1,background:b.id,start:applied,history:[]};ctx.log(s,'無法選擇的起點：'+b.name+'。'+b.text)}
function eligible(s,e){if(s.fate?.history.some(h=>h.id===e.id))return false;const c=e.context;return !c||c==='base'&&s.sport===0||c==='base-pitch'&&s.sport===0&&['投手','二刀流'].includes(s.pos)||c==='base-bat'&&s.sport===0&&s.pos!=='投手'||c==='foot'&&s.sport===1||c==='basket'&&s.sport===2||c==='partner'&&['dating','married','parent'].includes(s.family?.stage)&&s.romance?.bond!=='separated'||c==='child'&&!!s.family?.child}
function resolve(s,e,ctx,effectsText){
 if(s.retired||s.eventsLeft<1||!eligible(s,e)||s.fate?.history.some(h=>h.age===s.age))return false;
 if(!s.fate)s.fate={v:1,background:null,start:null,history:[]};
 const scale=ctx.int(s,8,14)/10,effect={...e.effect};for(const k of ['energy','health','morale','mood','chemistry','money','fame'])if(Number.isFinite(effect[k]))effect[k]=Math.round(effect[k]*scale);if(effect.a)effect.a=effect.a.map(n=>Math.round(n*scale));
 const applied=ctx.apply(s,effect),detail=effectsText(applied)||'生活改變了方向，你仍繼續往前。';
 s.fate.history.push({id:e.id,age:s.age,detail});s.visits[e.id]=1;s.careerEvents++;s.eventsLeft=Math.max(0,s.eventsLeft-1);s.event=null;
 s.outcome={title:e.title,choice:'事情已經發生',success:e.tone>0,random:false,unchosen:true,fateId:e.id,tone:e.tone,grade:'命運遭遇',roll:null,detail,narrative:e.text,chain:'',age:s.age};s.phase='outcome';ctx.log(s,'命運遭遇｜'+e.title+'：'+detail);return true;
}
function encounter(s,ctx,effectsText){if(s.retired||s.eventsLeft<1)return false;if(s.fate?.history.some(h=>h.age===s.age)||ctx.random(s)>=.38)return false;const pool=EVENTS.filter(e=>eligible(s,e));if(!pool.length)return false;let n=ctx.random(s)*pool.reduce((v,e)=>v+e.weight,0);const selected=pool.find(e=>(n-=e.weight)<0)||pool.at(-1);return resolve(s,selected,ctx,effectsText)}
function validate(s){if(s.fate===undefined)return;const f=s.fate,fail=()=>{throw Error('命運紀錄格式不正確')};if(!f||f.v!==1||f.background!==null&&!BACKGROUNDS.some(b=>b.id===f.background)||!Array.isArray(f.history)||f.history.length>EVENTS.length)fail();if(f.background===null?f.start!==null:!f.start||!Array.isArray(f.start.a)||f.start.a.length!==4||!f.start.a.every(Number.isFinite))fail();if(f.start&&Object.entries(f.start).some(([k,v])=>!['a','flags'].includes(k)&&!Number.isFinite(v)))fail();const ids=new Set(),ages=new Set();for(const h of f.history){if(!h||!EVENTS.some(e=>e.id===h.id)||!Number.isInteger(h.age)||h.age<16||h.age>s.age||typeof h.detail!=='string'||h.detail.length>1000||ids.has(h.id)||ages.has(h.age))fail();ids.add(h.id);ages.add(h.age)}if(s.outcome?.unchosen&&(!f.history.some(h=>h.id===s.outcome.fateId&&h.age===s.outcome.age)||![-1,0,1].includes(s.outcome.tone)))fail()}
const api={BACKGROUNDS,EVENTS,init,eligible,resolve,encounter,validate};if(typeof module!=='undefined')module.exports=api;else root.XZFate=api;
})(globalThis);
