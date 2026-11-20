import {mountBoard,unmountBoard} from './inner.js';
import {predictionPanel,refreshMarkets} from './market.js';
import {teams} from './league.js';
import {groupMatchDays,hongKongDay,initialMatchDay,matchDayTitle,matchTime} from './match-days.js';
import {crests} from './team-crests.js';

const $=id=>document.getElementById(id);
const name=id=>teams[id][0];
const query=new URLSearchParams(location.search);
let view=({live:'scores',scores:'scores',overview:'overview',standings:'standings',analysis:'analysis'})[query.get('view')]||'analysis';
let today=hongKongDay();
let date=initialMatchDay(query,today),filter='all',selectedGame=query.get('game')||'';
let board=null, boardKey=null, loadingKey=null, errorKey=null, lastRequest=0, requestSequence=0;
const shortDay=day=>day.slice(5).replace('-','/');
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const timeLabel=value=>new Intl.DateTimeFormat('zh-TW',{timeZone:'Asia/Hong_Kong',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(value));
const body=$('body');
const images=id=>`<img class="football-team-logo" alt="" decoding="async" referrerpolicy="no-referrer" src="${crests[id]}">`;
document.addEventListener('error',e=>{if(e.target instanceof HTMLImageElement&&e.target.classList.contains('football-team-logo'))e.target.hidden=true;},true);
function team(id,side,day){const href='/teams/football/hkg.1/'+id+(day?'?date='+day:'');return `<div class="football-team"><small>${side}</small><a class="football-team-identity football-team-link" href="${href}" aria-label="查看${name(id)}球隊數據">${images(id)}<h3>${name(id)}</h3></a></div>`;}
function pitchButton(g){
 return `<button type="button" class="football-primary" data-pitch="${esc(g.id)}" data-day="${esc(g.day)}">查看即時球場</button>`;
}
function card(g){
  if(g.state!=='scheduled')return finishedCard(g);
  const m={id:g.id,home:g.home.id,away:g.away.id};
  const kickoff=g.timeConfirmed?Date.parse(g.start):0;
  return `<article class="football-card" id="match-${g.id}" aria-label="${name(m.home)}對${name(m.away)}">
    <div class="football-card-top"><span>未開賽</span><time datetime="${g.timeConfirmed?g.start:g.day}">${matchTime(g)}</time></div>
    <div class="football-match">${team(m.home,'主隊',g.day)}<b>VS</b>${team(m.away,'客隊',g.day)}</div><p class="football-venue">${esc(g.venue)}</p>
    ${pitchButton(g)}
    ${predictionPanel(m,kickoff)}
  </article>`;
}
function filtersMarkup(){
 return '<div class="football-filters" role="group" aria-label="足球賽事狀態">'+[['all','全部'],['scheduled','未開賽'],['live','進行中'],['final','已完場'],...(board?.games.some(g=>['pending','postponed','cancelled','unknown'].includes(g.state))?[['other','待確認／異動']]:[])].map(([k,v])=>`<button data-filter="${k}" aria-pressed="${filter===k}">${v}</button>`).join('')+'</div>';
}
function syncUrl(){
 const u=new URL(location.href); u.searchParams.set('view',view==='scores'?'live':view);
 if(date && (date!==today || selectedGame))u.searchParams.set('date',date);else u.searchParams.delete('date');
 u.searchParams.delete('range');
 if(selectedGame && view==='scores')u.searchParams.set('game',selectedGame);else u.searchParams.delete('game');
 history.replaceState(null,'',u);
 if(window.parent!==window)window.parent.postMessage({type:'hk-football-route',search:u.search},location.origin);
}
function navigate(next,game='',day=hongKongDay()){
 view=next;date=day;selectedGame=game;filter='all';render();window.scrollTo(0,0);
}
function finishedCard(g){
 return `<article class="football-card"><div class="football-card-top"><span>${esc(g.statusLabel)}</span><time datetime="${g.timeConfirmed?g.start:g.day}">${matchTime(g)}</time></div><div class="football-match">${teamKnown(g.home,'主隊',g.day,g.season)}<b>${g.homeScore??'—'} : ${g.awayScore??'—'}</b>${teamKnown(g.away,'客隊',g.day,g.season)}</div><p class="football-venue">${esc(g.venue)}</p>${pitchButton(g)}</article>`;
}
function teamKnown(t,side,day,season){
 return `<div class="football-team"><small>${side}</small><a class="football-team-identity football-team-link" href="/teams/football/hkg.1/${t.id}?date=${day}&amp;season=${season}">${crests[t.id]?images(t.id):''}<h3>${t.name}</h3></a></div>`;
}
async function loadDate(day,force=false){
 if(loadingKey===day||(!force&&(boardKey===day||errorKey===day)))return;
 loadingKey=day;errorKey=null;lastRequest=Date.now();const seq=++requestSequence;
 try{
   const params=new URLSearchParams({kind:'board'});
   if(day)params.set('date',day);else params.set('range','round');
   const res=await fetch('/api/hong-kong/football?'+params,{cache:'no-store'});
   if(!res.ok)throw Error();const updated=await res.json();
   if(seq!==requestSequence||day!==date)return;
   board=updated;boardKey=day;
   if(updated.sync==='snapshot'&&!force)setTimeout(()=>{if(day===date&&board?.sync==='snapshot'&&view!=='standings')loadDate(day,true);},14000);
 }catch{if(seq===requestSequence&&day===date)errorKey=day;}
 finally{if(seq===requestSequence){loadingKey=null;if(day===date)render(force);}}
}
function render(preserveScores=false){
 syncUrl();
 const keep=preserveScores&&view==='scores'&&document.getElementById('inner-board')&&boardKey===date;
 if(!keep)unmountBoard();
 const title={analysis:'賽前分析',scores:'賽事比分',standings:'戰績排名',overview:'概覽'};
 const ready=boardKey===date, games=ready?board.games:[];
 $('date').value=date;$('round').setAttribute('aria-pressed',String(!date));
 $('views').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===view)));
 $('page-title').textContent=title[view];
 $('dates').hidden=view==='standings';
 $('panel').dataset.footballView=view==='scores'?'live':view;
 $('panel').toggleAttribute('data-live-matchday',view==='scores'&&games.length>0);
 $('panel').querySelector('.football-toolbar').hidden=view==='standings';
 $('status').hidden=view==='standings';
 const days=games.map(g=>g.day).sort();
 const range=days.length?(days[0]===days.at(-1)?shortDay(days[0]):shortDay(days[0])+'–'+shortDay(days.at(-1))):'本輪';
 const sync=ready?({feed:'賽程核對',cached:'上次成功核對',snapshot:'離線快照',archive:'歷季資料'}[board.sync]||'資料更新')+' '+timeLabel(board.fetchedAt):'';
 $('status').innerHTML='<span>'+(date||range)+'・'+(ready?games.length+' 場賽事':'讀取賽事')+'</span><span>'+sync+'・香港／台灣時間</span>';
 if(view==='standings'){body.innerHTML='<div id="inner-board"></div>';mountBoard($('inner-board'),{view});return;}
 if(!ready){
   if(errorKey===date){body.innerHTML='<p role="alert">賽程讀取失敗。<button data-retry>重新載入</button></p>';return;}
   body.innerHTML='<p class="football-panel-empty">正在讀取賽事…</p>';loadDate(date);return;
 }
 if(keep){
   const container=body.querySelector('.football-filters');if(container)container.outerHTML=filtersMarkup();
   mountBoard($('inner-board'),{view,day:date,filter,selected:selectedGame,games,onNavigate:navigate});return;
 }
 body.innerHTML=(errorKey===date?'<p role="status">暫時無法更新，顯示上次取得的賽程。<button data-retry>重試</button></p>':'')+filtersMarkup()+'<div id="inner-board"></div>';
 if(view!=='analysis'){mountBoard($('inner-board'),{view,day:date,filter,selected:selectedGame,games,onNavigate:navigate});return;}
 const visible=games.filter(g=>filter==='all'||g.state===filter||filter==='other'&&['pending','postponed','cancelled','unknown'].includes(g.state));
 const sections=groupMatchDays(visible).map(({day,games:matches})=>`<section class="football-day-group" aria-labelledby="day-${day}"><h3 class="football-day-heading" id="day-${day}"><time datetime="${day}">${matchDayTitle(day)}</time><small>${matches.length} 場</small></h3><div class="football-games">${matches.map(card).join('')}</div></section>`);
 $('inner-board').innerHTML=sections.length?sections.join(''):'<div class="football-empty"><p>這個日期及篩選條件沒有收錄賽事。</p><button class="football-primary" data-reset>查看本輪賽事</button></div>';
 refreshMarkets();
}
document.addEventListener('click',e=>{
 const b=e.target.closest('button');if(!b)return;
 if(b.dataset.pitch){navigate('scores',b.dataset.pitch,b.dataset.day);return;}
 if(b.dataset.view){navigate(b.dataset.view);return;}
 if(b.dataset.filter){filter=b.dataset.filter;render();return;}
 if(b.hasAttribute('data-retry')){loadDate(date,true);return;}
 if(b.id==='prev'||b.id==='next'){
   const d=new Date((date||(boardKey===date&&board?.games[0]?.day)||hongKongDay())+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+(b.id==='next'?1:-1));date=d.toISOString().slice(0,10);
 } else if(b.id==='round'||b.hasAttribute('data-reset'))date='';else return;
 selectedGame='';filter='all';render();
});
$('date').addEventListener('change',e=>{date=e.target.value||hongKongDay();selectedGame='';filter='all';render();});
let midnightTimer;
function followLocalDay(){
 clearTimeout(midnightTimer);
 const now=new Date(),previous=today;
 today=hongKongDay(now);
 if(previous!==today && date===previous){
   date=today;selectedGame='';filter='all';render();
 }
 const midnight=Date.parse(today+'T00:00:00+08:00')+86400000;
 midnightTimer=setTimeout(followLocalDay,midnight-now.getTime());
}
function refreshVisibleBoard(){
 if(document.visibilityState!=='visible')return;
 followLocalDay();
 if(view!=='standings' && Date.now()-lastRequest>=(board?.games.some(g=>g.state==='live'||g.timeConfirmed&&Math.abs(Date.now()-Date.parse(g.start))<3*3600000)?15000:300000))loadDate(date,true);
}
window.addEventListener('online',()=>{if(view!=='standings')loadDate(date,true);});
document.addEventListener('visibilitychange',refreshVisibleBoard);
setInterval(refreshVisibleBoard,15000);
followLocalDay();
render();
