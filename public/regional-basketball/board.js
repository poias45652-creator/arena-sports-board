import {syncLocation,scrollBoardTop,publishRecommendations} from './shell-bridge.js';
import {$,e,shift,today,validDay,key,stamp,timeTW,readStore,writeStore,getJson,tabBtn,link,teamFor,name,empty} from './shared.js';
import {assistantPanel} from './assistant.js';
import {overview,liveCenter} from './live-ui.js';
import {teamProfile,playerProfile,teams,standings} from './profiles.js';
import {analysis,weightsForm,storeWeights,singleGameRecommendations} from './analysis-ui.js';
const nav={overview:'概覽',live:'即時比分',analysis:'賽前分析',standings:'戰績排名',teams:'球隊一覽'};
const s={projections:new Map(),saved:{},version:0,boxSide:'away',boxMore:false,playPeriod:'all',playLimit:60,filter:'all',asyncId:0,detailBusy:false};
const memo=new Map(),cacheFetch=(url)=>{if(!memo.has(url))memo.set(url,getJson(url).catch(err=>{memo.delete(url);throw err}));return memo.get(url);};
const api=(kind,params={})=>'/api/regional-basketball/'+kind+'?'+new URLSearchParams({league:s.league,...params});
let token=0,refreshToken=0,detailsToken=0,rankToken=0,contextTime=0,historyTime=0,extraContext=null;
const modal=$('modal');
function adoptRoute(){
 const p=new URLSearchParams(location.search);s.league=p.get('league')==='KBL'?'KBL':'NBL';s.reference=false;const route=p.get('view');s.view=route==='games'?'live':Object.hasOwn(nav,route)?route:'overview';
 if(s.reference)s.view='teams';
 s.date=validDay(p.get('date'))?p.get('date'):today();s.selected=p.get('game')||'';s.teamCode=p.get('team')||'';s.playerId=p.get('player')||'';s.teamView=p.get('section')||'summary';
 s.playerTab=['overview','history','games'].includes(p.get('tab'))?p.get('tab'):'overview';s.playerYear=p.get('year')||'';s.playerRecord=p.get('range')||'';
 s.venue=p.get('venue')||'all';s.teamYear=p.get('teamYear')||'';s.teamPhase=p.get('teamPhase')||2;s.teamLimit=p.get('limit')||0;
 s.rankSeason=Number(p.get('season'))||null;s.phase=[1,2,3].includes(Number(p.get('phase')))?Number(p.get('phase')):2;s.filter='all';
}
function route(){
 const p=new URLSearchParams({league:s.league,view:s.view});if(s.date!==today())p.set('date',s.date);if(s.selected&&['live','analysis'].includes(s.view))p.set('game',s.selected);
 if(s.teamCode){p.set('team',s.teamCode);p.set('section',s.teamView);if(s.playerId)p.set('player',s.playerId);}
 if(s.playerId){if(s.playerTab!=='overview')p.set('tab',s.playerTab);if(s.playerYear)p.set('year',s.playerYear);if(s.playerRecord)p.set('range',s.playerRecord);}
 if(s.teamCode&&!s.playerId){if(s.teamYear)p.set('teamYear',s.teamYear);if(s.teamPhase!=2)p.set('teamPhase',s.teamPhase);if(s.venue&&s.venue!=='all')p.set('venue',s.venue);if(s.teamLimit>0)p.set('limit',s.teamLimit);}
 if(s.view==='standings'){if(s.rankSeason!==s.seasonEnd)p.set('season',s.rankSeason);if(s.phase!==2)p.set('phase',s.phase);}
 const url=location.pathname+'?'+p;if(location.pathname+location.search!==url){window.history.replaceState({},'',url);syncLocation();}
}
function merge(games,extra,overwrite=true){
 const merged=new Map(games.map(g=>[key(g),g]));
 for(const g of extra||[]){if(!g.date||!g.home||!g.away)continue;const prev=merged.get(key(g));if(!overwrite&&prev)continue;
  if(prev?.status==='final'&&g.status!=='final')continue;
  if(prev?.status==='in_progress'&&(['scheduled','fixture'].includes(g.status)||g.status==='in_progress'&&g.homeScore+g.awayScore<prev.homeScore+prev.awayScore))continue;
  merged.set(key(g),{...prev,...g});}
 return [...merged.values()].sort((a,b)=>stamp(a)-stamp(b));
}
function select(){
 s.games=s.all.filter(g=>g.date===s.date);s.visible=s.games.filter(g=>s.filter==='all'||g.status===s.filter||s.filter==='scheduled'&&g.status==='fixture');
 s.game=s.visible.find(g=>String(g.id)===s.selected||g.espnId===s.selected||g.home===s.selected||g.officialId===s.selected)||
 (s.view==='analysis'?s.visible.find(g=>stamp(g)>Date.now()):s.visible.find(g=>g.status==='in_progress'))||s.visible[0];
}
function setupShell(){
 document.querySelector('main.nba-board').dataset.superLeague=s.league;
 $('breadcrumb').textContent='籃球・'+s.league+' '+s.info.name;
 document.querySelector('.header-assistant').hidden=s.reference;
 document.title=s.league+' '+s.info.name+'｜星準籃球';
 $('league-title').textContent=s.league;$('league-name').textContent=s.info.name;$('league-en').textContent='全場分析・含延長賽';$('season').textContent=s.info.season+' SEASON';
 document.querySelector('.hero-stats').innerHTML='<div><strong id="ng">—</strong><span>當日賽事</span></div><div><strong id="nl">—</strong><span>進行中</span></div><div><strong>'+s.info.teams.length+'</strong><span>聯盟球隊</span></div>';
 document.querySelector('.snapshot').outerHTML='<button class="date-btn snapshot" data-weights>☷　模型比例</button>';
 document.querySelector('.snapshot').hidden=s.reference;
 const tools=document.querySelector('.tools');if(!tools.querySelector('[data-refresh]'))tools.insertAdjacentHTML('afterbegin','<button class="refresh" data-refresh>⟳　立即更新</button>');
}
function toolbar(){
 if(s.teamCode||!['overview','live','analysis'].includes(s.view))return '';
 const now=today();
 const heading=new Intl.DateTimeFormat('zh-TW',{timeZone:'Asia/Taipei',month:'long',day:'numeric',weekday:'long'}).format(new Date(s.date+'T12:00:00+08:00'));
 return '<div class="nba-toolbar"><div><h2>'+e(heading)+'</h2><small>台灣時間 UTC+8</small></div><div class="nba-date"><button data-shift="-1" aria-label="前一天">←</button><label><input aria-label="比賽日期" type="date" id="pick-day" value="'+s.date+'" min="'+shift(now,-365)+'" max="'+shift(now,365)+'"></label><button data-shift="1" aria-label="後一天">→</button><button data-today>今天</button></div></div><div class="nba-board-meta"><div class="nba-filters" role="group" aria-label="賽事狀態">'+[['all','全部'],['scheduled','未開賽'],['in_progress','進行中'],['final','已完賽']].map(([v,l])=>'<button data-filter="'+v+'" aria-pressed="'+(v===s.filter)+'">'+l+'<span>'+(v==='all'?s.games.length:s.games.filter(g=>g.status===v||(v==='scheduled'&&g.status==='fixture')).length)+'</span></button>').join('')+'</div></div>';
}
function paint(){
 if(!s.info)return;select();
 document.body.classList.toggle('profile-open',!!s.teamCode);
 document.body.classList.toggle('xz-theme',!s.teamCode||!!s.playerId);
 document.body.dataset.boardView=s.view;
 $('viewbar').innerHTML=(s.reference?[['live','賽程與比分'],['teams','球隊一覽']]:Object.entries(nav)).map(([k,l])=>'<button class="view" data-view="'+k+'" aria-pressed="'+(s.view===k)+'">'+l+'</button>').join('');
 $('ng').textContent=s.games.length||s.isLive||s.archiveDate?s.games.length:'—';$('nl').textContent=s.isLive?s.games.filter(g=>g.status==='in_progress').length:'—';
 const meta=s.isLive?'連線更新 '+timeTW(s.asOf):s.archiveDate?'保存資料 '+timeTW(s.asOf):s.busy?'正在更新賽程':'尚無已核實資料';
 $('footer-note').textContent=meta+'　／　台灣時間';
 const views={overview,live:liveCenter,analysis,standings,teams};
 const body=s.playerId?playerProfile(s):s.teamCode?teamProfile(s):views[s.view](s);
 const pane=$('content'),open=new Set([...pane.querySelectorAll('details[open][data-persist]')].map(x=>x.dataset.persist));
 const scrolls=new Map([...pane.querySelectorAll('[data-scroll]')].map(x=>[x.dataset.scroll,x.scrollLeft]));
 pane.innerHTML=toolbar()+(!s.teamCode&&s.notice?'<div class="message" role="status">'+e(s.notice)+'</div>':'')+body;
 const showPicks=s.view==='analysis'&&!s.teamCode&&!s.playerId&&s.visible.length>0;
 publishRecommendations(s.date,showPicks,showPicks?singleGameRecommendations(s):[]);
 for(const el of pane.querySelectorAll('details[data-persist]'))el.open=open.has(el.dataset.persist);
 for(const el of pane.querySelectorAll('[data-scroll]'))el.scrollLeft=scrolls.get(el.dataset.scroll)||0;
 if(location.hash&&!s.jumped&&s.rostersLoaded){
  const target=document.getElementById(location.hash.slice(1));
  if(target){s.jumped=true;requestAnimationFrame(()=>document.getElementById(location.hash.slice(1))?.scrollIntoView());}
 }
}
function showSources(){
 const links=s.info.sources||[];modalBody('<div class="dialog-inner"><button class="close" aria-label="關閉">×</button><span class="dtag">'+s.league+'</span><h2>資料來源</h2><ul class="source-list">'+links.map((url,i)=>'<li>'+link(url,(s.league==='KBL'?['球隊名單','官方賽程','官方排名']:['官方聯盟','官方排名','官方賽程'])[i]||'來源')+'</li>').join('')+(s.league==='NBL'?'<li>'+link('https://schedule.nbl.com.au/nbl','NBL Game Centre')+'</li>':'')+'</ul><p class="dsub">場中每 30 秒重新核對比分。球員場均資料日期顯示於球員頁，盤口及傷停另列各自來源。</p></div>');
}
function modalBody(html){modal.innerHTML=html;if(!modal.open)modal.showModal();modal.querySelector('.close')?.focus();}
async function loadLeague(){
 const id=++token;++refreshToken;++detailsToken;++rankToken;
 s.busy=true;s.fallback=null;s.info=s.catalog[s.league];const lc=s.league.toLowerCase();
 s.seasonEnd=Number(s.info.season.slice(0,4))+(s.league==='WNBA'?0:1);s.rankSeason=s.rankSeason||s.seasonEnd;s.currentRanking=s.info.standings;s.ranking=s.currentRanking;s.rankSource=s.info.sources[s.league==='KBL'?2:1];s.rankLabel='已保存排名';s.rankNote='';s.rankSeries=[];s.rankBusy=false;s.detail=null;s.detailBusy=false;s.detailError=false;s.detailKey='';s.isLive=false;s.notice='';
 s.all=[...s.info.games];s.rosterTimes={};s.rosterTimestamps={};s.playerTimes={};s.peopleIndex={};s.playerFiles={};s.playerFileLoading=new Set();s.teamGames=[];s.extras={};s.aliases={};s.rankArchive={};s.detailIndex={};s.jumped=false;s.activeRosterSeason=s.info.season;s.rostersLoaded=false;s.rosters={};s.boxes=[];s.context={markets:[],injuries:[]};s.frozen={};s.busy=true;s.asOf=s.info.asOf?.length>10?s.info.asOf:'2026-11-07T00:00:00+08:00';s.archiveDate=s.all.some(g=>g.date===s.date);s.baseAsOf=s.asOf;s.baseRankAsOf=s.info.standingsThrough||s.asOf;s.projections.clear();s.teamCode=teamFor(s,s.teamCode)?s.teamCode:'';s.boxMore=false;s.version++;contextTime=0;historyTime=0;extraContext=null;
 setupShell();paint();
 const jobs=['/api/regional-basketball/data/'+lc+'-players.json','/api/regional-basketball/data/'+lc+'-boxes.json','/api/regional-basketball/data/context.json','/api/regional-basketball/data/pregame.json','/api/regional-basketball/data/'+lc+'-fallback.json','/api/regional-basketball/data/'+lc+'-index.json','/api/regional-basketball/data/'+lc+'-team-games.json','/api/regional-basketball/data/'+lc+'-detail-index.json','/api/regional-basketball/data/rankings-'+lc+'.json','/api/regional-basketball/data/'+lc+'-extra-players.json'];
 const res=await Promise.allSettled(jobs.map(cacheFetch));if(id!==token)return;
 const [people,boxes,cx,frozen,fallback,peopleIndex,teamGames,detailIndex,rankArchive,extra]=res.map(v=>v.value);
 s.detailIndex=detailIndex||{};s.rankArchive=rankArchive||{};s.extras=extra?.teams||people?.formerPlayers||{};s.aliases=extra?.aliases||{};
 s.peopleIndex=peopleIndex||{};s.teamGames=teamGames||[];s.rostersLoaded=!!people;s.rosters=people?.teams||{};s.playerAsOf=people?.asOf||'';s.boxes=boxes||[];s.baseContext=cx||{markets:[],injuries:[]};s.context={...s.baseContext,injuries:s.baseContext.injuries.map(i=>({...i,checkedAt:s.baseContext.checkedAt}))};s.frozen=frozen?.[s.league]||{};s.fallback=fallback||{feeds:{},details:{},rankings:{}};
 for(const feed of Object.values(s.fallback.feeds||{}))s.all=merge(s.all,feed.games);
 s.all=merge(s.all,s.teamGames.filter(g=>g.season===s.seasonEnd));

 s.all=merge(s.all,Object.values(s.detailIndex).map(g=>({...g,officialId:g.officialId||g.id})));
 const stage=s.rankArchive?.[s.rankSeason]?.[s.phase];
 if(stage){s.ranking=stage.rows;s.rankSource=stage.url;s.rankLabel='更新 '+timeTW(stage.asOf);s.rankSeries=stage.series||[];}
 const f=s.fallback.feeds?.[s.date];if(f?.asOf){s.asOf=f.asOf;s.baseAsOf=f.asOf;}
 s.archiveDate=s.all.some(g=>g.date===s.date)||!!f;s.version++;paint();loadDetail();if(s.playerId)loadPlayerFile(s.playerId);refresh();
}
function decodeDetail(d){
 if(!d?.playColumns)return d;
 const {playColumns,plays,...rest}=d;
 return {...rest,plays:plays.map(row=>Object.fromEntries(playColumns.map((k,i)=>[k,row[i]])))};
}
function betterDetail(a,b){
 if(!a)return b;if(!b)return a;
 if(a.status!==b.status&&[a.status,b.status].includes('final'))return a.status==='final'?a:b;
 if(a.status==='final'&&a.quality?.scoreVerified!==b.quality?.scoreVerified&&[a.quality?.scoreVerified,b.quality?.scoreVerified].includes(true))return a.quality?.scoreVerified?a:b;
 const score=v=>(v.homeScore??0)+(v.awayScore??0);
 if(score(a)!==score(b))return score(a)>score(b)?a:b;
 return (b.plays?.length||0)>=(a.plays?.length||0)?b:a;
}
function loadDetail(force=false){
 if(s.view!=='live'||s.teamCode)return;
 const g=s.game;if(!g||['scheduled','fixture'].includes(g.status)){s.detail=null;s.detailBusy=false;return;}
 const dk=key(g),entry=s.detailIndex?.[dk],ids=[entry?.id,g.officialId,g.id].filter(Boolean);
 if(!ids.length||s.detailKey===dk&&(s.detailBusy||(!force&&s.detail)))return;
 const old=s.detailKey===dk?s.detail:null;
 s.detailKey=dk;s.detail=old||ids.map(id=>s.fallback?.details?.[id]).find(Boolean)||null;s.detailBusy=true;s.detailError=false;const n=++detailsToken;
 const jobs=[getJson(api('detail',{id:ids[0]}),19000)];
 if(entry)jobs.push(cacheFetch('/api/regional-basketball/data/details/'+s.league.toLowerCase()+'/'+encodeURIComponent(entry.id)+'.json').then(decodeDetail));
 Promise.allSettled(jobs.map(job=>job.then(d=>{
  if(n!==detailsToken||key(s.game||{})!==dk||d.home!==g.home||d.away!==g.away||(d.date&&d.date!==g.date))return;
  s.detail=betterDetail(s.detail,{...d,date:d.date||g.date});paint();
 }))).then(()=>{if(n!==detailsToken)return;s.detailBusy=false;s.detailError=!s.detail;paint();});
}
function adoptRank(online,stage){
 const rows=online?.standings||[],cached=stage?.rows||[];
 if(!rows.length)return cached;
 if(!cached.length)return rows;
 const total=a=>a.reduce((n,r)=>n+r.wins+r.losses,0);
 if(total(rows)<=total(cached))return cached;
 return rows.map(r=>{const saved=cached.find(v=>v.team===(r.team||r.code));return saved&&saved.wins===r.wins&&saved.losses===r.losses?{...saved,...r}:r});
}
async function rank(){
 const n=++rankToken,y=s.rankSeason,p=s.phase,stage=s.rankArchive?.[y]?.[p],fb=s.fallback?.rankings?.[y]?.[p],current=y===s.seasonEnd&&p===2;
 s.ranking=stage?.rows||fb?.standings||(current?s.currentRanking:[]);s.rankSeries=stage?.series||fb?.series||[];s.rankSource=stage?.url||s.info.sources[s.league==='KBL'?2:1];s.rankLabel=stage?.asOf?'更新 '+timeTW(stage.asOf):'已保存排名';s.rankBusy=true;s.rankNote='';paint();
 if(stage&&y<s.seasonEnd){s.rankBusy=false;paint();return;}
 try{const v=await getJson(api('standings',{season:y,phase:p}),14000);if(n!==rankToken)return;
  s.ranking=adoptRank(v,stage);if(v.series?.length)s.rankSeries=v.series;
  if(s.ranking!==stage?.rows){s.rankLabel='更新 '+timeTW(v.asOf);s.rankSource=v.url||v.source||s.rankSource;}
  s.rankNote=v.note||'';if(current&&s.ranking.length)s.currentRanking=s.ranking;
 }catch{if(n===rankToken)s.rankNote='尚無可核實的排名。';}
 finally{if(n===rankToken){s.rankBusy=false;paint();}}
}
async function roster(code,id=token){
 if(s.reference||!code||!teamFor(s,code)||Date.now()-(s.rosterTimes[code]||0)<360000)return;
 s.rosterTimes[code]=Date.now();
 try{
  const result=await getJson(api('roster',{team:code}),21000);
  if(id!==token||!Array.isArray(result.players)||!result.players.length)return;
  const old=new Map((s.rosters[code]||[]).map(p=>[String(p.id),p]));
  s.rosters[code]=result.players.map(p=>{const prev=old.get(String(p.id))||{};const lower=p.gp!=null&&prev.gp!=null&&p.gp<prev.gp&&result.season?.slice(0,4)===s.info.season.slice(0,4);
   const stats=lower?Object.fromEntries(['gp','pts','reb','ast','min','blk','stl','tov','fgPct','threePct','ftPct','gameLog'].map(k=>[k,prev[k]])):{};
   const priorLogs=prev.gameLog||[],freshLogs=p.gameLog||[];
   const sameGame=new Map(priorLogs.map(x=>[x.date+'/'+x.opp,x]));
   const gameLog=freshLogs.length>=priorLogs.length?freshLogs.map(x=>({...sameGame.get(x.date+'/'+x.opp),...x})):priorLogs;
   return {...prev,...Object.fromEntries(Object.entries(p).filter(([,v])=>v!=null&&v!=='')),gameLog,...stats,id:String(p.id),photo:prev.photo||p.photo||null};});
  if(result.season?.slice(0,4)===s.activeRosterSeason?.slice(0,4)){
   const currentIds=new Set(s.rosters[code].map(p=>p.id));
   const saved=new Map((s.extras[code]||[]).map(p=>[String(p.id),p]));
   for(const [pid,p] of old)if(!currentIds.has(pid)&&!saved.has(pid)){
    saved.set(pid,{...p,rosterStatus:p.gp>0?'historical_appearance':'season_registration'});
   }
   s.extras[code]=[...saved.values()];
  }
  if(result.statsComplete!==false)s.rosterTimestamps[code]=result.statsThrough||result.asOf;s.version++;
  if(s.teamCode===code||s.view==='analysis')paint();
 }catch{}
}
async function loadPlayerFile(id){
 if(!id||s.playerFiles[id]||s.playerFileLoading.has(id))return;
 const generation=token;s.playerFileLoading.add(id);
 try{const b=await cacheFetch('/api/regional-basketball/data/profiles/'+s.league.toLowerCase()+'/'+encodeURIComponent(id)+'.json');if(generation!==token)return;
 s.playerFiles[id]=b;if(s.playerId===id)paint();
 }catch{}finally{if(generation===token)s.playerFileLoading.delete(id);}
}
async function playerLog(id,code){
 if(!id||s.league!=='KBL'||Date.now()-(s.playerTimes[id]||0)<300000)return;
 s.playerTimes[id]=Date.now();const n=token;
 try{
  const v=await getJson(api('player',{player:id}),17000);if(n!==token||!Array.isArray(v.gameLog))return;
  const p=s.rosters[code]?.find(x=>String(x.id)===id);if(p&&v.gameLog.length>=(p.gameLog||[]).length){const detailed=new Map((p.gameLog||[]).map(x=>[x.date+'/'+x.opp,x]));p.gameLog=v.gameLog.map(x=>({...detailed.get(x.date+'/'+x.opp),...x}));s.version++;if(s.playerId===id)paint();}
 }catch{}
}
async function history(id){
 if(s.reference||Date.now()-historyTime<90000)return;historyTime=Date.now();
 const end=s.date>today()?today():s.date;
 try{
  const h=await getJson(api('history',{from:shift(end,-85),to:shift(end,10)}),21000);if(id!==token)return;
  const changed=merge(s.all,h.games,false);s.all=changed.map(g=>{const hit=h.games.find(x=>key(x)===key(g));return hit&&(!g.id||(g.status!=='final'&&hit.status==='final'))?{...g,...hit}:g;});
  s.version++;select();
  const known=new Set(s.boxes.map(key));const pending=s.all.filter(g=>g.status==='final'&&g.phase!==1&&g.id&&!known.has(key(g))).sort((a,b)=>stamp(b)-stamp(a)).slice(0,75);
  for(let i=0;i<pending.length&&id===token;i+=5){
   const item=await getJson(api('boxes',{ids:pending.slice(i,i+5).map(g=>g.officialId||g.id).join(',')}),22000);if(id!==token)return;s.boxes.push(...item.boxes);s.version++;
  }
  if(id===token)paint();
 }catch{}
}
async function context(id){
 if(Date.now()-contextTime<90000)return;contextTime=Date.now();try{
 const v=await getJson(api('context'),17000);if(id!==token)return;extraContext=v;
 s.context={...s.baseContext,markets:[...(v.markets||[]),...s.baseContext.markets],injuries:[...s.baseContext.injuries.map(i=>({...i,checkedAt:s.baseContext.checkedAt})),...(v.injuries||[])]};
 s.version++;if(s.view==='analysis')paint();
 }catch{}
}
async function refresh(){
 if(s.reference||!s.fallback)return;
 const n=++refreshToken,id=token,day=s.date;s.busy=true;
 const fallback=s.fallback.feeds?.[day];
 if(fallback&&!s.isLive){s.asOf=fallback.asOf;s.archiveDate=true;}
 if(s.view==='standings')rank();if(s.teamCode){roster(s.teamCode);if(s.playerId)playerLog(s.playerId,s.teamCode);}
 if(s.view==='analysis'){context(id);history(id);select();for(const code of new Set(s.visible.flatMap(g=>[g.home,g.away])))roster(code);}else if(s.view==='teams'||s.view==='standings')history(id);
 try{
 const f=await getJson(api('feed',{date:day}),22000);if(n!==refreshToken||id!==token||day!==s.date)return;
 if(!Array.isArray(f.games)||f.date!==day)throw Error('日期不符');
 s.all=merge(s.all,f.games.map(g=>({...g,officialId:g.officialId||s.detailIndex?.[key(g)]?.id||s.all.find(x=>key(x)===key(g))?.officialId})));s.busy=false;s.isLive=true;s.archiveDate=false;s.asOf=f.asOf;s.notice='';
 if(f.standings?.length){s.currentRanking=f.standings;if(s.rankSeason===s.seasonEnd&&s.phase===2)s.ranking=adoptRank({standings:f.standings},s.rankArchive?.[s.rankSeason]?.[2]);}
 s.version++;select();loadDetail(true);paint();
 }catch{
 if(n!==refreshToken||id!==token)return;s.isLive=false;s.busy=false;s.notice=s.all.some(g=>g.date===day)?'即時來源暫未回應，顯示最近一次已核實的資料。':'即時來源暫未回應，此日期暫無可用資料。';select();loadDetail(true);paint();
 }
}
function setDate(value){
 if(!validDay(value)||value<shift(today(),-365)||value>shift(today(),365))return;
 ++detailsToken;s.date=value;s.selected='';s.detail=null;s.detailKey='';s.filter='all';s.isLive=false;s.busy=true;s.archiveDate=s.all.some(g=>g.date===value);s.asOf=s.fallback.feeds?.[value]?.asOf||s.baseAsOf;s.notice='';s.playPeriod='all';s.playLimit=60;s.boxSide='away';historyTime=0;route();paint();loadDetail();refresh();
}
async function nextDay(){
 const id=token,from=s.date;s.notice='正在查詢下一個比賽日…';paint();
 for(let i=1;i<=21;i++){
  if(id!==token||from!==s.date)return;
  const d=shift(from,i);if(s.all.some(g=>g.date===d)){s.notice='';setDate(d);return;}
  try{const f=await getJson(api('feed',{date:d}),8000);if(id!==token||from!==s.date)return;if(f.games.length){s.all=merge(s.all,f.games);s.notice='';setDate(d);return;}}catch{break;}
 }
 if(id===token&&from===s.date){s.notice='目前查不到下一個已公布的比賽日。';paint();}
}
function showView(v){s.view=v;s.teamCode='';s.playerId='';s.selected='';s.filter='all';s.playPeriod='all';s.playLimit=60;s.notice='';route();paint();if(v==='standings'){rank();history(token);}if(v==='live'){loadDetail();paint();}if(v==='analysis'){context(token);history(token);}if(v==='teams')history(token);}
function showGame(v){++detailsToken;s.selected=v;s.detail=null;s.detailKey='';s.playPeriod='all';s.playLimit=60;s.boxSide='away';route();paint();if(s.view==='live'){loadDetail();paint();}}
function onClick(evt){
 const b=evt.target.closest('button,a[data-roster],a[data-team],a[data-player],a[data-backteams],a[data-backroster]');if(!b)return;
 if(b.tagName==='A'){if(evt.metaKey||evt.ctrlKey||evt.shiftKey||evt.altKey)return;evt.preventDefault();}
 const d=b.dataset;
 if(d.slides){const el=document.querySelector('.game-strip-scroll');el?.scrollBy({left:el.clientWidth*Number(d.slides)*.8,behavior:'smooth'});return;}
 if(d.roster){s.teamCode=d.roster;s.teamView='roster';s.playerId='';s.view='teams';route();paint();roster(d.roster);scrollBoardTop();return;}
 if(d.rankrefresh!==undefined){rank();return;}
 if(d.detailrefresh!==undefined){loadDetail(true);refresh();return;}
 if(d.league){if(d.league===s.league)return;location.href='?league='+d.league+'&view='+(d.league==='NBA'||d.league==='WNBA'?'teams':s.view)+'&date='+s.date;return;}
 if(d.view){if(s.reference&&d.view==='live'){location.href='?league='+s.league+'&view=games';return;}showView(d.view);return;}
 if(d.assistant!==undefined||d.ask){modalBody(assistantPanel(s,d.ask||'why',d.fixture||''));return;}
 if(d.weights!==undefined){modalBody(weightsForm(s));return;}
 if(d.refresh!==undefined){if(s.reference){location.reload();return;}if(s.teamCode){s.rosterTimes[s.teamCode]=0;if(s.playerId){s.playerTimes[s.playerId]=0;loadPlayerFile(s.playerId);}}historyTime=0;contextTime=0;s.notice='正在更新…';paint();refresh();return;}
 if(d.shift){setDate(shift(s.date,Number(d.shift)));return;}if(d.today!==undefined){setDate(today());return;}if(d.nextday!==undefined){nextDay();return;}
 if(d.filter){s.filter=d.filter;s.selected='';s.detail=null;s.detailKey='';++detailsToken;s.boxSide='away';s.playPeriod='all';paint();loadDetail();return;}
 if(d.openGame){s.view='live';showGame(d.openGame);document.getElementById('scoreboard')?.scrollIntoView();return;}if(d.game){showGame(d.game);return;}
 if(d.team){if(!teamFor(s,d.team))return;s.teamYear='';s.teamPhase=2;s.venue='all';s.teamLimit=0;s.teamCode=d.team;s.teamView='summary';s.playerId='';s.view='teams';route();paint();history(token);roster(s.teamCode);scrollBoardTop();return;}
 if(d.playertab){s.playerTab=d.playertab;route();paint();return;}
 if(d.player){s.playerTab='overview';s.playerYear='';s.playerRecord='';s.teamCode=d.club;s.playerId=d.player;s.view='teams';route();paint();roster(s.teamCode);loadPlayerFile(s.playerId);playerLog(s.playerId,s.teamCode);scrollBoardTop();return;}
 if(d.teamview||d.backroster!==undefined){s.playerId='';s.teamView=d.teamview||'roster';route();paint();if(d.backroster!==undefined)scrollBoardTop();return;}
 if(d.backteams!==undefined){showView('teams');scrollBoardTop();return;}
 if(d.boxside){s.boxSide=d.boxside;paint();return;}if(d.boxmore!==undefined){s.boxMore=!s.boxMore;paint();return;}
 if(d.period){s.playPeriod=d.period;s.playLimit=60;paint();return;}if(d.moreplays!==undefined){s.playLimit+=60;paint();return;}
 if(d.applyweights!==undefined||d.resetweights!==undefined){const target=$('weight-target').value;const values=[...modal.querySelectorAll('[data-weight]')].map(i=>Number(i.value));const ok=storeWeights(s,target,values,d.resetweights!==undefined);
   if(ok){s.version++;modal.close();paint();}else $('weight-note').textContent='請至少保留一項大於零的權重，並允許瀏覽器儲存設定。';return;}
 if(b.classList.contains('close'))modal.close();
}
document.addEventListener('click',onClick,true);
document.addEventListener('input',ev=>{
 if(ev.target.dataset.weight!==undefined){const inputs=[...modal.querySelectorAll('[data-weight]')],sum=inputs.reduce((a,x)=>a+Number(x.value),0);
 inputs.forEach(x=>x.previousElementSibling.textContent=(sum?Number(x.value)*100/sum:0).toFixed(1)+'%');modal.querySelector('[data-applyweights]').disabled=!sum;}
});
document.addEventListener('change',ev=>{const t=ev.target;if(t.id==='pick-day'){setDate(t.value);return;}if(t.id==='weight-target'){modalBody(weightsForm(s,t.value));return;}
 if(t.dataset.teamfilter&&['teamYear','teamPhase','venue','teamLimit'].includes(t.dataset.teamfilter)){s[t.dataset.teamfilter]=t.value;route();paint();return;}
 if(t.dataset.pyear!==undefined){s.playerYear=t.value;s.playerRecord='';route();paint();return;}
 if(t.dataset.precord!==undefined){s.playerYear=document.querySelector('[data-pyear]').value;s.playerRecord=t.value;route();paint();return;}
 if(t.dataset.rankseason!==undefined||t.dataset.phase!==undefined){if(t.dataset.teamfilter&&['teamYear','teamPhase','venue','teamLimit'].includes(t.dataset.teamfilter)){s[t.dataset.teamfilter]=t.value;route();paint();return;}
 if(t.dataset.pyear!==undefined){s.playerYear=t.value;s.playerRecord='';route();paint();return;}
 if(t.dataset.precord!==undefined){s.playerYear=document.querySelector('[data-pyear]').value;s.playerRecord=t.value;route();paint();return;}
 if(t.dataset.rankseason!==undefined)s.rankSeason=Number(t.value);else s.phase=Number(t.value);route();rank();return;}
});
$('source').addEventListener('click',showSources);modal.addEventListener('click',ev=>{if(ev.target===modal)modal.close();});
window.addEventListener('popstate',()=>{if(modal.open)modal.close();adoptRoute();loadLeague();});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
setInterval(()=>{if(!document.hidden&&s.fallback&&s.date===today()&&!modal.open&&['overview','live','analysis'].includes(s.view))refresh();},30000);
try{s.catalog=await getJson('/api/regional-basketball/data/leagues.json');adoptRoute();await loadLeague();}catch(error){$('content').innerHTML=empty('聯盟資料暫時無法載入，請重新整理。');}
