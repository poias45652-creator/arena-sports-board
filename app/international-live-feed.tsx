"use client";
import {useEffect,useRef,useState} from 'react';
import {ChevronLeft,ChevronRight,RefreshCw} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {shiftDay,taipeiDay} from '@/lib/baseball';
import {BaseDiamond,CountLights} from './live-scoreboard';
import InternationalTeamLogo from './international-team-logo';
import {internationalTeam} from '@/lib/international-teams';

import InternationalLiveRecords from './international-live-records';
import type {InternationalLiveGame as Game} from '@/lib/international-live-display';

type Feed={league:string;date:string;games:Game[];status:string;stale:boolean;error?:string;pollAfterMs?:number;persistence?:{error?:string}};
const labels:Record<string,string>={pregame:'未開賽',live:'進行中',final:'比賽結束',postponed:'延賽',cancelled:'取消',suspended:'暫停',unknown:'狀態待確認'};
const stamp=(v:string|null|undefined,seconds=false)=>v&&Number.isFinite(Date.parse(v))?new Date(v).toLocaleTimeString('zh-TW',{timeZone:'Asia/Taipei',hour:'2-digit',minute:'2-digit',...(seconds?{second:'2-digit'}:{})}):'未提供';
const score=(v:number|null)=>v??'—';
function old(g:Game,now:number){const t=Date.parse(g.source.fetchedAt);return !!g.sourceStale||!Number.isFinite(t)||now-t>(g.status==='live'?120000:600000);}
function gameLabel(g:Game,stale=false){if(stale)return '資料待更新';if(g.status==='live'&&g.inning!==null)return `${g.inning}局${g.half==='top'?'上':g.half==='bottom'?'下':''}`;return labels[g.status]||labels.unknown;}

function InternationalInningBoard({game}:{game:Game}){
 const numbers=[...new Set([...game.innings.away,...game.innings.home].map(x=>x.inning))].sort((a,b)=>a-b);
 const total=Math.max(9,game.inning||0,...numbers);
 return <div className="live-innings-scroll" tabIndex={0} aria-label="逐局比分，可左右捲動"><table className="live-innings"><caption className="sr-only">逐局得分及 R 得分、H 安打、E 失誤</caption><thead><tr><th>球隊</th>{Array.from({length:total},(_,i)=><th key={i}>{i+1}</th>)}<th title="得分">R</th><th title="安打">H</th><th title="失誤">E</th></tr></thead><tbody>{(['away','home'] as const).map(side=><tr key={side}><th><InternationalTeamLogo league={game.league} name={game[side].name} size={28}/><span className="sr-only">{game[side].name}</span></th>{Array.from({length:total},(_,i)=>{const n=i+1,value=game.innings[side].find(x=>x.inning===n)?.runs;const active=game.status==='live'&&game.inning===n&&game.half===(side==='away'?'top':'bottom');return <td key={n} className={active?'live-inning-active':''}>{value??'\u00a0'}</td>})}<td className="live-total">{score(game[side].score)}</td><td className="live-total">{score(game[side].hits)}</td><td className="live-total">{score(game[side].errors)}</td></tr>)}</tbody></table></div>;
}

