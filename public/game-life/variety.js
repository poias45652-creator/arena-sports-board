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
function scene(s,e,variants){if(!e||s.eventRules!==3)return e;const v=s.sceneVariant?variants?.[e.id]?.[s.sceneVariant-1]:null;
 const next=v?{...e,title:v.title,text:v.text,scene:{...e.scene,place:v.place,line:v.line},options:e.options.map((c,i)=>({...c,label:v.labels[i],hint:v.hints?.[i]||c.hint,resultText:v.results[i]}))}:e;
 return {...next,options:next.options.map((c,i)=>i===0&&['family-date','family-marry','family-birth'].includes(e.id)?{...c,familyCheck:true,chance:.76,effect:{mood:0},good:c.effect,bad:{mood:-9,morale:-4},hint:'提出你的想法，對方也有自己的步調；可能先等待 1～2 年，之後會有另一段故事。',successText:c.resultText,failureText:e.id==='family-date'?'以晴說自己還沒準備好。你們沒有開始交往，也沒有急著替彼此定義結局。先讓生活往前，等到雙方都願意時再談。':e.id==='family-marry'?'以晴沒有接過戒指。她仍然喜歡你，只是對往後的安排還有不安。你收起戒指，答應先把那些問題一起談清楚。':'你們發現現在的生活還容不下育兒的責任，決定先緩一緩。孩子還沒有出生，這段時間留給兩個人重新準備。'}:c.retry?{...c,retry:false,hint:c.hint.replace(/；每段支線最多嘗試 3 次。/g,'；失敗後故事會往前，不會自動重播。'),failureText:'這次沒能完成「'+c.label+'」。你把這段經歷收進筆記，原本的目標留在這裡，往後還有別的機會。'}:c)};
}
function familyReady(s,id){if(!id)return false;if(s.family?.pause)return s.age>=s.family.pause.due;const earliest=id==='family-meet'?17+hash(s.seed+'|meeting')%4:Math.max(18,(s.family?.milestones.at(-1)?.age||16)+1+hash(s.seed+'|'+id+'|timing')%2);return s.age>=earliest}
function result(e,c,success){if(c.chance===undefined)return c.resultText||`「${e.title}」最後，你決定${c.label}。這個選擇留下了實際的改變，下一次面對相似的取捨，你會記得今天。`;return success?(c.successText||`你真的做到了「${c.label}」。${e.title}不再只是一道難題，而成為你走過的一段經歷。`):(c.failureText||`你試著${c.label}，結果卻沒有如願。「${e.title}」留下的代價已經發生，你得帶著它，重新安排接下來的路。`)}
function validate(s){if(s.storyMemory===undefined)return;const m=s.storyMemory,strings=(a,max)=>Array.isArray(a)&&a.length<=max&&a.every(x=>typeof x==='string'&&x.length<=100);if(!m||m.v!==1||!strings(m.avoid,LIMIT)||!strings(m.topics,4)||!strings(m.variants,100)||new Set(m.avoid).size!==m.avoid.length)throw Error('故事抽取紀錄格式不正確');if(s.sceneVariant!==undefined&&(!Number.isInteger(s.sceneVariant)||s.sceneVariant<0||s.sceneVariant>3))throw Error('故事場景格式不正確')}
const api={LIMIT,hash,topic,init,ensure,pool,pick,record,variant,scene,familyReady,result,validate};if(typeof module!=='undefined')module.exports=api;else root.XZVariety=api;
})(globalThis);
