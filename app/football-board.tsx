'use client';
import {useEffect,useRef,useState} from 'react';
import {ArrowLeft,ArrowRight,CalendarDays,RefreshCw} from 'lucide-react';
import {FOOTBALL_LEAGUES,footballDay,shiftFootballDay,isFootballLeague,validFootballDay,type FootballGame,type FootballLeague} from '@/lib/football';
import {footballFixtureKey,footballSourceStale,readyFootballAnalysis,retainFootballForecast,type FootballReport} from '@/lib/football-recommendations';
import FootballTeamIdentity from './football-team';
import FootballRecommendationsPane,{FootballAnalysisNumbers} from './football-recommendations';
import {footballAnalysisPresentation,footballReportNeedsRefresh,footballRequestError,type FootballAnalysisActivity} from './football-report-refresh';
import {createFootballReportQueue} from './football-report-queue';

import {FOOTBALL_VIEWS,isFootballView,type FootballView} from '@/lib/football-live';
import {defaultFootballSettings,footballSettingsKey,parseFootballSettings,customFootballSettings,type FootballModelSettings} from '@/lib/football-model-weights';
import FootballLiveCenter,{FootballGameStrip} from './football-live-center';
import FootballStandings from './football-standings';
import FootballModelWeights from './football-model-weights';
import SportMarkets from './sport-markets';
import {useSource} from './use-source';
import './sport-markets.css';
import './football-live.css';

