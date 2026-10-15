'use client';
import {useEffect,useState} from 'react';
import {ChevronDown,RefreshCw,UserRound} from 'lucide-react';
import {nbaPeriod,type NbaGame} from '@/lib/nba';
import {basketballPlayText,type BasketballDetail,type BasketballLeague,type BoxPlayer} from '@/lib/basketball-live';
import {NbaMatch,NbaQuarters,nbaTime} from './nba-match';
import {nbaRequest} from './nba-request';
function PlayerPhoto({player}:{player:BoxPlayer}){
 const [failed,setFailed]=useState(false);
 return <span className="basketball-player-photo">{player.photo&&!failed?<img src={player.photo} alt="" width={48} height={48} loading="lazy" onError={()=>setFailed(true)}/>:<UserRound size={26}/>}</span>;
}
const primaryStats=[['points','PTS','得分'],['rebounds','REB','籃板'],['assists','AST','助攻'],['minutes','MIN','上場時間']];
const extraStats=[['fieldGoalsMade-fieldGoalsAttempted','FG','投籃'],['threePointFieldGoalsMade-threePointFieldGoalsAttempted','3PT','三分'],['freeThrowsMade-freeThrowsAttempted','FT','罰球'],['steals','STL','抄截'],['blocks','BLK','阻攻'],['turnovers','TO','失誤'],['offensiveRebounds','OREB','進攻籃板'],['defensiveRebounds','DREB','防守籃板'],['fouls','PF','犯規'],['plusMinus','+/-','正負值']];
function PlayerCard({player}:{player:BoxPlayer}){
 const stat=([key,short]:string[])=>player.didNotPlay?'—':player.stats[key]??player.stats[short]??'—';
 return <article className="basketball-player-card"><header><PlayerPhoto player={player}/><div><strong>{player.name}</strong><small>#{player.jersey||'—'} {player.position}{player.starter?'・先發':''}{player.didNotPlay?'・未上場':''}</small></div></header><div className="basketball-player-numbers">{primaryStats.map(s=><div key={s[0]}><span>{s[2]}</span><b>{stat(s)}</b></div>)}</div><details><summary>展開資料<ChevronDown size={15}/></summary><dl>{extraStats.map(s=><div key={s[0]}><dt>{s[2]}</dt><dd>{stat(s)}</dd></div>)}</dl></details></article>;
}
export default function BasketballLiveCenter({league,games,day}:{league:BasketballLeague;games:NbaGame[];day:string}){
 const [selected,setSelected]=useState('');
 const game=games.find(g=>g.id===selected)||games.find(g=>g.state==='live')||games[0];
 if(!game)return null;
 return <div className="basketball-live-center"><p className="basketball-live-caption">共 {games.length} 場・左右滑動選擇比賽・每 10 秒檢查更新</p><div className="basketball-game-strip" role="group" aria-label="選擇比賽">{games.map(g=><button type="button" key={g.id} aria-pressed={g.id===game.id} onClick={()=>setSelected(g.id)}><span className={g.state==='live'?'nba-live':''}>{g.state==='live'?'LIVE・':''}{g.statusLabel}</span><div><img src={g.away.logo} alt="" width={40} height={40}/><b>{g.awayScore!==null&&g.homeScore!==null?`${g.awayScore} : ${g.homeScore}`:'VS'}</b><img src={g.home.logo} alt="" width={40} height={40}/></div><strong>{g.away.name}<br/>對 {g.home.name}</strong><time dateTime={g.start}>{g.timeConfirmed?nbaTime(g.start):'時間待定'}（台灣）</time></button>)}</div><GameDetails key={`${league}:${game.id}`} league={league} game={game} day={day}/></div>;
}
function GameDetails({league,game,day}:{league:BasketballLeague;game:NbaGame;day:string}){
 const [data,setData]=useState<BasketballDetail|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true),[revision,setRevision]=useState(0),[team,setTeam]=useState(game.away.id),[period,setPeriod]=useState(0),[limit,setLimit]=useState(60);
 useEffect(()=>{
  const controller=new AbortController();let busy=false,timer:ReturnType<typeof setTimeout>;
  async function load(){if(busy||controller.signal.aborted||document.hidden)return;clearTimeout(timer);busy=true;setLoading(true);
   try{const next:BasketballDetail=await nbaRequest(`/api/${league.toLowerCase()}?kind=detail&date=${day}&game=${game.id}`,controller.signal);if(!controller.signal.aborted){setData(next);setError('');}}
   catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:'比賽明細更新失敗');}
   finally{busy=false;if(!controller.signal.aborted){setLoading(false);timer=setTimeout(()=>void load(),game.state==='live'?10000:game.state==='scheduled'?30000:300000);}}
  }
  void load();const resume=()=>{if(!document.hidden)void load();else clearTimeout(timer);};document.addEventListener('visibilitychange',resume);window.addEventListener('online',resume);window.addEventListener('arena-refresh-all',resume);
  return()=>{controller.abort();clearTimeout(timer);document.removeEventListener('visibilitychange',resume);window.removeEventListener('online',resume);window.removeEventListener('arena-refresh-all',resume);};
 },[league,game.id,game.state,day,revision]);
 const detail=data?.game,shown=detail||game,players=data?.teams.find(t=>t.team.id===team)?.players||[],allPlayers=data?.teams.flatMap(t=>t.players)||[];
 const periods=[...new Set(data?.plays.map(p=>p.period)||[])].sort((a,b)=>a-b),plays=(data?.plays||[]).filter(p=>!period||p.period===period);
 const teamStats=[['fieldGoalsMade-fieldGoalsAttempted','投籃'],['threePointFieldGoalsMade-threePointFieldGoalsAttempted','三分'],['freeThrowsMade-freeThrowsAttempted','罰球'],['totalRebounds','籃板'],['assists','助攻'],['totalTurnovers','失誤']];
 return <section className="basketball-detail" aria-label="比賽詳細資料"><div className="basketball-scoreboard"><h2>比分看板 <small>SCOREBOARD</small></h2><div className="basketball-score-meta"><span>{shown.state==='live'?'LIVE・':''}{shown.statusLabel}</span><span>{data?`更新 ${nbaTime(data.fetchedAt)}`:'正在取得明細'}{error?'・更新暫停':''}</span><button type="button" disabled={loading} aria-label="更新比賽明細" onClick={()=>setRevision(v=>v+1)}><RefreshCw size={16} className={loading?'animate-spin':''}/></button></div><NbaMatch game={shown}/><NbaQuarters game={shown}/>{data?.venue&&<p className="basketball-venue">{data.venue}</p>}</div>
  {error&&<p className="nba-alert" role="alert">{error}{data?'；以下保留上次成功更新的紀錄。':''}<button type="button" onClick={()=>setRevision(v=>v+1)}>重試</button></p>}
  {loading&&!data&&<p className="nba-empty" role="status">正在取得球員成績與逐球紀錄…</p>}
  {data&&<><section className="basketball-team-comparison" aria-label="球隊數據比較"><h3>球隊數據</h3><div><span>{game.away.code}</span><span>項目</span><span>{game.home.code}</span></div>{teamStats.map(([key,label])=><div key={key}><b>{data.teams.find(t=>t.team.id===game.away.id)?.stats[key]??'—'}</b><span>{label}</span><b>{data.teams.find(t=>t.team.id===game.home.id)?.stats[key]??'—'}</b></div>)}</section><div className="basketball-live-columns"><section className="basketball-boxscore"><h3>球員數據 <small>BOX SCORE</small></h3><div className="nba-filters" role="group" aria-label="球員球隊">{[game.away,game.home].map(t=><button type="button" key={t.id} aria-pressed={team===t.id} onClick={()=>setTeam(t.id)}><img src={t.logo} alt="" width={24} height={24}/>{t.name}</button>)}</div>{players.length?players.map(p=><PlayerCard key={p.id} player={p}/>):<p className="basketball-empty">{shown.state==='scheduled'?'開賽後顯示球員本場成績':'來源尚未提供本場球員成績'}</p>}</section><section className="basketball-playbyplay"><h3>逐球紀錄 <small>PLAY BY PLAY</small></h3><div className="nba-filters" role="group" aria-label="逐球節次"><button type="button" aria-pressed={period===0} onClick={()=>{setPeriod(0);setLimit(60);}}>全部</button>{periods.map(p=><button type="button" key={p} aria-pressed={period===p} onClick={()=>{setPeriod(p);setLimit(60);}}>{nbaPeriod(p)}</button>)}</div><p className="basketball-play-order">最新紀錄在上・{plays.length} 筆</p>{plays.slice(0,limit).map(p=>{const t=[game.away,game.home].find(t=>t.id===p.teamId),player=allPlayers.find(a=>a.id===p.playerIds[0]);return <article className="basketball-play" key={p.id} data-scoring={p.scoring}><header><span>{t&&<img src={t.logo} alt="" width={25} height={25}/>}<b>{t?.name||'比賽紀錄'}</b></span><time>{nbaPeriod(p.period)} {p.clock}</time></header><div>{player&&<div className="basketball-play-player"><PlayerPhoto player={player}/><strong>{player.name}</strong></div>}<p>{basketballPlayText(p.text)}</p><small>{p.awayScore??'—'} : {p.homeScore??'—'}{p.scoring?'・得分':''}</small></div></article>;})}{!plays.length&&<p className="basketball-empty">{shown.state==='scheduled'?'開賽後顯示逐球紀錄':'來源尚未提供逐球紀錄'}</p>}{plays.length>limit&&<button className="basketball-load-more" type="button" onClick={()=>setLimit(v=>v+60)}>載入較早紀錄（尚有 {plays.length-limit} 筆）</button>}</section></div></>}
 </section>;
}
