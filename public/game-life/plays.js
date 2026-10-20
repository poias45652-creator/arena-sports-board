/* Short, read-only reenactments of actual manual decisions. No simulation or save writes. */
(function(root){
'use strict';
const esc=t=>String(t??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function snapshot(s,index){
 if(!s||s.retired||s.care?.active||!Number.isInteger(index))return null;
 const football=s.sport===1,phase=football?'football-moment':'arena-moment';if(s.phase!==phase)return null;
 const y=(football?s.football:s.arena)?.season,m=y?.moment?.match;if(!m)return null;
 const option=football?root.XZFootball.momentOptions(s)[index]:root.XZArena.momentOptions(s,m)[index];if(!option)return null;
 return{sport:s.sport,age:s.age,player:s.name,number:s.number,events:s.careerEvents,phase,kind:football?option[2]:option.kind,
  label:football?option[0]:option.label,mode:football?(['save','stop'].includes(option[2])?'defence':'offence'):m.mode,
  team:s.team,opponent:m.home===s.team?m.away:m.home,ownHome:m.home===s.team,outs:m.outs,bases:m.bases?[...m.bases]:null,
  time:football?`${y.moment.minute} 分鐘`:s.sport===0?`${m.inning} 局${m.half?'下':'上'}`:'關鍵回合'};
}
function result(before,s){
 if(!before||s.careerEvents!==before.events+1)return null;
 const h=(s.sport===1?s.football:s.arena)?.season?.highlight;if(!h||h.choice!==before.label||!Array.isArray(h.before)||!Array.isArray(h.after))return null;
 const score=a=>s.sport===1&&!before.ownHome?[a[1],a[0]]:[...a],from=score(h.before),to=score(h.after),gain=to[0]-from[0],lost=to[1]-from[1];
 let title,move=before.kind,outcome=h.success?'success':'failure',description=h.text||h.result;
 if(s.sport===0){
  const names={'一壘安打。':'single','二壘安打。':'double','全壘打。':'homer','四壞球保送。':'walk','三振。':'k','出局。':'out','滾地球處理。':'ground','犧牲推進。':'sac','封殺跑者。':'force'};
  outcome=names[h.result]||'out';title=h.result.replace(/。$/,'');
  if(outcome==='ground')title=before.bases?.[0]&&before.outs<2?'滾地雙殺':'滾地出局';
  if(outcome==='force'&&!before.bases?.[0])title='傳一壘出局';
  if(outcome==='homer')title='全壘打！';
  if(outcome==='walk')move='walk';
  else if(before.mode==='bat')move=before.kind==='bunt'?'bunt':'swing';
  else move=before.mode==='pitch'?'pitch':'field';
  description=before.mode==='bat'?'你的打席結果':before.mode==='pitch'?'這一球的投球結果':'這次守備結果';
 }else if(s.sport===1){
  title=before.kind==='safe'?'穩住球權，重新組織':h.success?({goal:'射門得分！',assist:'傳球到位，隊友破門！',build:'突破壓迫，向前推進',save:'撲救成功！',stop:'攔截成功，化解危機'})[before.kind]:before.mode==='defence'?'防線被突破，對方進球':'進攻被化解，再找機會';
 }else{
  title=h.success?({two:'切入得分！',three:'三分命中！',assist:'妙傳助攻，隊友得分！',mid:'中距離命中！',contain:'干擾成功，對手投失',steal:'抄截快攻，拿下兩分！',block:'封阻成功！',rebound:'保護籃板，守住球權'})[before.kind]:before.kind==='block'?`防守犯規 · 對手罰球得 ${lost} 分`:before.mode==='offence'?(before.kind==='assist'?'傳球被截，球權轉換':'出手未進，再找機會'):`防守被突破 · 對手得 ${lost} 分`;
 }
 return{kind:'play',title:title||'這次選擇，已有結果',detail:s.sport===0?`${description} · ${before.label}`:description,player:before.player,age:before.age,
  play:{...before,move,outcome,success:h.success,from,to,gain,lost,label:before.label}};
}
function scene(e){return root.XZStadium.play(e)}
const api={snapshot,result,scene};if(typeof module!=='undefined')module.exports=api;else root.XZPlays=api;
})(globalThis);
