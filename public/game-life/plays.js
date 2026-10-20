/* Short, read-only reenactments of actual manual decisions. No simulation or save writes. */
(function(root){
'use strict';
const esc=t=>String(t??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function snapshot(s,index){
 if(!s||s.retired||s.care?.active||!Number.isInteger(index))return null;
 const football=s.sport===1,phase=football?'football-moment':'arena-moment';if(s.phase!==phase)return null;
 const y=(football?s.football:s.arena)?.season,m=y?.moment?.match;if(!m)return null;
 const option=football?root.XZFootball.momentOptions(s)[index]:root.XZArena.momentOptions(s,m)[index];if(!option)return null;
 return{sport:s.sport,age:s.age,player:s.name,events:s.careerEvents,phase,kind:football?option[2]:option.kind,
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
// Each point is in the scene's SVG coordinate system. The three sports use separate stages.
function path(points,cls=''){const d=points.map(([x,y],i)=>`${i?'L':'M'}${x} ${y}`).join(' ');return `<path class="play-trail ${cls}" d="${d}"/>`}
function ball(points,sport){return `<g class="play-ball" style="${points.map(([x,y],i)=>`--x${i}:${x}px;--y${i}:${y}px`).join(';')}"><circle r="${sport===0?6:9}"/>${sport===0?'<path d="M-3-4q5 4 0 8"/>':sport===1?'<path d="m0-5 5 4-2 6h-6l-2-6z"/>':'<path d="M-8 0H8M0-8V8M-5-7Q5 0-5 7"/>'}</g>`}
function person(x,y,cls='',extra=''){return `<g transform="translate(${x} ${y})"><g class="play-person ${cls}"><circle cy="-54" r="9"/><path class="play-body" d="M0-43v29m-18-14L0-37l20 12"/><path d="M0-14l-13 31"/><path class="play-leg" d="M0-14l17 31"/>${extra}</g></g>`}
function baseball(p){
 const field=p.mode==='field',hit=['single','double','homer'].includes(p.outcome),contact=hit||['out','ground','sac','force'].includes(p.outcome);
 let pts=field?[[80,75],[258,186],[335,155],[455,208]]:[[425,158],[163,170],[260,112],[460,66]];
 if(!field){if(p.outcome==='homer')pts=[[425,158],[163,170],[280,52],[525,18]];
  else if(p.outcome==='walk'||p.outcome==='k')pts=[[425,158],[280,171],[150,180],[112,191]];
  else if(!hit)pts=[[425,158],[163,170],[260,215],[350,202]];
 }else if(!p.success)pts=[[80,75],[258,186],[370,222],[520,237]];
 return `<path class="play-ground" d="M20 225Q280 158 540 225v55H20z"/><path class="play-line" d="M150 220l245-60 140 55M150 220l-90 45"/><ellipse class="play-mound" cx="422" cy="214" rx="32" ry="7"/><path class="play-base" d="m145 213 11-3 9 7-11 8zM450 212l9-7 10 7-10 7z"/>${field?
  person(282,197,`play-fielder ${p.kind==='dive'?'play-dive':''}`, '<path class="play-glove" d="m-20-26-12-6-4 12 15 5z"/>'):
  person(143,199,`${p.mode==='pitch'?'play-opponent':''} ${p.move==='walk'?'':p.move==='bunt'?'play-bunter':'play-batter'}`,`<g class="play-bat"><path d="m17-29-29-55"/></g>`)+person(416,189,`play-pitcher ${p.mode==='bat'?'play-opponent':''}`)}
 ${path(pts)}${ball(pts,0)}${contact&& !field?'<g class="play-impact" transform="translate(163 170)"><path d="M-17-6l-10-4M0-18v-13M17-6l10-4M0 14v9"/></g>':''}
 <text x="30" y="32" class="play-scene-label">${field?'接球 → 傳球':p.mode==='pitch'?'投球 → 判定':p.move==='walk'?'選球 → 上壘':'揮棒 → 擊球'}</text>`;
}
function football(p){
 const defence=p.mode==='defence',scored=p.gain>0||p.lost>0,pass=['assist','build','safe'].includes(p.kind);
 let pts=scored?[[181,214],[290,155],[400,128],[493,151]]:pass&&p.success?[[181,214],[250,210],[318,181],[379,190]]:[[181,214],[270,181],[344,166],[351,176]];
 if(defence&&!scored)pts=[[181,214],[290,155],[416,144],[430,157]];
 return `<path class="play-grass" d="M0 130h560v150H0z"/><path class="play-line" d="M20 249h520M315 130v102h220M382 130v58h153"/><g class="play-goal ${scored?'play-net-score':''}"><path d="M459 105h68v84h-68zM459 105l-18 18v66h18M441 123h68l18-18M509 123v66"/><path class="play-net" d="M476 105v84m17-84v84m17-84v84M459 125h68m-68 20h68m-68 20h68"/></g>
 ${person(148,197,`play-kicker ${defence?'play-opponent':''}`)}${person(defence?440:426,171,`${defence?'':'play-opponent'} ${defence&&p.kind==='save'?'play-keeper':'play-defender'}`)}${pass?person(319,195,'play-receiver'):''}
 ${path(pts)}${ball(pts,1)}${scored?'<g class="play-impact" transform="translate(490 151)"><circle r="21"/></g>':''}<text x="30" y="32" class="play-scene-label">${defence?(p.kind==='save'?'門前撲救':'封堵進攻'):pass?'傳球配合':'起腳射門'}</text>`;
}
function basketball(p){
 const defence=p.mode==='defence',scored=p.gain>0||p.lost>0,assist=p.kind==='assist';
 let pts=scored?[[175,164],[295,63],[446,101],[451,147]]:[[175,164],[295,63],[438,99],[370,215]];
 if(assist)pts=p.success?[[175,164],[302,191],[399,88],[451,147]]:[[175,164],[255,177],[330,183],[340,200]];
 if(defence&&p.success){if(p.kind==='block')pts=[[175,164],[295,63],[412,111],[310,217]];if(p.kind==='rebound')pts=[[175,164],[295,63],[438,99],[390,185]];if(p.kind==='steal')pts=[[175,164],[310,188],[397,84],[451,147]]}
 return `<path class="play-court" d="M0 161h560v119H0z"/><path class="play-line" d="M25 257h510M320 165l-35 76h225M342 168q-62 49 0 77M183 165q-54 50-31 92"/><path class="play-board" d="M471 58v61m0-37h-17v25h17m0 12v139"/><g class="play-hoop ${scored?'play-net-score':''}"><path d="M435 113h36m-34 1 8 30h13l10-30m-25 8h20m-17 10h14"/></g>
 ${person(153,200,`play-shooter ${defence?'play-opponent':''}`)}${person(405,195,`${defence?'':'play-opponent'} ${p.kind==='block'?'play-blocker':'play-defender'}`)}${assist?person(310,211,'play-receiver'):''}
 ${path(pts)}${ball(pts,2)}<text x="30" y="32" class="play-scene-label">${defence?({contain:'防守干擾',steal:'抄截 → 快攻',block:'起跳護框',rebound:'卡位 → 籃板'})[p.kind]:({two:'切入上籃',three:'三分出手',assist:'傳球助攻',mid:'中距離跳投'})[p.kind]}</text>`;
}
function scene(e){const p=e.play;return `<div class="play-arena" data-sport="${p.sport}" data-outcome="${esc(p.outcome)}" data-success="${p.success}"><svg viewBox="0 0 560 280" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path class="play-stands" d="M0 48h560v64H0zM0 70h560M0 92h560"/>${p.sport===0?baseball(p):p.sport===1?football(p):basketball(p)}</svg><div class="play-score"><span>${esc(p.team)}</span><b>${p.from[0]} : ${p.from[1]} <i>→</i> <strong>${p.to[0]} : ${p.to[1]}</strong></b><span>${esc(p.opponent)}</span></div><small class="play-caption">${esc(p.time)} · 本次選擇當下的比分 · 動作示意</small></div>`}
const api={snapshot,result,scene};if(typeof module!=='undefined')module.exports=api;else root.XZPlays=api;
})(globalThis);