function SelectedGame({game,stale,onRefresh,loading,onDetails}:{game:Game;stale:boolean;onRefresh:()=>void;loading:boolean;onDetails?:()=>void}){
 const bases=stale||game.status!=='live'||game.bases?.length!==3||game.bases.some(v=>typeof v!=='boolean')?null:{first:game.bases[0]===true,second:game.bases[1]===true,third:game.bases[2]===true};
 const count=stale||game.status!=='live'?{balls:null,strikes:null,outs:null}:{balls:game.balls,strikes:game.strikes,outs:game.outs};
 const pitcher=game.currentPitcher;
 const batter=game.currentBatter;
 return <div className="live-selected" aria-label="所選賽事詳細比分">
  <div className="live-detail-toolbar">{onDetails&&<Button variant="outline" onClick={onDetails}>投打紀錄與先發近況</Button>}<span>{game.date}</span><span>{gameLabel(game,stale)}</span><Button variant="outline" onClick={onRefresh} disabled={loading}><RefreshCw className={loading?'animate-spin':''}/>更新場況</Button></div>
  {stale&&<p className="live-data-notice">目前顯示上次取得的資料，最新場況等待來源更新。</p>}
  <div className="live-game-board"><section className="panel live-score-panel" aria-label="比分看板"><h3 className="live-section-ribbon">比分看板 <small>SCOREBOARD</small></h3><div className="live-score-layout">
   {(['away','home'] as const).map(side=><div className={`live-team-score live-team-${side}`} key={side}><InternationalTeamLogo league={game.league} name={game[side].name} size={80}/><h4>{game[side].name}</h4><span className="live-side-label">{side==='away'?'客隊':'主隊'}</span><strong>{game.status==='pregame'?'—':score(game[side].score)}</strong><small>預告先發：{game.starters[side]?.name||'尚未提供'}</small></div>)}
   <InternationalInningBoard game={game}/>
  </div><p className="live-board-footnote">R 得分 · H 安打 · E 失誤<span>更新 {stamp(game.source.fetchedAt,true)}（台灣）</span></p></section>
  <aside className="panel live-field-panel" aria-label="即時壘包與投打狀態"><h3 className="live-section-ribbon">{gameLabel(game,stale)}</h3><BaseDiamond bases={bases}/>{game.status==='live'&&!stale?<><div className="live-field-players"><p><span>投手</span>{pitcher?.name||'尚未提供'}</p><p><span>打者</span>{batter?.name||'尚未提供'}</p></div><div className="live-field-bottom"><CountLights count={count}/><div className="live-pitch-total"><span>用球數</span><strong>{pitcher?.pitchCount??'—'}</strong></div></div></>:<p className="live-empty">{game.status==='final'?'本場已結束，可查看逐局比分。':'開賽後顯示即時場況。'}</p>}</aside></div>
  <InternationalLiveRecords key={game.key} game={game} stale={stale}/>
 </div>;
}

