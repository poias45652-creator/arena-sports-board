/* Relationship episodes use existing annual story slots and preserve family history. */
(function(root){
'use strict';
const L=typeof module!=='undefined'?require('./family.js'):root.XZFamily;
const esc=t=>String(t??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const opt=(label,mood,resultText,bond='together',next=null)=>({label,hint:`心情 ${mood>0?'+':''}${mood}${bond==='separated'?' · 結束伴侶關係':bond==='strained'?' · 信任出現裂痕':''}${next?' · 下一季還有後續':''}`,effect:{mood},resultText,romanceAction:{bond,next}});
const episode=(id,title,place,line,text,options,extra={})=>({id:'romance-'+id,title,category:'感情風暴 · 愛與選擇',chainOnly:true,once:!extra.followup,minAge:19,scene:{place,voice:'以晴',line},text,options,...extra});
const EVENTS=[
 episode('betrayed','凌晨兩點，那句「我想你」不是傳給你的','客場旅館 · 一通坦白的電話','不是你想太多。是我沒有守住我們的約定。','你以為只是客場太遠。直到以晴親口承認，她和另一個人越過了界線。剛剛還在慶祝勝利的你，坐在床沿，突然不知道這場贏球該說給誰聽。',[
  opt('先分開冷靜，說清楚重建信任的條件',-18,'你沒有立刻原諒，也不再替她找理由。她答應結束另一段關係，願意接受你需要時間。你們把決定留給往後的行動。','strained'),
  opt('到此為止，把自己帶回生活裡',-28,'你掛斷電話，把合照收進抽屜。明天仍然會痛，但你決定不再把尊嚴留在一個沒有答案的房間。','separated','alone'),
  opt('再給一次機會，但要求一起面對傷口',-12,'你說「還愛妳」，不代表事情已經過去。你們約好接受伴侶諮商，讓信任從能做到的小事重新開始。','strained','rebuild')
 ]),
 episode('temptation','客場的那杯酒，越過界線只差一步','慶功宴後 · 飯店大廳','你的世界裡，還有我的位置嗎？','一位成年合作夥伴陪你聊到散場，說自己比任何人都懂你的孤單。手機上，以晴傳來一句「到旅館了嗎」。你知道接下來的選擇，不能再用太累或太寂寞當作藉口。',[
  opt('明確說自己有伴侶，回房打給以晴',8,'你道謝後離開，沒有留下曖昧的空間。電話那頭傳來熟悉的哈欠聲，你忽然很想回家。'),
  opt('接受曖昧，瞞著伴侶開始另一段關係',6,'短暫的新鮮感讓你心跳加快，你卻開始替每則訊息編理由。這份被藏起來的快樂，已經留下下一次風暴的引線。','strained','exposed'),
  opt('先結束原本關係，再面對新的心意',-16,'你沒有同時答應兩個人的未來。那通告別電話很難聽，也很難說，但你選擇承擔改變心意的代價。','separated','alone')
 ]),
 episode('ex-message','前任突然說：如果當年我們沒有分開','返家列車 · 一則舊訊息','回憶可以留下，界線也要留下。','很久沒聯絡的前任，傳來你初登場時的照片，約你單獨見面。窗外的城市一直往後退，你想起那些沒說完的話，也想起現在有人正在等你回家。',[
  opt('坦白告訴伴侶，婉拒單獨赴約',7,'你把訊息說清楚，也把祝福留給過去。以晴說她在乎的不是那張照片，而是你沒有讓她成為最後知道的人。'),
  opt('瞞著伴侶赴約，讓舊情重新升溫',5,'你說只是敘舊，卻沒有阻止對方牽住你的手。那晚之後，回家的路上多了一個必須隱瞞的秘密。','strained','exposed'),
  opt('承認自己還沒放下，先結束現在的關係',-20,'你把真話說出口，也接受對方不必原諒。這一次，你得先學會獨處，而不是把別人當成遺憾的補位。','separated','alone')
 ]),
 episode('rumor','全網都在說她劈腿，只有你還沒問她','更衣室 · 被截掉一半的照片','照片裡的人，是陪我送爸爸急診的同事。','隊友把熱門貼文遞來：以晴和陌生人深夜同行。標題寫得像已經宣判。她終於接起電話，聲音沙啞，說父親昨晚住院。被截掉的畫面裡，其實還有醫院招牌。',[
  opt('先聽完整經過，再一起澄清',10,'完整照片與時間對上了。你陪她去探病，回程時她靠著窗睡著。這次你守住的，是沒有被流言搶走的信任。'),
  opt('先發文質問，才發現自己誤會了',-22,'貼文被截圖傳開，你刪不掉她看到時的表情。你公開更正並道歉，但她說，需要時間才能再次放心。','strained','rebuild'),
  opt('暫時不回應外界，先陪她處理家事',6,'你把手機調成靜音，買了兩份熱飯到醫院。那些急著看熱鬧的人沒有等到回應，她卻等到了你。')
 ]),
 episode('anniversary','桌上的蛋糕，蠟燭已經熄了','紀念日 · 空掉的餐廳','我不是一定要過節。我只是想被記得。','你接下臨時的商業活動，忘記今天早已約好。回到家，餐桌上只有一塊切好的蛋糕。以晴把精心準備的卡片翻過去，你第一次發現沉默比爭吵更難受。',[
  opt('承認失約，排出一整天認真補回陪伴',-5,'你沒有拿工作當擋箭牌。隔天的早餐仍有點安靜，但她願意把那張卡片重新翻過來。'),
  opt('說她不體諒自己的職業壓力',-18,'你越解釋，兩個人越遠。那天之後，你們的對話只剩下行程與「知道了」，信任得重新修補。','strained','rebuild'),
  opt('取消明天的應酬，今晚先聽她說完',8,'你把手機放遠，沒有急著求原諒。聊到天快亮，你們終於說出各自最害怕被忽略的地方。')
 ]),
 episode('stands','滿場噓聲裡，她舉著最傻的加油牌','客場看台 · 比賽結束後','今天沒有贏，也有我來接你。','你連續失誤，整場都不敢往看台看。直到離場時，熟悉的名字被一筆一畫寫在手作牌上。以晴請了假，轉了兩班車，只為在最難受的一天站在這裡。',[
  opt('走過去抱住她，承認今天真的很難受',18,'你終於不用把難過偽裝成沒事。她拍拍你的背，說回家路上可以一直講，也可以什麼都不講。'),
  opt('把比賽用球送給她，約好下次一起慶祝',14,'「下次換我請妳看一場好球。」她搖頭說，今天這場也值得來。你帶著那句話，重新相信下一次。'),
  opt('謝謝她，也問問她最近過得好不好',16,'你聽她說一路趕車的糗事，終於笑出聲。陪伴不是只有一個人付出，今天你也想接住她。')
 ]),
 episode('dreams','夢想的合約，寫著不同的城市','兩份錄取通知 · 餐桌兩端','我想支持你，也不想一直放棄我自己。','你的球隊要你留下，她則拿到等待多年的外地工作。這次沒有誰背叛誰，卻像站在兩條不同的跑道。你們必須決定，愛情能不能容得下兩個人的夢。',[
  opt('試著遠距，先把探望與溝通時間排好',7,'你們把兩份行事曆攤開，不保證永遠不累，只約好累的時候會說。她出發那天，你替她提行李到車站。'),
  opt('要求她放棄機會，證明比較愛你',-20,'她沒有答應。你第一次聽見「愛我不該是放棄自己」說得這麼重，這段關係需要重新理解彼此。','strained','rebuild'),
  opt('承認都不想退讓，好好道別',-15,'你們替對方留下祝福，沒有把夢想說成罪過。列車開走時，你知道相愛過是真的，分開也是真的。','separated','alone')
 ]),
 episode('exposed','這次被揭穿的人，是你','家門口 · 沒有開燈的客廳','我難過的不是照片，是你每次都說沒有。','你藏起來的另一段關係，終於被當事人的合照揭穿。以晴沒有歇斯底里，只把你曾經編過的說詞一條條念出來。那些你以為能拖延的後果，現在全站在門口。',[
  opt('承認外遇，結束另一段關係並接受後果',-30,'你沒有再把責任推給客場或寂寞。她願意暫時留下，但不保證原諒；往後每一次誠實，都要重新累積。','strained','rebuild'),
  opt('繼續否認，直到她決定離開',-38,'她把鑰匙放下，沒有再問。你留住了最後一句辯解，卻沒有留住她。明天要面對的，是自己造成的失去。','separated','alone'),
  opt('坦白不再適合，承擔分開的責任',-26,'你們決定分開，把生活一件件拆開重新安置。有孩子的話，照顧責任仍在；一段感情結束，不是卸下承諾的理由。','separated','alone')
 ],{followup:true}),
 episode('rebuild','信任不是一句「原諒」就會回來','一張新的共同日曆','我願意試，但不想再被催著當作沒事。','風暴過去後，你們仍會因一句話沉默。這次約會沒有精心安排的驚喜，只有一場把界線、傷害與期待說清楚的談話。能不能繼續，不由任何一個人單方面決定。',[
  opt('一起訂下能做到的約定，慢慢重建',14,'你們沒有宣告一切恢復原樣，而是決定從今天開始，讓答應的事真的發生。這次的牽手，比以前慢，也比以前慎重。'),
  opt('接受無法回到從前，結束關係',-12,'你們都盡力了，仍沒有辦法安心靠近。告別不是誰贏了，而是終於不再勉強彼此留在傷口裡。','separated','alone'),
  opt('各自保留空間，繼續觀察彼此的改變',3,'你們把關係放慢，不急著做出漂亮結論。球場的燈會熄，生活卻還有很多次可以練習誠實的明天。','strained')
 ],{followup:true}),
 episode('alone','分開後，第一個不再等訊息的晚上','自己的房間 · 晚餐還熱著','你的人生，不只剩下一段感情。','訓練結束，你習慣性拿起手機，又慢慢放下。那個名字不再出現在通知裡。隊友敲門，手上拎著宵夜，問你要不要一起看一場和工作無關的電影。',[
  opt('接受陪伴，把日子一點點撿回來',16,'你笑的時候還是會想起她，但已經能把一頓飯吃完。原來重新開始，不一定是愛上誰，也可以是重新照顧自己。','separated'),
  opt('把所有難過埋進加練，不願意停下',-10,'球一次次撞上牆，心裡那個空位卻沒有消失。你需要的也許不只是練習，而是一個能說出難過的地方。','separated'),
  opt('找信任的人聊聊，重新安排生活',20,'你沒有逼自己立刻忘記。把那段故事說完的時候，窗外的天已經亮了，而你終於想為自己準備早餐。','separated')
 ],{followup:true,separated:true}),
 episode('reunion','一年後，她坐在同一間咖啡店','久別重逢 · 沒有預設答案','這次見面，不是要你忘記以前的事。','你們再次見面，誰都沒有急著說想念。她談起這段日子的改變，你也坦白那些還沒癒合的地方。熟悉的人坐在面前，答案卻可以和從前不同。',[
  opt('彼此確認仍想一起走，重新交往',15,'你們沒有假裝沒有受傷，也沒有承諾永遠不犯錯。這一次，從能坦白說話開始，再慢慢走向彼此。'),
  opt('謝謝她來，讓回憶留在回憶裡',8,'你們把最後一口咖啡喝完，笑著道別。走出店門，你發現自己的腳步沒有以前那麼沉了。','separated'),
  opt('還沒準備好，先保持距離',2,'你誠實地說還需要時間。不是拒絕幸福，而是不再為了怕寂寞，草率答應另一段開始。','separated')
 ],{separated:true}),
 episode('old-wedding','前任的婚禮邀請，寄到了更衣室','一張紅色喜帖','有些人陪過一段路，就已經足夠。','你認得信封上的字。那些年練完球一起吃的便當、一起躲過的雨，忽然全跑回來。喜帖上站在她旁邊的名字不是你，但你的人生也沒有停在分手那天。',[
  opt('送上祝福，回到自己正在走的路',9,'你寫了一段很短的祝福，把信封放好。過去沒有被抹掉，只是終於能放在不再刺痛的位置。','separated'),
  opt('不勉強出席，給自己一點消化的時間',4,'你沒有裝作完全不在意。允許自己難過一晚，隔天仍願意把窗簾拉開，就是今天的小勝利。','separated'),
  opt('翻完所有舊照片，又問自己輸在哪裡',-16,'照片裡的笑是真的，現在的失落也是真的。你把自己困在比較裡，連球場上最熟悉的節奏都開始走神。','separated')
 ],{separated:true}),
 episode('homecoming','所有人都說你不行，她卻把燈留著','低潮的一夜 · 家門口','今天先吃飯，明天再去和世界打一場。','外界開始討論你的替代人選。你回家時已過午夜，玄關卻有一雙擺好的拖鞋和一盞燈。以晴沒有問下一份合約在哪裡，只把湯重新熱了。',[
  opt('坐下來，說出自己其實很害怕',20,'你不必在家也扮演無所不能的球星。那碗湯還很燙，你的心卻終於不再像空掉的球場。'),
  opt('謝謝她一直都在，約好明天一起散步',15,'第二天的陽光沒有幫你解決合約，但你記起自己為什麼還想繼續。人生裡仍有比排名更可靠的東西。'),
  opt('把挫敗遷怒給她，轉身關上房門',-18,'門後很安靜，你卻知道那不是平靜。球場上的輸贏不能替傷人的話開脫，你需要為自己的語氣道歉。','strained','rebuild')
 ])
];
const byId=Object.fromEntries(EVENTS.map(e=>[e.id,e]));
function available(s,e){if(!e||s.retired||s.age<19||!s.family||!['dating','married','parent'].includes(s.family.stage))return false;const r=s.romance;if(r?.history.some(h=>h.age===s.age)||!e.followup&&r?.history.some(h=>h.id===e.id))return false;if(e.followup)return r?.pending?.id===e.id&&r.pending.due<=s.age||e.id==='romance-rebuild'&&r?.bond==='strained'&&!r.pending;return !!e.separated===(r?.bond==='separated')}
function pick(s,ctx){const f=s.family,r=s.romance;if(!f||s.age<19||s.retired||r?.history.some(h=>h.age===s.age))return null;if(r?.pending&&r.pending.due<=s.age&&available(s,byId[r.pending.id]))return r.pending.id;if(r?.bond==='strained'&&!r.pending&&!r.history.some(h=>h.id==='romance-rebuild'))return 'romance-rebuild';const next=L.next(s);if(next&&next!=='family-distance')return null;if(next!=='family-distance'&&(f.settled||s.age<23||r?.history.length&&s.age-r.history.at(-1).age<2))return null;const pool=EVENTS.filter(e=>!e.followup&&available(s,e));return pool.length?pool[Math.floor(ctx.random(s)*pool.length)].id:null}
function scene(s,e){if(!e?.id.startsWith('romance-'))return e;const text=t=>t.replaceAll('以晴',L.partner(s));return {...e,text:text(e.text),scene:{...e.scene,voice:e.separated?'心裡的聲音':L.partner(s),line:text(e.scene.line)},options:e.options.map(c=>({...c,label:text(c.label),resultText:text(c.resultText)}))}}
function choose(s,e,c){if(!c.romanceAction)return;const r=s.romance||(s.romance={v:1,bond:'together',history:[],pending:null});r.bond=c.romanceAction.bond;r.history.push({id:e.id,age:s.age,choice:e.options.indexOf(c),mood:c.effect.mood,...(s.eventRules>=4?{rules:4}:{})});r.pending=c.romanceAction.next?{id:'romance-'+c.romanceAction.next,due:s.age+1}:null;if(s.family.stage==='dating'&&!s.family.milestones.some(m=>m.id==='distance'))s.family.milestones.push({id:'distance',age:s.age,action:'distance'});}
function historyHTML(s){const r=s.romance;if(!r)return '';return `<section class="romance-history"><span class="tag">${r.bond==='separated'?'各自往前走':r.bond==='strained'?'信任修復中':'有人與你同行'}</span><h3>那些改變心情的夜晚</h3>${r.history.slice(-6).reverse().map(h=>`<p><b>${h.age} 歲 · ${esc(byId[h.id].title)}</b><br><span>${esc(byId[h.id].options[h.choice].label.replaceAll('以晴',L.partner(s)))}</span> <em class="${h.mood<0?'is-loss':''}">心情 ${h.mood>0?'+':''}${h.mood}</em></p>`).join('')}${r.pending?'<small>這段故事，下一季還會有回聲。</small>':''}</section>`}
function validate(s){const r=s.romance;if(r===undefined)return;const fail=()=>{throw Error('感情故事存檔格式不正確')};if(!s.family||r.v!==1||!['together','strained','separated'].includes(r.bond)||!Array.isArray(r.history)||r.history.length<1||r.history.length>42)fail();let age=18;const ids=new Set();for(const h of r.history){const e=byId[h?.id],c=(h?.rules===4?(typeof module!=='undefined'?require('./stakes.js'):root.XZStakes).scene(e):e)?.options[h?.choice];if(!c||h.rules!==undefined&&h.rules!==4||!Number.isInteger(h.choice)||!Number.isInteger(h.age)||h.age<=age||h.age>s.age||h.mood!==c.effect.mood||!e.followup&&ids.has(h.id))fail();age=h.age;ids.add(h.id)}const last=r.history.at(-1),action=byId[last.id].options[last.choice].romanceAction;if(r.bond!==action.bond)fail();if(r.pending!==null&&(!r.pending||!byId[r.pending.id]?.followup||r.pending.id!=='romance-'+action.next||r.pending.due!==last.age+1))fail();if(!!r.pending!==!!action.next)fail();}
const api={EVENTS,available,pick,scene,choose,historyHTML,validate};if(typeof module!=='undefined')module.exports=api;else root.XZRomance=api;
})(globalThis);
