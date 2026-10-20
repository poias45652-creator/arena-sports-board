/* Optional short chapters and season objectives. No RNG is consumed by presentation or migration. */
(function(root){
'use strict';
const GOALS=[
 {id:'growth',icon:'↗',name:'突破自己',hint:'本季綜合能力比設定時增加 2 點。',reward:{fame:8,mood:4},prize:'聲望 +8 · 心情 +4'},
 {id:'trust',icon:'◎',name:'贏得信任',hint:'本季有出賽，且教練信任達 65。',reward:{fame:10,chemistry:4},prize:'聲望 +10 · 默契 +4'},
 {id:'contend',icon:'♜',name:'衝擊前三',hint:'把球隊帶進例行賽前三名。',reward:{fame:14,morale:5},prize:'聲望 +14 · 士氣 +5'},
 {id:'balance',icon:'♡',name:'找回狀態',hint:'季末健康至少 65、心情至少 55。',reward:{energy:12,mood:4},prize:'體力 +12 · 心情 +4'}
];
function data(s){return s.journey||null}
function init(s,length='career'){s.journey={v:1,startAge:s.age,limit:length==='short'?8:null,goal:null,results:[],chapterDone:false};return s.journey}
function season(s){return s.sport===1?s.football?.season:s.arena?.season}
function choose(s,id,ctx){
 if(s.retired||s.phase!=='train'||s.sessions!==0||!GOALS.some(g=>g.id===id))return{ok:false,message:'請在本季第一次訓練前選擇目標。'};
 const j=data(s)||init(s);if(j.goal?.age===s.age&&j.goal.id===id)return{ok:false};
 j.goal={id,age:s.age,baseline:ctx.ovr(s),settled:false};return{ok:true};
}
function values(s,g,ctx){const y=season(s),hub=s.sport===1?s.football:s.arena;return {growth:Math.max(0,ctx.ovr(s)-g.baseline),trust:hub?.trust||0,apps:y?.player?.apps||0,rank:y?.rank||(y?.table?.length?[...y.table].sort((a,b)=>(b.points??b.w)-(a.points??a.w)||(b.gf-b.ga)-(a.gf-a.ga)||b.gf-a.gf).findIndex(r=>r.team===y.team)+1:8),health:s.health,mood:s.mood??70}}
function achieved(id,v){return id==='growth'?v.growth>=2:id==='trust'?v.trust>=65&&v.apps>0:id==='contend'?v.rank<=3:v.health>=65&&v.mood>=55}
function settle(s,ctx){const j=data(s),g=j?.goal,y=season(s);if(!g||g.settled||g.age!==s.age||!y?.settled)return;const v=values(s,g,ctx),success=achieved(g.id,v),def=GOALS.find(x=>x.id===g.id);g.settled=true;const delta=success?ctx.apply(s,def.reward):null;j.results.unshift({age:s.age,id:g.id,success,values:v});j.results=j.results.slice(0,100);ctx.log(s,`賽季目標「${def.name}」${success?'達成：'+ctx.effectsText(delta):'未完成，下季可以改變方向。'}`)}
function atEnd(s){const j=data(s);return !!(j?.limit&&!j.chapterDone&&s.age-j.startAge+1>=j.limit)}
function extend(s){const j=data(s);if(!s.retired||s.reason!=='chapter'||!j?.chapterDone)return{ok:false};j.limit=null;s.retired=false;s.phase='result';s.reason='';s.ending=null;return{ok:true}}
function validate(s){const j=data(s);if(!j)return;const fail=()=>{throw Error('生涯篇章存檔格式不正確')};if(j.v!==1||!Number.isInteger(j.startAge)||j.startAge<16||j.startAge>s.age||![null,8].includes(j.limit)||typeof j.chapterDone!=='boolean'||!Array.isArray(j.results)||j.results.length>100)fail();if(j.goal&&(!GOALS.some(g=>g.id===j.goal.id)||!Number.isInteger(j.goal.age)||j.goal.age<j.startAge||j.goal.age>s.age||!Number.isFinite(j.goal.baseline)||typeof j.goal.settled!=='boolean'))fail();for(const r of j.results)if(!GOALS.some(g=>g.id===r.id)||!Number.isInteger(r.age)||typeof r.success!=='boolean'||!r.values||!Object.values(r.values).every(Number.isFinite))fail()}
const api={GOALS,data,init,choose,season,values,achieved,settle,atEnd,extend,validate};if(typeof module!=='undefined')module.exports=api;else root.XZJourney=api;
})(globalThis);
