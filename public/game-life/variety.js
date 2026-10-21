/* Story selection memory is saved with each career; rendering never draws RNG. */
(function(root){
'use strict';
const LIMIT=160;
const hash=t=>{let h=2166136261;for(const c of String(t))h=Math.imul(h^c.charCodeAt(0),16777619);h^=h>>>16;h=Math.imul(h,0x85ebca6b);h^=h>>>13;return h>>>0};
const topics={youth:'起步',campus:'起步',training:'技術',pitch:'技術',bat:'技術',attack:'技術',hoops:'技術',field:'戰術',footballdef:'戰術',hoopsdef:'戰術',mind:'心境',team:'隊友情誼',family:'親友',media:'公眾',business:'金錢',career:'職涯',community:'社區',rehab:'健康',veteran:'傳承',world:'異地'};
const known={extra:'技術',mentor:'傳承',rival:'對手',pain:'健康',sleep:'健康',captain:'隊友情誼',equipment:'技術',rain:'日常',interview:'公眾',nutrition:'健康',slump:'心境',friend:'親友',community:'社區','coach-change':'職涯',pressure:'心境',film:'戰術'};
function topic(e){if(!e)return'日常';if(e.topic)return e.topic;if(/^(family|romance)-/.test(e.id))return'感情';const g=e.id.match(/^v5-(?:story-)?([a-z]+)-/);if(g)return topics[g[1]]||e.category;if(known[e.id])return known[e.id];if(e.id.startsWith('chapter-'))return {'chapter-growth':'技術','chapter-trust':'隊友情誼','chapter-contend':'對手','chapter-balance':'親友'}[e.id]||'職涯';if(e.id.startsWith('fate-')){if(/partner|child/.test(e.id))return'感情';if(/flu|slip|rest|recovery|sleep/.test(e.id))return'健康';if(/coach|position|trade|system|scout/.test(e.id))return'職涯';if(/family|letter|friend|roommate/.test(e.id))return'親友';if(/sponsor|bag|rent|grant/.test(e.id))return'金錢';if(/viral/.test(e.id))return'公眾';if(/plateau/.test(e.id))return'心境';return'技術'}return e.category||'日常'}
function init(s,avoid=[]){s.storyMemory={v:1,avoid:[...new Set(avoid.filter(x=>typeof x==='string'&&/^[a-z0-9#-]{1,100}$/.test(x)))].slice(0,LIMIT),topics:[],variants:[]}}
function ensure(s,events=[]){if(!s.storyMemory){init(s);const byId=new Map(events.map(e=>[e.id,e]));s.storyMemory.topics=s.recent.slice(-3).map(id=>topic(byId.get(id))).filter(Boolean)}return s.storyMemory}
const fingerprint=e=>e.title.replace(/[\s，。！？、·・]/g,'');
function pool(s,eligible,all=eligible){
 const seenTitles=new Set(all.filter(e=>s.visits[e.id]).map(fingerprint));
 // Ordinary random draws never replay an encountered event, even when its old definition lacked once:true.
 let fresh=eligible.filter(e=>!s.visits[e.id]&&!seenTitles.has(fingerprint(e)));if(!fresh.length)return[];
 const memory=ensure(s,all),unseen=fresh.filter(e=>!memory.avoid.includes(e.id));if(unseen.length)fresh=unseen;
 const different=fresh.filter(e=>!memory.topics.slice(-3).includes(topic(e)));if(different.length)fresh=different;
 return fresh;
}
function pick(s,candidates,random,all=candidates){const fresh=pool(s,candidates,all);if(!fresh.length)return null;const weights=fresh.map(e=>(e.weight||1)*(e.sport!==undefined?1.65:1)*(e.rarity==='rare'?.45:1));let n=random(s)*weights.reduce((a,b)=>a+b,0);return fresh.find((e,i)=>(n-=weights[i])<0)||fresh.at(-1)}
function record(s,e){const m=ensure(s);m.topics.push(topic(e));m.topics=m.topics.slice(-4)}
function variant(s,e,variants){const m=ensure(s),n=(variants?.[e.id]?.length||0)+1;const candidates=Array.from({length:n},(_,i)=>i).filter(i=>!m.avoid.includes(e.id+'#'+i));const pool=candidates.length?candidates:Array.from({length:n},(_,i)=>i);s.sceneVariant=pool[hash(s.seed+'|'+s.sport+'|'+e.id)%pool.length];if(n>1)m.variants.push(e.id+'#'+s.sceneVariant)}
function scene(s,e,variants){if(!e||!(s.eventRules>=3))return e;const v=s.sceneVariant?variants?.[e.id]?.[s.sceneVariant-1]:null;
 const next=v?{...e,title:v.title,text:v.text,scene:{...e.scene,place:v.place,line:v.line},options:e.options.map((c,i)=>({...c,label:v.labels[i],hint:v.hints?.[i]||c.hint,resultText:v.results[i]}))}:e;
 return {...next,options:next.options.map((c,i)=>i===0&&['family-date','family-marry','family-birth'].includes(e.id)?{...c,familyCheck:true,chance:.76,effect:{mood:0},good:c.effect,bad:{mood:-9,morale:-4},hint:'提出你的想法，對方也有自己的步調；可能先等待 1～2 年，之後會有另一段故事。',successText:c.resultText,failureText:e.id==='family-date'?'以晴說自己還沒準備好。你們沒有開始交往，也沒有急著替彼此定義結局。先讓生活往前，等到雙方都願意時再談。':e.id==='family-marry'?'以晴沒有接過戒指。她仍然喜歡你，只是對往後的安排還有不安。你收起戒指，答應先把那些問題一起談清楚。':'你們發現現在的生活還容不下育兒的責任，決定先緩一緩。孩子還沒有出生，這段時間留給兩個人重新準備。'}:c.retry?{...c,retry:false,hint:c.hint.replace(/；每段支線最多嘗試 3 次。/g,'；失敗後故事會往前，不會自動重播。'),failureText:'這次沒能完成「'+c.label+'」。你把這段經歷收進筆記，原本的目標留在這裡，往後還有別的機會。'}:c)};
}
function familyReady(s,id){if(!id)return false;if(s.family?.pause)return s.age>=s.family.pause.due;const earliest=id==='family-meet'?17+hash(s.seed+'|meeting')%4:Math.max(18,(s.family?.milestones.at(-1)?.age||16)+1+hash(s.seed+'|'+id+'|timing')%2);return s.age>=earliest}
const feelings={
 '技術':[['最後一次動作接上時，你愣了一下，才敢相信剛才的手感。原來那些沒人看到的練習，真的留在身體裡。','你把今天做對的地方記進本子。字寫得有點亂，因為到現在，手還帶著興奮的顫。'],['你又試了一次，還是沒做好。收球時很不甘心，但你把錯在哪裡記了下來，不想讓今天只剩責怪自己。','熟悉的動作忽然變得陌生。你靠著場邊喘氣，等心跳慢下來，才承認這次真的需要換個方法。']],
 '戰術':[['你終於看懂那個空間是怎麼出現的。比起證明自己厲害，你更期待下一次能和隊友一起把它做出來。','你把戰術圖上的線重新連起來。那些原本只能靠猜的瞬間，今天終於有了一點把握。'],['紙上的路線沒有在場上接起來。你反覆看著出錯的那一格，這次先不問誰該負責，只想知道漏掉了什麼。','你太急著完成整套安排，反而錯過最簡單的一步。收起戰術板前，你把那一步重新圈了起來。']],
 '隊友情誼':[['你原本擔心自己的話沒有人聽。結束時有人輕輕碰了你的拳頭，你才發現，這份在意有被接住。','大家沒有說什麼漂亮話，只一起把剩下的事做完。你離開得晚了一點，心裡卻比來時踏實。'],['你以為大家都懂，直到沉默變得很長。這次留下的不只疲憊，還有一句之後得親口說清楚的話。','事情沒有照計畫走，你也忍不住有點委屈。整理球袋時，你決定先把自己真正介意的事想明白。']],
 '親友':[['你終於不用急著說自己很好。有些話說得斷斷續續，說完時，胸口卻鬆了一點。','走出門時，你回頭看了一眼。比賽還有很多場，有些普通的相處，你也開始想好好記住。'],['訊息打了又刪，你不知道怎麼解釋這次的落空。最後留下了一句抱歉，這次沒有再加上做不到的保證。','你一直到安靜下來，才感覺到失落。有些事情沒有對錯，卻仍會讓人在回程時紅了眼眶。']],
 '健康':[['你發現自己終於能把呼吸放慢。今天沒有誰替你歡呼，但身體那一點鬆開的感覺，你自己知道。','你把今天的恢復記下來。那只是很小的一步，卻讓你第一次願意期待明天醒來。'],['你比預期更累，只好停下來重新安排。心裡很不甘願，但這次，你終於聽見身體一直想說的話。','進展沒有照期待出現。你看著空白的紀錄格，先把今天真正做得到的事寫下來。']],
 '職涯':[['你重新讀了一遍自己的決定，沒有立刻告訴所有人。這條路仍有未知，至少這次，你知道為什麼要走。','球袋還是那一個，你看事情的方式卻變了。下一步未必輕鬆，但今天的選擇讓你多了一點底氣。'],['你把手機放下，好一會兒沒有動。原來期待落空時，連一句「再努力」都很難聽進去；先讓自己難過一下也可以。','你沒有等到想要的答案。回程時，你把接下來能做的事一件件想清楚，才發現路還沒有走完。']],
 '心境':[['你沒有突然變得無所畏懼，只是不再一直和自己作對。離開時，連肩膀都比來時輕了一點。','你終於承認，自己其實很在乎。把那份在乎說清楚以後，下一步反而沒有原本那麼難。'],['你又想起別人做得比你好的地方。這次你沒有逼自己立刻振作，只先把今天撐過去。','你原本很想證明自己，最後卻只能承認失望。那股難受還在，但你決定不把一次結果當成整個自己。']]
};
function result(e,c,success,s){
 const authored=c.chance===undefined?c.resultText:success?c.successText:c.failureText;
 const boilerplate=!authored||authored==='你依照共同討論的方案完成這次行動，成果和責任由大家一起承擔。'||authored==='協作仍有磨合成本，這次沒有達到預期。'||authored.endsWith('這段經歷留下了不同的收穫。');
 if(e.id.startsWith('v5-')&&boilerplate&&!c.defer){
  const category=topic(e),group=feelings[category]||feelings[{'起步':'心境','傳承':'隊友情誼','異地':'職涯','公眾':'職涯','金錢':'職涯','社區':'親友','感情':'親友'}[category]||'心境'],lines=group[success?0:1];
  return lines[hash((s?.seed||'')+'|'+e.id+'|'+c.label)%lines.length];
 }
 if(authored)return authored;
 return c.chance===undefined?`你決定${c.label}。離開時，心裡比剛才更清楚自己在乎什麼。`:success?`你做到了「${c.label}」。那一瞬間的踏實，你想好好記住。`:`你試著${c.label}，結果卻沒有如願。你停下來喘一口氣，帶著這次的失落重新出發。`;
}
function validate(s){if(s.storyMemory===undefined)return;const m=s.storyMemory,strings=(a,max)=>Array.isArray(a)&&a.length<=max&&a.every(x=>typeof x==='string'&&x.length<=100);if(!m||m.v!==1||!strings(m.avoid,LIMIT)||!strings(m.topics,4)||!strings(m.variants,100)||new Set(m.avoid).size!==m.avoid.length)throw Error('故事抽取紀錄格式不正確');if(s.sceneVariant!==undefined&&(!Number.isInteger(s.sceneVariant)||s.sceneVariant<0||s.sceneVariant>3))throw Error('故事場景格式不正確')}
const api={LIMIT,hash,topic,init,ensure,pool,pick,record,variant,scene,familyReady,result,validate};if(typeof module!=='undefined')module.exports=api;else root.XZVariety=api;
})(globalThis);
