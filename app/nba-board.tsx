'use client';
import {useEffect,useRef,useState} from 'react';
import {ArrowLeft,ArrowRight,CalendarDays,RefreshCw} from 'lucide-react';
import {NBA_TEAMS,nbaDay,nbaPhase,shiftNbaDay,validNbaDay,type NbaBoard as Board,type NbaGame} from '@/lib/nba';
import {DEFAULT_WEIGHTS,weightKey,type Weights} from '@/lib/basketball-efficiency';
import {basketballWeightStorageKey,readNbaWeights,writeNbaWeights} from '@/lib/nba-model-weights';
import NbaModelWeights from './nba-model-weights';
import {basketballTeamWeights} from '@/lib/team-model-settings';
import {useTeamWeightBook,TeamWeightNotice} from './team-weight-book';
import BasketballLiveCenter from './basketball-live-center';
import BasketballStandings from './basketball-standings';
import {WNBA_TEAMS} from '@/lib/wnba';
import {nbaEligible,nbaSourceStale,readyNbaAnalysis,type NbaReport} from '@/lib/nba-analysis';
import {NbaAnalysisNumbers,NbaMatch,NbaQuarters,NbaTeamIdentity,nbaTime} from './nba-match';
import NbaRecommendations from './nba-recommendations';
import {nbaRequest} from './nba-request';
import {basketballReportNeedsRefresh,basketballPendingLabel,basketballPendingState} from './basketball-report-refresh';
import './nba.css';
import './sport-markets.css';
import SportMarkets from './sport-markets';
import {useSource} from './use-source';
export default function NbaBoard({view,onViewChange,league='NBA'}:{league?:'NBA'|'WNBA';view:string;onViewChange:(view:string)=>void}){
 const odds=useSource<any>('member-odds',60000);
 const teams=league==='WNBA'?WNBA_TEAMS:NBA_TEAMS,api=`/api/${league.toLowerCase()}`;
 const [settings,setSettings]=useState<{league:string;weights:Weights}|null>(null),[weightsNotice,setWeightsNotice]=useState('');
 const weights=settings?.league===league?settings.weights:DEFAULT_WEIGHTS,weightsReady=settings?.league===league;
 const teamBook=useTeamWeightBook(league);
 const weightsQuery=weights.join(','),gameWeights=(game:NbaGame)=>basketballTeamWeights(weights,teamBook.book,game.home.id,game.away.id),expectedWeights=(game:NbaGame)=>weightKey(gameWeights(game));
 useEffect(()=>{let saved:Weights=[...DEFAULT_WEIGHTS];try{saved=readNbaWeights(window.localStorage.getItem(basketballWeightStorageKey(league)));}catch{/* Storage may be unavailable; defaults still work. */}setSettings({league,weights:saved});setWeightsNotice('');},[league]);
 function applyWeights(next:Weights){if(weightKey(next)!==weightKey(weights))setReports({});setSettings({league,weights:next});try{window.localStorage.setItem(basketballWeightStorageKey(league),writeNbaWeights(next));setWeightsNotice('比例已套用，賽前分析依新比例更新。');}catch{setWeightsNotice('比例已套用；此瀏覽器無法儲存，重新整理後會恢復預設。');}}
 const tab=['overview','analysis','teams','live','standings'].includes(view)?view:'analysis';
 const [day,setDay]=useState(nbaDay),[board,setBoard]=useState<Board|null>(null),[reports,setReports]=useState<Record<string,NbaReport>>({});
 const [loading,setLoading]=useState(true),[error,setError]=useState(''),[filter,setFilter]=useState('all'),[now,setNow]=useState(Date.now);
 const refreshBoard=useRef<()=>void>(()=>{}),boardKey=useRef('');
 const [nextBusy,setNextBusy]=useState(false),[notice,setNotice]=useState(''),nextController=useRef<AbortController|null>(null);
 useEffect(()=>{const date=new URLSearchParams(window.location.search).get('date');if(date&&validNbaDay(date)&&Math.abs(Date.parse(date)-Date.parse(nbaDay()))<=365*86400000)setDay(date);},[]);
 useEffect(()=>{const tick=setInterval(()=>setNow(Date.now()),15000);return()=>clearInterval(tick);},[]);
 useEffect(()=>{nextController.current?.abort();setNextBusy(false);setNotice('');return()=>nextController.current?.abort();},[day]);
 useEffect(()=>{
  if(!weightsReady||!teamBook.ready)return;
  const controller=new AbortController(),known:Record<string,NbaReport>={},queued=new Set<string>();let busy=false,timer:ReturnType<typeof setTimeout>;
  // Refreshes and weight changes retain the current schedule. Only changing
  // league/date replaces its identity; old requests are aborted on cleanup.
  const key=`${api}:${day}`;if(boardKey.current!==key){boardKey.current=key;setBoard(null);}
  setReports({});setError('');setLoading(true);
  const base=`${api}?date=${day}`;
  async function update(forceAnalysis=false){
   if(busy||controller.signal.aborted||document.hidden)return;clearTimeout(timer);busy=true;setLoading(true);
   try{
    const data:Board=await nbaRequest(base,controller.signal);if(controller.signal.aborted)return;
    setBoard(data);setError('');setLoading(false);
    const todo=data.games.filter(g=>nbaEligible(g)&&!queued.has(g.id)&&basketballReportNeedsRefresh(g,known[g.id],Date.now(),forceAnalysis));
    todo.forEach(g=>queued.add(g.id));
    async function worker(){while(todo.length&&!controller.signal.aborted){const g=todo.shift()!;if(document.hidden){queued.delete(g.id);continue;}try{const report=await nbaRequest(base+`&kind=analysis&game=${g.id}&weights=${gameWeights(g).join(',')}`,controller.signal);if(!controller.signal.aborted){known[g.id]=report;setReports({...known});}}catch(e){if(!controller.signal.aborted){known[g.id]={error:e instanceof Error?e.message:'分析暫時無法取得'};setReports({...known});}}finally{queued.delete(g.id);}}}
    void Promise.all([worker(),worker()]);
   }catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:`${league} 資料更新失敗`);}
   finally{busy=false;if(!controller.signal.aborted){setLoading(false);timer=setTimeout(()=>void update(),tab==='live'?10000:30000);}}
  }
  const refresh=()=>{setNow(Date.now());void update(true);};refreshBoard.current=refresh;
  void update();const resume=()=>{if(!document.hidden)void update();else clearTimeout(timer);};document.addEventListener('visibilitychange',resume);
  window.addEventListener('online',resume);window.addEventListener('arena-refresh-all',refresh);
  return()=>{controller.abort();clearTimeout(timer);document.removeEventListener('visibilitychange',resume);window.removeEventListener('online',resume);window.removeEventListener('arena-refresh-all',refresh);};
 },[day,api,weightsQuery,weightsReady,tab,teamBook.ready,teamBook.signature]);
 function selectDay(value:string){if(!validNbaDay(value)||Math.abs(Date.parse(value)-Date.parse(nbaDay()))>365*86400000)return;setDay(value);const p=new URLSearchParams(window.location.search);p.set('date',value);window.history.replaceState(null,'',`/?${p}`);}
 async function nextMatch(){
  nextController.current?.abort();const controller=new AbortController();nextController.current=controller;setNextBusy(true);setNotice('');
  try{const d=await nbaRequest(`${api}?kind=next&date=${day}`,controller.signal);if(!controller.signal.aborted){if(d.day)selectDay(d.day);else setNotice('尚無下一個比賽日');}}
  catch(e){if(!controller.signal.aborted)setNotice(e instanceof Error?e.message:'查詢失敗');}finally{if(!controller.signal.aborted)setNextBusy(false);}
 }
 const current=board?.day===day,clock=Math.max(now,Date.now()),unavailable=!!error||!current||nbaSourceStale(board?.fetchedAt,clock);
 const games=current?board.games.filter(g=>filter==='all'||g.state===filter):[];
 return <section className="nba-board" data-super-league={league} aria-label={`${league} 分析`}>
  <div className="nba-heading"><div className="nba-heading-title"><svg className="nba-sport-mark" viewBox="0 0 64 64" fill="none" aria-hidden="true"><circle cx="32" cy="32" r="26"/><path d="M6 32h52M32 6v52M13.6 13.6c24.5 7.6 24.5 29.2 36.8 36.8M50.4 13.6C25.9 21.2 25.9 42.8 13.6 50.4"/></svg><div><h1>{league} <span>{league==='WNBA'?'美國女子職籃':'美國職籃'}</span></h1><p>全場分析・含延長賽</p></div></div><div className="nba-heading-stats"><div><strong>{current?board.games.length:'—'}</strong><span>當日賽事</span></div><div><strong>{current?board.games.filter(g=>g.state==='live').length:'—'}</strong><span>進行中</span></div><div><strong>{teams.length}</strong><span>聯盟球隊</span></div></div><svg className="nba-court-art" viewBox="0 0 360 240" fill="none" aria-hidden="true"><rect x="10" y="10" width="340" height="220" rx="6"/><path d="M180 10v220M10 55h75v130H10M350 55h-75v130h75M10 35c180 0 180 170 0 170M350 35c-180 0-180 170 0 170"/><circle cx="180" cy="120" r="34"/></svg></div>
  <div className="nba-tabs-row"><nav className="nba-tabs" aria-label={`${league} 頁面`}>{[['overview','概覽'],['live','即時比分'],['analysis','賽前分析・串關'],['standings','戰績排名'],['teams','球隊一覽']].map(([v,label])=><button type="button" key={v} aria-pressed={tab===v} onClick={()=>onViewChange(v)}>{label}</button>)}</nav><NbaModelWeights league={league} weights={weights} onApply={applyWeights}/></div>
  <TeamWeightNotice count={teamBook.count} onClear={teamBook.clear}/>
  {weightsNotice&&<p className="nba-weights-notice" role="status">{weightsNotice}</p>}
  {tab==='standings'?<BasketballStandings league={league}/>:tab==='teams'?<div className="nba-team-directory">{teams.map(team=><NbaTeamIdentity key={team.id} team={team}/>)}</div>:<>
   <div className="nba-toolbar"><div><h2>{new Date(day+'T12:00:00+08:00').toLocaleDateString('zh-TW',{timeZone:'Asia/Taipei',month:'long',day:'numeric',weekday:'long'})}</h2><small>台灣時間 UTC+8</small></div><div className="nba-date"><button type="button" aria-label="前一天" onClick={()=>selectDay(shiftNbaDay(day,-1))}><ArrowLeft size={18}/></button><label><CalendarDays size={18}/><span className="sr-only">{league} 比賽日期</span><input type="date" value={day} min={shiftNbaDay(nbaDay(),-365)} max={shiftNbaDay(nbaDay(),365)} onChange={e=>selectDay(e.target.value)}/></label><button type="button" aria-label="後一天" onClick={()=>selectDay(shiftNbaDay(day,1))}><ArrowRight size={18}/></button><button type="button" className="nba-today" onClick={()=>selectDay(nbaDay())}>今天</button><button type="button" disabled={loading} aria-label={`更新 ${league} 資料`} onClick={()=>refreshBoard.current()}><RefreshCw size={18} className={loading?'animate-spin':''}/></button></div></div>
   <div className="nba-board-meta"><div className="nba-filters" role="group" aria-label={`${league} 賽事狀態`}>{[['all','全部'],['scheduled','未開賽'],['live','進行中'],['final','已完賽']].map(([v,label])=><button type="button" key={v} aria-pressed={filter===v} onClick={()=>setFilter(v)}>{label}{current&&<span>{v==='all'?board.games.length:board.games.filter(g=>g.state===v).length}</span>}</button>)}</div><span className="nba-updated">{current?`賽程更新 ${nbaTime(board.fetchedAt)}`:'正在取得賽程'}</span></div>
   {error&&<p className="nba-alert" role="alert">{error}<button type="button" onClick={()=>refreshBoard.current()}>重試</button></p>}
   {loading&&!current?<p className="nba-empty" role="status">正在取得 {league} 賽程…</p>:current&&!games.length?<div className="nba-empty"><CalendarDays size={32}/><h3>{board.games.length?'沒有符合篩選的比賽':`${day} 沒有 ${league} 賽事`}</h3>{!board.games.length&&<button type="button" className="nba-primary" disabled={nextBusy} onClick={()=>void nextMatch()}>{nextBusy?'查詢中…':'下一個比賽日'}<ArrowRight size={16}/></button>}{notice&&<p role="status">{notice}</p>}</div>:null}
   {tab==='overview'&&<div className="basketball-overview"><div><span>當日賽事</span><strong>{current?board.games.length:'—'}</strong></div><div><span>進行中</span><strong>{current?board.games.filter(g=>g.state==='live').length:'—'}</strong></div><div><span>已完賽</span><strong>{current?board.games.filter(g=>g.state==='final').length:'—'}</strong></div><div><span>聯盟球隊</span><strong>{teams.length}</strong></div><nav aria-label="籃球功能捷徑">{[['live','查看比分與球員成績'],['analysis','查看賽前分析與串關'],['standings','查看戰績排名']].map(([v,label])=><button key={v} onClick={()=>onViewChange(v)}>{label}<ArrowRight size={18}/></button>)}</nav></div>}
   {tab==='live'?<BasketballLiveCenter key={`${league}:${day}`} league={league} games={games} day={day}/>:<div className="nba-games" data-view={tab}>{games.map(game=><NbaCard key={game.id} game={game} report={reports[game.id]} snapshot={odds.data} oddsError={odds.error} oddsLoading={odds.loading} sport={league} expectedWeights={expectedWeights(game)} now={clock} unavailable={unavailable} showAnalysis={tab==='analysis'}/>)}</div>}
  </>}
  <NbaRecommendations snapshot={odds.data} oddsError={odds.error} oddsLoading={odds.loading} expectedWeights={expectedWeights} league={league} games={current?board.games:[]} reports={reports} day={day} now={clock} fetchedAt={current?board.fetchedAt:undefined} unavailable={unavailable} loading={loading}/>
 </section>;
}
function NbaCard({game,report,now,unavailable,showAnalysis,expectedWeights,snapshot,oddsError,oddsLoading=false,sport}:{snapshot:any;oddsError:string;oddsLoading?:boolean;sport:'NBA'|'WNBA';game:NbaGame;report?:NbaReport;now:number;unavailable:boolean;showAnalysis:boolean;expectedWeights?:string}){
 const a=readyNbaAnalysis(game,report,now,unavailable,expectedWeights),form=report?.analysis;
 return <article className="nba-card" data-state={game.state}><header><div className="nba-card-labels"><span className="nba-phase-tag">{nbaPhase(game.phase)}</span><span className={game.state==='live'?'nba-live':'nba-game-status'}><i/>{game.statusLabel}</span></div><time dateTime={game.start}>{game.timeConfirmed?nbaTime(game.start):'時間待定'}</time></header><div className="nba-card-layout" data-analysis={showAnalysis&&(!!a||nbaEligible(game,now))}>
  <div className="nba-match-overview"><NbaMatch game={game}/><NbaQuarters game={game}/>
   {showAnalysis&&a&&form&&<div className="nba-form"><span>近期正式賽</span>{(['away','home'] as const).map(side=>{const f=form[`${side}Form`];return <div key={side}><small>{side==='away'?'客隊':'主隊'}・近 {f.games} 場</small><strong>{f.wins} <em>勝</em> {f.losses} <em>負</em></strong><span>得 {f.pointsFor==null?'—':Math.round(f.pointsFor)} ／ 失 {f.pointsAgainst==null?'—':Math.round(f.pointsAgainst)}</span><div className="nba-streak" aria-label="近五場，最近一場在左">{f.results.map((r,i)=><i key={i} data-result={r}>{r==='W'?'勝':'負'}</i>)}</div></div>;})}</div>}
  </div>
  {showAnalysis&&a&&<div className="nba-card-analysis"><small className="nba-updated">分析更新 {nbaTime(a.capturedAt)}</small><NbaAnalysisNumbers game={game} analysis={a}/><SportMarkets game={game} analysis={a} snapshot={snapshot} sourceLoading={oddsLoading} error={oddsError} sport={sport} now={now}/></div>}
  {showAnalysis&&!a&&nbaEligible(game,now)&&<div className="nba-card-analysis nba-analysis-pending"><span className="nba-section-kicker">賽前分析</span><p role="status">{basketballPendingLabel(report,unavailable)}</p><SportMarkets game={game} analysisState={basketballPendingState(report,unavailable)} analysisMessage={basketballPendingLabel(report,unavailable)} snapshot={snapshot} sourceLoading={oddsLoading} error={oddsError} sport={sport} now={now}/></div>}
  </div>
 </article>;
}