type Board={source?:string;analysisAvailable?:boolean;notice?:string;games:FootballGame[];fetchedAt:string;day:string;league:FootballLeague};
type Report=FootballReport;
const fixtureKey=footballFixtureKey;
const time=(value:string)=>new Date(value).toLocaleString('zh-TW',{timeZone:'Asia/Taipei',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false});
async function request(url:string,signal:AbortSignal){
  const r=await fetch(url,{cache:'no-store',signal:AbortSignal.any([signal,AbortSignal.timeout(55000)])});
  if(r.status===401){window.location.assign('/login');throw Error('請重新登入');}
  const d=await r.json();if(!r.ok)throw Error(d.error||'資料更新失敗');return d;
}
export default function FootballBoard(){
  const odds=useSource<any>('member-odds',60000);
  const [league,setLeague]=useState<FootballLeague>('eng.1'),[day,setDay]=useState(footballDay);
  const [view,setView]=useState<FootballView>('analysis'),[initialized,setInitialized]=useState(false),[settings,setSettings]=useState<FootballModelSettings>(defaultFootballSettings),[settingsLeague,setSettingsLeague]=useState('');
  const viewRef=useRef(view);viewRef.current=view;
  const settingsSignature=customFootballSettings(settings)?JSON.stringify(settings):'';
  const [board,setBoard]=useState<Board|null>(null),[reports,setReports]=useState<Record<string,Report>>({});
  const [analysisActivity,setAnalysisActivity]=useState<Record<string,FootballAnalysisActivity>>({});
  const [error,setError]=useState(''),[loading,setLoading]=useState(true),[nextBusy,setNextBusy]=useState(false),[notice,setNotice]=useState('');
  const [selectedGame,setSelectedGame]=useState('');
  const [filter,setFilter]=useState('all'),[reload,setReload]=useState(0),[now,setNow]=useState(Date.now);
  const nextController=useRef<AbortController|null>(null);
  const today=useRef(footballDay());
  const selected=FOOTBALL_LEAGUES.find(l=>l.code===league)!;
  useEffect(()=>{const p=new URLSearchParams(window.location.search),competition=p.get('competition'),date=p.get('date'),page=p.get('view');if(competition&&isFootballLeague(competition))setLeague(competition);if(date&&validFootballDay(date)&&Math.abs(Date.parse(date)-Date.parse(footballDay()))<=365*86400000)setDay(date);if(isFootballView(page))setView(page);setInitialized(true);},[]);
  useEffect(()=>{try{setSettings(parseFootballSettings(localStorage.getItem(footballSettingsKey(league)))||defaultFootballSettings());}catch{setSettings(defaultFootballSettings());}setSettingsLeague(league);},[league]);
  useEffect(()=>{if(!initialized)return;const p=new URLSearchParams(window.location.search);p.set('league','FOOTBALL');p.set('competition',league);p.set('date',day);p.set('view',view);window.history.replaceState(null,'','/?'+p);},[league,day,view,initialized]);
  function applySettings(next:FootballModelSettings){setSettings(next);try{localStorage.setItem(footballSettingsKey(league),JSON.stringify(next));}catch{/* Session settings still apply if browser storage is unavailable. */}}

  useEffect(()=>{
    let timer:ReturnType<typeof setTimeout>;
    const tick=()=>{
      clearTimeout(timer);const clock=Date.now(),date=footballDay(new Date(clock));setNow(clock);
      if(date!==today.current){const previous=today.current;today.current=date;setDay(selectedDay=>selectedDay===previous?date:selectedDay);}
      timer=setTimeout(tick,Math.min(15000,86400000-((clock+8*3600000)%86400000)));
    };
    const resume=()=>{if(document.visibilityState==='visible')tick();};
    tick();document.addEventListener('visibilitychange',resume);
    return()=>{clearTimeout(timer);document.removeEventListener('visibilitychange',resume);};
  },[]);
  useEffect(()=>{
    const refresh=()=>setReload(n=>n+1);window.addEventListener('arena-refresh-all',refresh);
    return()=>window.removeEventListener('arena-refresh-all',refresh);
  },[]);
  useEffect(()=>{
    nextController.current?.abort();setNextBusy(false);setNotice('');
    return()=>nextController.current?.abort();
  },[league,day]);
  useEffect(()=>{
    if(!initialized||settingsLeague!==league)return;
    const controller=new AbortController();let busy=false,timer:ReturnType<typeof setTimeout>;
    const known:Record<string,Report>={},attempted:Record<string,number>={};
    let currentBoard:Board|null=null;
    setBoard(null);setReports({});setAnalysisActivity({});setError('');setLoading(true);
    const base=`/api/football?league=${encodeURIComponent(league)}&date=${day}`;
    const queue=createFootballReportQueue({
      signal:controller.signal,
      request:(game,signal)=>request(base+'&kind=analysis&game='+game.id+(settingsSignature?'&settings='+encodeURIComponent(settingsSignature):''),signal),
      current:game=>{
        const current=currentBoard?.games.find(g=>fixtureKey(g)===fixtureKey(game)),clock=Date.now();
        return !!current&&(retainFootballForecast(current,clock)||(currentBoard?.analysisAvailable!==false&&current.state==='scheduled'&&current.timeConfirmed&&Date.parse(current.start)>clock));
      },
      onReport(game,report){
        // A late, invalid or closed result cannot replace a valid pregame snapshot.
        if(readyFootballAnalysis(game,report,Date.now())||!readyFootballAnalysis(game,known[game.id],Date.now()))known[game.id]=report;
        setReports({...known});
      },
      onError(game,error){
        if(!readyFootballAnalysis(game,known[game.id],Date.now()))known[game.id]={game,error:footballRequestError(error)};
        setReports({...known});
      },
      onActivity:setAnalysisActivity,
      onSettled:game=>{attempted[fixtureKey(game)!]=Date.now();},
    });
    async function update(){
      if(busy||controller.signal.aborted||document.visibilityState==='hidden')return;clearTimeout(timer);busy=true;
      try{
        const data:Board=await request(base,controller.signal);if(controller.signal.aborted)return;
        currentBoard=data;
        setBoard(data);setError('');setLoading(false);
        const clock=Date.now();
        queue.enqueue(data.games.filter(g=>!queue.has(g)&&footballReportNeedsRefresh(g,known[g.id],clock,attempted[fixtureKey(g)!],data.analysisAvailable!==false)));
      }catch(e){if(!controller.signal.aborted)setError(footballRequestError(e,'schedule'));}
      finally{busy=false;if(!controller.signal.aborted){setLoading(false);timer=setTimeout(()=>void update(),viewRef.current==='live'?10000:30000);}}
    }
    void update();const resume=()=>{if(document.visibilityState==='visible')void update();};document.addEventListener('visibilitychange',resume);window.addEventListener('online',resume);
    return()=>{controller.abort();clearTimeout(timer);document.removeEventListener('visibilitychange',resume);window.removeEventListener('online',resume);};
  },[league,day,reload,initialized,settingsLeague,settingsSignature]);
  async function nextMatch(){
    nextController.current?.abort();const controller=new AbortController();nextController.current=controller;setNextBusy(true);setNotice('');
    try{const d=await request(`/api/football?league=${league}&date=${day}&kind=next`,controller.signal);if(!controller.signal.aborted){if(d.day)setDay(d.day);else setNotice('來源尚未提供近期的下一個比賽日，可使用日期選擇器查詢。');}}
    catch(e){if(!controller.signal.aborted)setNotice(footballRequestError(e,'next'));}
    finally{if(!controller.signal.aborted)setNextBusy(false);}
  }
  const current=board?.league===league&&board.day===day;
  const games=current?board.games.filter(g=>filter==='all'||g.state===filter):[];
  const clock=Math.max(now,Date.now());
  const stale=!!board&&footballSourceStale(board.fetchedAt,clock);
  const unavailable=!!error||stale||(!current&&!loading);
  return <section className="football-board" data-super-league="FOOTBALL" aria-label="足球分析">
    <div className="football-heading"><div><h1>{selected.name}</h1><p>五大聯賽、歐冠、歐霸與歐國聯・賽程、比分與賽前機率</p></div><span className="football-model-tag">90分鐘分析</span></div>
    <nav className="football-leagues" aria-label="足球聯賽">{FOOTBALL_LEAGUES.map(l=><button type="button" key={l.code} onClick={()=>setLeague(l.code)} aria-pressed={l.code===league}>{l.name}</button>)}</nav>
    <nav className="football-page-tabs" aria-label="足球頁面">{FOOTBALL_VIEWS.map(([id,label])=><button type="button" key={id} aria-pressed={view===id} onClick={()=>setView(id)}>{label}</button>)}</nav>
    {view!=='standings'&&<div className="football-content-panel"><div className="football-toolbar"><div><h2>{FOOTBALL_VIEWS.find(([id])=>id===view)?.[1]}</h2><p>{selected.fullName}・台灣時間</p></div><div className="football-date"><button type="button" aria-label="前一天" onClick={()=>setDay(shiftFootballDay(day,-1))}><ArrowLeft size={17}/></button><label><CalendarDays size={17}/><span className="sr-only">比賽日期（台灣時間）</span><input type="date" value={day} min={shiftFootballDay(footballDay(),-365)} max={shiftFootballDay(footballDay(),365)} onChange={e=>{if(e.target.value)setDay(e.target.value);}}/></label><button type="button" aria-label="後一天" onClick={()=>setDay(shiftFootballDay(day,1))}><ArrowRight size={17}/></button><button type="button" onClick={()=>setDay(footballDay())}>今天</button><button type="button" aria-label="更新足球資料" disabled={loading} onClick={()=>setReload(n=>n+1)}><RefreshCw size={17} className={loading?'animate-spin':''}/></button></div><FootballModelWeights key={league} league={league} settings={settings} onApply={applySettings}/></div>
    <div className="football-status"><span>{board?`${board.games.length} 場賽事・${board.games.filter(g=>g.state==='live').length} 場進行中`:'正在取得賽程'}</span><span>{board?`抓取 ${time(board.fetchedAt)}`:'等待同步'}{stale?'・資料已過期':''}</span></div>
    <div className="football-filters" role="group" aria-label="足球賽事狀態">{[['all','全部'],['scheduled','未開賽'],['live','進行中'],['final','已完場']].map(([value,label])=><button type="button" key={value} aria-pressed={filter===value} onClick={()=>setFilter(value)}>{label}</button>)}</div>
    {error&&<div className="football-alert" role="alert">{error} {board?'目前顯示上次取得的賽程；當日已開賽的賽前預測仍保留。':''}<button type="button" onClick={()=>setReload(n=>n+1)}>重新載入</button></div>}
    {loading&&!board?<div className="football-empty" role="status"><RefreshCw className="animate-spin"/><h3>正在取得{selected.name}賽程</h3><p>賽程載入後會自動計算可分析的比賽。</p></div>:board&&!games.length?<div className="football-empty"><CalendarDays size={30}/><h3>{board.games.length?'沒有符合篩選條件的比賽':`${day} 沒有${selected.name}賽事`}</h3><p>{board.games.length?'可切換至全部查看當日賽程。':'可查看下一個比賽日，或自行選擇日期。'}</p>{!board.games.length&&<button type="button" className="football-primary" disabled={nextBusy} onClick={()=>void nextMatch()}>{nextBusy?'正在查詢…':'下一個比賽日'}<ArrowRight size={16}/></button>}{notice&&<p role="status">{notice}</p>}</div>:null}
    {view==='analysis'&&<div className="football-games">{games.map(game=><FootballCard snapshot={odds.data} oddsError={odds.error} oddsErrorCode={odds.errorCode} oddsLoading={odds.loading} key={game.id} game={game} report={reports[game.id]} activity={analysisActivity[fixtureKey(game)!]} analysisAvailable={board?.analysisAvailable!==false} notice={board?.notice} now={clock} unavailable={unavailable}/>)}</div>}
    {view==='live'&&games.length>0&&<FootballLiveCenter key={league+day} games={games} initialGameId={selectedGame}/>}
    {view==='overview'&&current&&<><div className="football-overview-stats">{[['當日賽事',board.games.length],['進行中',board.games.filter(g=>g.state==='live').length],['未開賽',board.games.filter(g=>g.state==='scheduled').length],['已完場',board.games.filter(g=>g.state==='final').length]].map(([label,value])=><div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div><div className="football-overview-links"><button onClick={()=>setView('live')}>查看比分與賽事紀錄 <ArrowRight size={16}/></button><button onClick={()=>setView('analysis')}>查看賽前分析 <ArrowRight size={16}/></button><button onClick={()=>setView('standings')}>查看戰績排名 <ArrowRight size={16}/></button></div><FootballGameStrip games={games} selected="" onSelect={id=>{setSelectedGame(id);setView('live');}}/></>}
    </div>}
    {view==='standings'&&<FootballStandings key={league} league={league}/>}
    <FootballRecommendationsPane snapshot={odds.data} oddsError={odds.error} oddsErrorCode={odds.errorCode} sourceLoading={odds.loading} games={games} reports={reports} analysisActivity={analysisActivity} analysisNotice={board?.analysisAvailable===false?(board.notice||'目前的賽程來源尚未提供分析資料。'):undefined} league={league} leagueName={selected.name} day={day} now={clock} sourceFetchedAt={current?board.fetchedAt:undefined} unavailable={unavailable} loading={loading}/>
  </section>;
}
function FootballCard({game,report,now,unavailable,snapshot,oddsError,oddsErrorCode='',oddsLoading=false,activity,analysisAvailable=true,notice=''}:{snapshot:any;oddsError:string;oddsErrorCode?:string;oddsLoading?:boolean;game:FootballGame;report?:Report;now:number;unavailable:boolean;activity?:FootballAnalysisActivity;analysisAvailable?:boolean;notice?:string}){
  const a=readyFootballAnalysis(game,report,now,unavailable);
  const presentation=footballAnalysisPresentation(game,report,now,{unavailable,analysisAvailable,notice,activity});
  const eligible=game.state==='scheduled'&&game.timeConfirmed&&Date.parse(game.start)>now;
  return <article className="football-card">
    <div className="football-card-top"><span className={game.state==='live'?'football-live':''}>{game.state==='live'&&<i/>}{game.statusLabel}</span><span>{game.timeConfirmed?time(game.start):'時間待定'}</span></div>
    <div className="football-match"><FootballTeamIdentity team={game.home} side="home" league={game.league} day={footballDay(game.start)}/><b>{game.homeScore!==null&&game.awayScore!==null?`${game.homeScore} : ${game.awayScore}`:'VS'}</b><FootballTeamIdentity team={game.away} side="away" league={game.league} day={footballDay(game.start)}/></div>
    {(game.venue||game.neutral)&&<p className="football-venue">{game.neutral?'中立場・':''}{game.venue}</p>}
    {a?<>
      <div className="football-analysis-title"><strong>{a.lean?.replace('模型傾向','').replace('，保留觀望','')}</strong></div>
      <FootballAnalysisNumbers analysis={a}/>
    </>:eligible?<div className="football-analysis-pending" data-analysis-state={presentation.state} role="status">{presentation.state==='loading'&&<RefreshCw size={18} className="animate-spin"/>}<p>{presentation.message}</p>{activity&&presentation.state!=='loading'&&<small>正在重新檢查來源…</small>}</div>:null}
    {eligible&&<SportMarkets game={game} analysis={a} analysisState={presentation.state} analysisMessage={presentation.message} snapshot={snapshot} sourceLoading={oddsLoading} error={oddsError} errorCode={oddsErrorCode} sport="FOOTBALL" now={now}/>}
  </article>;
}
