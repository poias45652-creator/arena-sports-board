(function(root){
'use strict';
const clamp=(n,a=0,b=100)=>Math.max(a,Math.min(b,n));
const esc=t=>String(t??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const PLANS={
 surgery:[
  {id:'team',name:'接受球隊安排的手術',cost:0,steps:2,health:18,mood:-6,availability:.65,text:'球隊負擔醫療費，手術後完成 2 段復健；本季出場倍率上限 65%。'},
  {id:'specialist',name:'自費安排專科手術與復健',cost:80,steps:2,health:22,mood:-4,availability:.75,text:'支出 80 萬，安排專科團隊與 2 段復健；本季出場倍率上限 75%。'},
  {id:'extended',name:'接受手術，預留更長復健期',cost:0,steps:3,health:22,mood:0,availability:.45,text:'球隊支援，完成 3 段復健；本季出場倍率上限 45%，換取更多恢復機會。'},
  {id:'family',name:'讓家人陪同手術與復健',cost:0,steps:2,health:15,mood:8,chemistry:5,availability:.60,text:'球隊支援，家人陪伴讓心情 +8、默契 +5；完成 2 段復健，本季出場倍率上限 60%。'}
 ],
 mental:[
  {id:'team',name:'接受專業評估與球隊心理輔導',cost:0,steps:3,health:0,mood:10,availability:.85,text:'球隊安排專業評估與 3 段心理照護，不需費用；本季出場倍率上限 85%。'},
  {id:'clinic',name:'自費安排固定門診與心理治療',cost:30,steps:3,health:0,mood:12,availability:.90,text:'支出 30 萬，安排固定專業團隊與 3 段照護；本季出場倍率上限 90%。'},
  {id:'family',name:'請信任的人陪同就醫',cost:0,steps:3,health:0,mood:12,chemistry:6,availability:.80,text:'接受專業評估、心理輔導與親友支持；默契 +6，3 段照護，本季出場倍率上限 80%。'},
  {id:'leave',name:'暫時休賽，專心接受心理照護',cost:0,steps:2,health:6,mood:10,availability:.55,text:'球隊安排評估與心理輔導，完成 2 段休賽照護；健康 +6，本季出場倍率上限 55%。'}
 ]
};
const RECOVERY={
 surgery:[
  {id:'rehab',name:'依照計畫復健',effect:{health:14,mood:3,energy:8},text:'健康 +14、心情 +3、體力 +8。'},
  {id:'review',name:'回診追蹤，調整復健內容',effect:{health:11,mood:5,energy:10},text:'健康 +11、心情 +5、體力 +10。'},
  {id:'support',name:'與家人完成今日復健',effect:{health:10,mood:9,chemistry:3},text:'健康 +10、心情 +9、默契 +3。'},
  {id:'rest',name:'安排完整的休養日',effect:{health:12,mood:6,energy:16},text:'健康 +12、心情 +6、體力 +16。'}
 ],
 mental:[
  {id:'therapy',name:'完成本次心理輔導',effect:{mood:14,morale:3},text:'心情 +14、士氣 +3；與專業人員一起處理當前困擾。'},
  {id:'support',name:'專業會談後，與信任的人談談',effect:{mood:12,chemistry:5,morale:2},text:'心情 +12、默契 +5、士氣 +2。'},
  {id:'routine',name:'依照輔導計畫重建生活節奏',effect:{mood:10,health:4,energy:12},text:'心情 +10、健康 +4、體力 +12。'},
  {id:'review',name:'回診討論狀態，調整照護安排',effect:{mood:13,health:3,morale:2},text:'心情 +13、健康 +3、士氣 +2。'}
 ]
};
function ensure(s){
 if(s.mood===undefined)s.mood=70;
 if(!s.care)s.care={v:1,lowMoodSteps:0,mentalStatus:'well',active:null,availability:1,availabilityAge:s.age,supportAge:null,surgeries:0,counseling:0,history:[],last:''};
 return s.care;
}
function effects(e={}){
 const out={...e};
 if(!Number.isFinite(out.mood)){
  const morale=Number.isFinite(e.morale)?e.morale:0;
  const change=morale<0?Math.floor(morale*.6):Math.floor(morale*.35);
  out.mood=change+(e.health<=-10?-3:0);
 }
 return out;
}
function tick(s){const c=ensure(s);if(!s.retired&&!c.active)c.lowMoodSteps=s.mood<=25?Math.min(3,c.lowMoodSteps+1):0;}
function note(s,ctx,text){const c=ensure(s);c.last=text;c.history.unshift({age:s.age,text});c.history=c.history.slice(0,30);ctx.log(s,text);}
function check(s,ctx){
 const c=ensure(s);if(s.retired)return false;if(c.active)return true;
 if(s.health<=20){
  c.active={kind:'surgery',stage:'decision',plan:null,left:0,total:0,diagnosis:false};
  note(s,ctx,'健康降至危險值，醫療團隊叫停訓練與比賽，安排傷勢檢查及手術評估。');return true;
 }
 if(s.mood<=10||s.mood<=25&&c.lowMoodSteps>=3){
  c.active={kind:'mental',stage:'decision',plan:null,left:0,total:0,diagnosis:c.lowMoodSteps>=3};
  note(s,ctx,'心情低落已影響日常生活，球隊暫緩競賽安排，陪你接受專業心理評估。');return true;
 }
 return false;
}
function availability(s){const c=s.care;return c?.availabilityAge===s.age?c.availability:1;}
function choose(s,id,ctx){
 const c=ensure(s),a=c.active;if(s.retired||!a||a.stage!=='decision')return{ok:false};
 const p=PLANS[a.kind].find(x=>x.id===id);if(!p)return{ok:false};
 if(s.money<p.cost)return{ok:false,message:'資金不足，可以選擇不需費用的球隊支援方案。'};
 ctx.apply(s,{money:-p.cost,health:p.health,mood:p.mood,chemistry:p.chemistry||0});
 c.availability=Math.min(availability(s),p.availability);c.availabilityAge=s.age;
 a.plan=id;a.stage='recovery';a.left=a.total=p.steps;
 if(a.kind==='surgery'){
  c.surgeries++;if(!s.majorRehabPending){s.injuries++;s.majorInjuries++;}s.majorRehabPending=true;
  note(s,ctx,'手術已完成。最難的不是錯過一場比賽，而是願意替未來留一條回場的路。接下來按計畫復健，還不能直接上場。');
 }else{
  c.counseling++;
  if(a.diagnosis){c.mentalStatus='depression';note(s,ctx,'回顧持續數週的低落、失眠與失去興趣後，醫療團隊評估你正在經歷憂鬱症。這不是意志力不足；你與專業人員一起訂下心理治療、休養及支持計畫。');}
  else{c.mentalStatus='followup';note(s,ctx,'醫療團隊先處理近期的情緒困擾，安排心理輔導與後續追蹤。一次心情低落不等於憂鬱症，接下來會持續評估。');}
 }
 return{ok:true};
}
function recover(s,id,ctx){
 const c=ensure(s),a=c.active;if(s.retired||!a||a.stage!=='recovery'||a.left<1)return{ok:false};
 const choice=RECOVERY[a.kind].find(x=>x.id===id);if(!choice)return{ok:false};
 ctx.apply(s,choice.effect);if(s.dynamics)s.dynamics.strain=Math.max(0,s.dynamics.strain-8);
 a.left--;
 note(s,ctx,choice.name+'：'+choice.text+`照護進度 ${a.total-a.left} / ${a.total}。`);
 if(a.left===0){
  if(a.kind==='surgery'){
   s.health=Math.max(55,s.health);s.majorRehabPending=false;s.majorRecovered=true;
   note(s,ctx,'復健評估通過，健康回到至少 55，可以逐步回到球場。本季仍採保護性出場，健康與負荷會繼續影響表現。');
  }else{
   s.mood=Math.max(45,s.mood);c.mentalStatus='followup';c.lowMoodSteps=0;
   note(s,ctx,'這一階段的心理照護已完成，心情回到至少 45、症狀有所改善，後續仍持續追蹤。你不必立刻回到巔峰，先找回能好好生活與打球的節奏。');
  }
  c.active=null;check(s,ctx);
 }
 return{ok:true};
}
function support(s,ctx){
 const c=ensure(s);if(s.retired||c.active)return{ok:false};
 if(c.supportAge===s.age)return{ok:false,message:'本季已安排心理輔導，下一季可以再次預約。'};
 c.supportAge=s.age;ctx.apply(s,{mood:12,morale:3,energy:8});
 if(s.mood>25)c.lowMoodSteps=0;
 note(s,ctx,'完成球隊心理輔導：心情 +12、士氣 +3、體力 +8。把壓力說出來，也是一種準備。');
 check(s,ctx);return{ok:true};
}
function newYear(s,ctx){
 const c=ensure(s);c.availability=1;c.availabilityAge=s.age;
 if(c.mentalStatus==='followup'&&s.mood>=55){c.mentalStatus='well';note(s,ctx,'新賽季追蹤評估：心情逐漸穩定，繼續保留休息與求助的空間。');}
}
function stageHTML(s){
 const c=ensure(s),a=c.active;if(!a)return null;
 const physical=a.kind==='surgery',body=s.sport===0&&s.pos==='投手'?'投球手臂':s.sport===2?'腳踝與膝部':s.sport===1?'下肢':'肩膝關節';
 const title=a.stage==='recovery'?(physical?'把回到球場，拆成一步一步。':'先照顧自己，再找回節奏。'):(physical?'這一次，身體真的撐不住了。':'燈亮著，心裡卻像沒有聲音。');
 const intro=a.stage==='recovery'?c.last:physical?`連平常的動作都開始疼痛。醫療團隊完成${body}檢查後，確認這次傷勢需要手術修復，不能再靠硬撐換取出場。現在的選擇，決定你如何走過復健。`:a.diagnosis?'連續一段時間，你睡不好，也對原本熱愛的球場失去興趣。隊友注意到你的沉默，陪你走進諮商室。先接受專業評估，再一起決定接下來的照護。':'心情已經降到難以承受的程度。球隊先讓你離開競賽壓力，安排專業心理評估；你不需要一個人把所有事情扛住。';
 const options=a.stage==='decision'?PLANS[a.kind]:RECOVERY[a.kind];
 return `<section class="care-stage" aria-label="${physical?'手術與復健':'心理評估與輔導'}"><div class="topline"><span class="tag">${physical?'傷勢醫療事件':'心理照護事件'}</span><span class="pill">${a.stage==='decision'?'暫停訓練與競賽':`照護 ${a.total-a.left} / ${a.total}`}</span></div><h2>${title}</h2><p>${esc(intro)}</p>${c.mentalStatus==='depression'?'<div class="care-diagnosis">專業評估：憂鬱症 · 正在接受心理治療與支持</div>':''}<div class="choice-list arena-choice-grid">${options.map((o,i)=>`<button class="choice" onclick="${a.stage==='decision'?'careChoice':'careRecover'}('${o.id}')" ${o.cost>s.money?'disabled':''}><strong><span class="choice-letter">${'ABCD'[i]}</span>${o.name}</strong><p>${o.text}</p>${o.cost>s.money?'<small>資金不足，仍可選擇免費支援。</small>':''}</button>`).join('')}</div><p class="care-note">原本的事件與比賽進度已保留，完成照護後接續。${physical?'完成復健評估後健康至少回到 55，本季仍有出場限制。':'完成本階段照護後心情至少回到 45，之後仍持續追蹤。診斷由劇情中的醫療團隊評估；心情分數是遊戲設定。'}</p></section>`;
}
function statusHTML(s){
 const c=ensure(s),limit=availability(s),label=c.mentalStatus==='depression'?'憂鬱症照護中':c.mentalStatus==='followup'?'心理追蹤中':s.mood<=25?'心情低落':'心情平穩';
 return `<section class="care-status"><b>${label}</b><p>心情影響專注、訓練與臨場表現；士氣代表競賽信心。</p>${s.health<=35?'<small>健康警訊：健康 ≤20 將觸發手術評估。</small>':''}${s.mood<=25?`<small>低落累積 ${c.lowMoodSteps} / 3；持續低落會觸發專業心理評估。</small>`:''}${limit<1?`<small>本季保護性出場倍率上限 ${Math.round(limit*100)}%</small>`:''}${!s.retired?`<button class="ghost" onclick="moodSupport()" ${c.active||c.supportAge===s.age?'disabled':''}>${c.supportAge===s.age?'本季已完成心理輔導':'安排心理輔導 · 心情 +12'}</button>`:''}${c.history.length?`<details><summary>醫療與心理照護紀錄</summary>${c.history.slice(0,6).map(x=>`<p>${x.age} 歲｜${esc(x.text)}</p>`).join('')}</details>`:''}</section>`;
}
function validate(s){
 const fail=()=>{throw Error('心情與照護存檔格式不正確')};
 if(s.mood!==undefined&&(!Number.isFinite(s.mood)||s.mood<0||s.mood>100))fail();
 const c=s.care;if(c===undefined)return;
 if(!c||c.v!==1||!['well','depression','followup'].includes(c.mentalStatus)||!Number.isInteger(c.lowMoodSteps)||c.lowMoodSteps<0||c.lowMoodSteps>3||!Number.isFinite(c.availability)||c.availability<.1||c.availability>1||!Number.isInteger(c.availabilityAge)||c.availabilityAge<16||c.availabilityAge>60||typeof c.last!=='string'||c.last.length>2000)fail();
 for(const key of ['surgeries','counseling'])if(!Number.isInteger(c[key])||c[key]<0||c[key]>1000)fail();
 if(c.supportAge!==null&&(!Number.isInteger(c.supportAge)||c.supportAge<16||c.supportAge>60))fail();
 if(!Array.isArray(c.history)||c.history.length>30||c.history.some(x=>!x||!Number.isInteger(x.age)||x.age<16||x.age>60||typeof x.text!=='string'||x.text.length>2000))fail();
 const a=c.active;if(a!==null){
  if(!a||!['surgery','mental'].includes(a.kind)||!['decision','recovery'].includes(a.stage)||typeof a.diagnosis!=='boolean')fail();
  if(a.stage==='decision'){if(a.plan!==null||a.left!==0||a.total!==0)fail();}
  else{const p=PLANS[a.kind].find(x=>x.id===a.plan);if(!p||!Number.isInteger(a.left)||a.left<1||a.left>p.steps||a.total!==p.steps)fail();}
 }
}
const api={PLANS,RECOVERY,ensure,effects,tick,check,availability,choose,recover,support,newYear,stageHTML,statusHTML,validate};
if(typeof module!=='undefined')module.exports=api;else root.XZCare=api;
})(globalThis);
