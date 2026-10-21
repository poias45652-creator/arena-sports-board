/* Stronger choices apply only to newly drawn scenes; active legacy choices retain their rules. */
(function(root){
'use strict';
const H=typeof module!=='undefined'?require('./care.js'):root.XZCare;
function scale(raw,kind){if(!raw)return raw;const e=H.effects(raw),factor=kind==='risk'?2.5:kind==='cost'?1.5:1.8;
 const amount=(v,ability=false)=>!v?0:Math.sign(v)*Math.max(Math.abs(v),Math.min(ability?(kind==='risk'?10:5):(kind==='risk'?36:kind==='cost'?24:26),Math.round(Math.abs(v)*factor)));
 const out={...e};if(e.a)out.a=e.a.map(v=>amount(v,true));for(const k of ['energy','health','mood','morale'])if(Number.isFinite(e[k]))out[k]=amount(e[k]);return out;
}
function scene(event){if(!event||event.major)return event;return {...event,options:event.options.map(c=>{
 if(c.defer)return c;const risky=c.chance!==undefined,kind=c.approach==='collaborate'?'safe':'risk';
 const next={...c,effect:scale(c.effect,risky?'cost':'safe'),good:scale(c.good,kind),bad:scale(c.bad,kind)};
 const maps=[['effect','effect'],['good','good'],['bad','bad']].map(([a,b])=>[H.effects(c[a]),next[b]]);
 const rewrite=text=>typeof text!=='string'?text:text.replace(/(技術|體能|心理|防守|體力|健康|心情|士氣)(\s*)([+＋−-])(\d+)/g,(all,label,space,sign,n)=>{
 const key={體力:'energy',健康:'health',心情:'mood',士氣:'morale'}[label],index=['技術','體能','心理','防守'].indexOf(label),value=(sign==='+'||sign==='＋'?1:-1)*Number(n);
 for(const [old,now]of maps)if(now){const a=key?old[key]:old.a?.[index],b=key?now[key]:now.a?.[index];if(a===value&&Number.isFinite(b))return label+space+(b>0?'+':'')+b}return all});
 for(const key of ['hint','resultText','successText','failureText'])next[key]=rewrite(c[key]);
 return next;
 })};}
const api={scale,scene};if(typeof module!=='undefined')module.exports=api;else root.XZStakes=api;
})(globalThis);