export default function InternationalLiveFeed({league,revision,onGameDetails}:{league:'NPB'|'KBO'|'CPBL';revision:number;onGameDetails?:(id:string)=>void}){
 const [feed,setFeed]=useState<Feed>(),[loading,setLoading]=useState(false),[error,setError]=useState(''),[retry,setRetry]=useState(0),[now,setNow]=useState(Date.now()),[date,setDate]=useState<string|null>(null),[filter,setFilter]=useState('all'),[selectedKey,setSelectedKey]=useState<string|null>(null);
 const strip=useRef<HTMLDivElement>(null),[scrollState,setScrollState]=useState({left:false,right:false});
 const today=taipeiDay(now),day=date??today;
 useEffect(()=>{const t=setInterval(()=>setNow(Date.now()),15000);return()=>clearInterval(t)},[]);
 useEffect(()=>{let stopped=false,busy=false,timer:ReturnType<typeof setTimeout>|undefined,current:AbortController|undefined;setFeed(undefined);setError('');async function load(){if(stopped||busy||document.hidden)return;if(timer)clearTimeout(timer);busy=true;setLoading(true);current=new AbortController();const timeout=setTimeout(()=>current?.abort(),45000);let delay=60000;try{const r=await fetch(`/api/international-live?league=${league}&date=${day}`,{signal:current.signal,cache:'no-store'});const body=await r.json();if(stopped)return;if(body.league!==league||body.date!==day||!Array.isArray(body.games))throw new Error(r.status===401?'請重新登入網站。':r.status===429?'請稍後再更新。':'資料暫時無法取得。');setFeed({...body,games:body.games.map((g:Game)=>({...g,home:{...g.home,name:internationalTeam(g.home.name,league)},away:{...g.away,name:internationalTeam(g.away.name,league)}}))});setError('');delay=Math.min(300000,Math.max(60000,Number(body.pollAfterMs)||60000));}catch(e){if(!stopped)setError(e instanceof Error&&e.name==='AbortError'?'來源回應較慢，將自動重試。':e instanceof Error?e.message:'資料暫時無法取得。');}finally{clearTimeout(timeout);busy=false;if(!stopped){setLoading(false);timer=setTimeout(()=>void load(),delay);}}}const resume=()=>{if(!document.hidden)void load();};document.addEventListener('visibilitychange',resume);void load();return()=>{stopped=true;if(timer)clearTimeout(timer);current?.abort();document.removeEventListener('visibilitychange',resume)}},[league,revision,retry,day]);
 const data=feed?.league===league&&feed.date===day?feed:undefined;
 const staleFeed=!!error||!!data?.stale;
 const rank=(g:Game)=>old(g,now)||staleFeed?4:g.status==='live'?0:g.status==='final'?1:g.status==='pregame'?2:3;
 const games=[...(data?.games||[])].sort((a,b)=>rank(a)-rank(b)||(a.startTime||'').localeCompare(b.startTime||''));
 const shown=games.filter(g=>filter==='all'||filter==='live'&&g.status==='live'||filter==='final'&&g.status==='final'||filter==='upcoming'&&g.status==='pregame');
 const selected=shown.find(g=>g.key===selectedKey)||shown[0];
 function updateScroll(){const el=strip.current;if(el)setScrollState({left:el.scrollLeft>2,right:el.scrollLeft+el.clientWidth<el.scrollWidth-2});}
 function scrollGames(direction:number){const el=strip.current;if(el)el.scrollBy({left:direction*Math.max(232,el.clientWidth-232),behavior:'smooth'});}
 function changeDay(value:string|null){setDate(value);setSelectedKey(null);}
 useEffect(()=>{const el=strip.current;if(!el)return;el.scrollLeft=0;updateScroll();const observer=new ResizeObserver(updateScroll);observer.observe(el);return()=>observer.disconnect()},[day,filter,shown.map(g=>g.key).join(',')]);
 return <section className="live-center" aria-label={`${league} 即時比分`}>
  <div className="panel live-center-heading"><div><h2>即時比分</h2><p>{league} · 台灣時間 · 場中約每 60 秒更新</p></div><div className="live-date-picker"><Button variant="ghost" aria-label="前一天" onClick={()=>changeDay(shiftDay(day,-1))}><ChevronLeft/></Button><label><span className="sr-only">選擇比分日期</span><input type="date" value={day} min="2000-01-01" max="2100-12-31" onChange={e=>e.target.value&&changeDay(e.target.value)}/></label><Button variant="ghost" aria-label="後一天" onClick={()=>changeDay(shiftDay(day,1))}><ChevronRight/></Button><Button variant="outline" onClick={()=>changeDay(null)} disabled={date===null}>今天</Button></div><Button variant="outline" onClick={()=>setRetry(v=>v+1)} disabled={loading}><RefreshCw className={loading?'animate-spin':''}/>更新比分</Button></div>
  <div className="live-center-filters"><div className="score-filters" role="group" aria-label="篩選比分狀態">{[['all','全部'],['live','進行中'],['upcoming','未開賽'],['final','已完賽']].map(([value,label])=><Button key={value} variant="ghost" aria-pressed={filter===value} onClick={()=>setFilter(value)}>{label}</Button>)}</div><p>{data?.games.length?`更新 ${stamp(data.games[0]?.source.fetchedAt,true)}（台灣）`:loading?'正在同步…':'等待來源更新'}</p></div>
  {(error||data?.error)&&<p className="live-data-notice" role="status">{error||data?.error}</p>}
  {!!shown.length&&<div className="live-strip-controls"><span>共 {shown.length} 場 · 左右滑動查看全部</span><div><Button variant="outline" aria-label="向左查看賽事" disabled={!scrollState.left} onClick={()=>scrollGames(-1)}><ChevronLeft/></Button><Button variant="outline" aria-label="向右查看賽事" disabled={!scrollState.right} onClick={()=>scrollGames(1)}><ChevronRight/></Button></div></div>}
  <div ref={strip} className="live-game-strip" onScroll={updateScroll} tabIndex={0} role="group" aria-label="全部賽事，可左右滑動">{shown.map(g=>{const stale=staleFeed||old(g,now);return <button type="button" className="panel live-game-chip" key={g.key} aria-pressed={selected?.key===g.key} onClick={()=>setSelectedKey(g.key)}><span className={g.status==='live'&&!stale?'live-chip-status active':'live-chip-status'}>{gameLabel(g,stale)}</span><span className="live-chip-teams"><InternationalTeamLogo league={league} name={g.away.name} size={30}/><b>{g.status==='pregame'?'—':score(g.away.score)} : {g.status==='pregame'?'—':score(g.home.score)}</b><InternationalTeamLogo league={league} name={g.home.name} size={30}/></span><span className="live-chip-names">{g.away.name}<br/>對 {g.home.name}</span><small>{g.startTime?stamp(g.startTime):'時間尚未提供'}</small></button>})}</div>
  {selected?<SelectedGame game={selected} stale={staleFeed||old(selected,now)} onRefresh={()=>setRetry(v=>v+1)} loading={loading} onDetails={onGameDetails?()=>onGameDetails(selected.key.slice(selected.key.indexOf(':')+1)):undefined}/>:<p className="panel live-empty">{!data?error?'比分暫時無法取得，請重試。':'正在取得賽程…':games.length?'沒有符合此狀態的比賽。':`${day} 尚未取得已核對的 ${league} 賽事；不代表當天沒有比賽。`}</p>}
 </section>;
}
