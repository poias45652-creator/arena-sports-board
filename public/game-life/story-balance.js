/* New scenes only: deterministic, visible trade-offs. Legacy active scenes stay intact. */
(function(root){
'use strict';
const keys=['a','energy','health','mood','morale'];
const names=['能力','體力','健康','心情','士氣'];
function hash(text){let n=2166136261;for(const ch of text)n=Math.imul(n^ch.charCodeAt(0),16777619);return n>>>0}
function withoutVitals(e={}){const copy={...e};for(const k of keys)delete copy[k];return copy}
function add(e,index,value){if(index===0)e.a=[value,value,value,value];else e[keys[index]]=value}
function bundle(original,primary,secondary,kind){
 const e={...withoutVitals(original),mood:0};
 // Permanent ability gains are smaller than recoverable condition changes.
 const amounts={safe:[1,5,1,3],team:[2,7,1,3],win:[3,10,1,5],lose:[-2,-10,-1,-5]}[kind];
 add(e,primary,amounts[primary===0?0:1]);add(e,secondary,amounts[secondary===0?2:3]);
 return e;
}
function scene(event,describe=()=>''){
 if(!event||!event.id.startsWith('v5-')||event.chainOnly)return event;
 const primary=hash(event.id)%5,secondary=(primary+1+hash(event.id+'echo')%4)%5;
 const options=event.options.map(c=>{
  if(c.defer)return c;
  const risky=c.chance!==undefined,team=c.approach==='collaborate';
  if(!risky)return {...c,label:'穩穩來 · '+c.label,effect:bundle(c.effect,primary,secondary,'safe'),hint:`穩健回報，著重${names[primary]}與${names[secondary]}。`};
  const effect=withoutVitals(c.effect);
  // A short commitment cost, not an automatic health/morale punishment.
  effect.energy=team?-8:-5;effect.mood=0;
  return {...c,label:(team?'一起扛 · ':'全力投入 · ')+c.label,effect,
   good:bundle(c.good,primary,secondary,team?'team':'win'),
   bad:bundle(c.bad,primary,secondary,team?'safe':'lose'),
   hint:`${team?'有人分擔，回報較小、失敗損失減半':'高風險高回報'}；這次主要牽動${names[primary]}與${names[secondary]}。`};
 });
 // Collaboration still has downside; it must never reward failure.
 for(const c of options)if(c.approach==='collaborate'){
  c.bad=bundle(c.bad,primary,secondary,'lose');
  for(const key of keys){if(key==='a'&&c.bad.a)c.bad.a=c.bad.a.map(n=>Math.ceil(n/2));else if(Number.isFinite(c.bad[key]))c.bad[key]=Math.ceil(c.bad[key]/2)}
 }
 for(const c of options)if(!c.defer){const extra=[['固定',c.effect],['成功',c.good],['失敗',c.bad]].map(([label,e])=>{const text=describe(withoutVitals(e));return text?label+'：'+text:''}).filter(Boolean);if(extra.length)c.hint+=' '+extra.join('；')}
 return {...event,options};
}
const api={scene};if(typeof module!=='undefined')module.exports=api;else root.XZStoryBalance=api;
})(globalThis);
