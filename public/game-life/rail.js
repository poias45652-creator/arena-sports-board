/* Context for the current chapter. Rendering and responsive moves never advance the game. */
(function(root){
'use strict';
const esc=t=>String(t??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const club=(s,id)=>esc(root.XZClubWorld?.name(s.sport,id)??id);
const number=n=>Number.isFinite(n)?Math.round(n).toLocaleString('zh-TW'):'—';
function season(s){const y=(s.sport===1?s.football:s.arena)?.season;return y?.age===s.age&&Array.isArray(y.table)&&y.table.length?y:null}
function standings(s,y){
 const football=s.sport===1,rows=(football?root.XZFootball:root.XZArena).sortedTable(y),own=rows.find(r=>r.team===y.team),rank=rows.findIndex(r=>r.team===y.team)+1;
 return `<section class="rail-standings" aria-label="本季排名"><div class="rail-section-heading"><b>${y.complete?'本季最終排名':'本季排名'}</b><span>${own?.played?`目前第 ${rank} 名`:'尚無完賽'}</span></div><table><thead><tr><th scope="col">排名</th><th scope="col">球隊</th><th scope="col">${football?'勝／和／負':'勝／負'}</th><th scope="col">${football?'積分':'勝率'}</th></tr></thead><tbody>${rows.map((r,i)=>`<tr class="${r.team===y.team?'your-club':''}"><td>${r.played?i+1:'—'}</td><th scope="row">${club(s,r.team)}${r.team===y.team?'<small>我方</small>':''}</th><td>${r.w}${football?'／'+r.d:''}／${r.l}</td><td>${football?r.points:r.played?(r.w/r.played).toFixed(3):'—'}</td></tr>`).join('')}</tbody></table><p class="rail-note">${y.complete?'本季賽果已結算。':'只計入已完賽場次；眼前這場結束後更新。'}${football?'勝 3 分、和 1 分。':'例行賽前四名晉級季後賽。'}</p></section>`;
}
function personal(s){
 const family=s.family,child=family?.child,separated=s.romance?.bond==='separated',strained=s.romance?.bond==='strained';
 const relationship=separated?'已分開':strained?'關係緊繃':({dating:'交往中',married:'已婚',parent:'一起育兒'})[family?.stage];
 return `<section class="rail-personal" aria-label="球場之外"><div class="rail-section-heading"><b>球場之外</b><span>${s.age} 歲${s.lineage?' · 第 '+s.lineage.generation+' 代':''}</span></div>${relationship&&family?.partner?`<p><span>${relationship}</span><b>${esc(family.partner)}</b></p>`:''}${child?`<p><span>孩子 · ${Math.max(0,s.age-child.bornAt)} 歲</span><b>${esc(child.name)}</b></p>`:''}<blockquote>${esc(root.XZFocus.memory(s))}</blockquote></section>`;
}
function career(s){
 const history=(s.history||[]).slice(0,3);
 return `<section class="rail-career" aria-label="生涯足跡"><div class="rail-section-heading"><b>生涯足跡</b><span>${s.retired?'已留下的故事':'每一季，都算數'}</span></div><div class="rail-career-metrics"><div><b>${number(s.history?.length||0)}</b><span>完成球季</span></div><div><b>${number(s.peak)}</b><span>最高能力</span></div><div><b>${number(s.proCups||0)}</b><span>職業冠軍</span></div></div>${history.length?`<ol class="rail-memories">${history.map(h=>`<li><span>${h.age} 歲</span><div><b>${club(s,h.team)}</b><small>能力 ${number(h.o)} · ${h.cup?'冠軍賽季':h.award?'個人榮譽':h.inj?'走過傷病':'完成球季'}</small></div></li>`).join('')}</ol>`:`<p class="rail-note">第一季正在寫下，完成後會留下球隊、能力與賽季紀錄。</p>`}</section>`;
}
function context(s){
 const y=season(s),match=/^(arena|football)-(moment|highlight)$/.test(s.phase)&&!s.care?.active&&!s.retired;
 return `<section class="rail-context" aria-label="${match?'戰況與本季排名':y?'本季戰績與近況':'生涯近況'}"><div class="rail-heading"><span class="rail-context-label">${y?'本季戰績':'生涯近況'}</span>${match?'<span class="rail-live-label">本場戰況</span>':''}<small>${2026+s.age-16} 賽季</small></div><div class="rail-score-slot"></div><div class="rail-title-slot"></div>${y?standings(s,y):career(s)}${match?'':personal(s)}</section>`;
}
let mountedStage=null,moves=[];
function arrange(host,wide=root.matchMedia?.('(min-width: 1100px)')?.matches){
 if(!host?.querySelectorAll)return;
 const stage=host.querySelector('.focus-stage'),rail=host.querySelector('.rail-context');
 if(!stage)return;
 if(stage!==mountedStage){
  mountedStage=stage;moves=[];
  if(rail)for(const node of stage.querySelectorAll(':scope > .football-scoreboard, :scope > .match-chase, :scope > .match-earned')){
   const anchor=root.document.createComment('match-panel-position');node.before(anchor);moves.push({node,anchor,slot:node.classList.contains('football-scoreboard')?'.rail-score-slot':'.rail-title-slot'});
  }
 }
 for(const {node,anchor,slot} of moves){if(wide&&rail)rail.querySelector(slot).appendChild(node);else anchor.after(node)}
}
root.XZRail={context,arrange};
})(globalThis);
