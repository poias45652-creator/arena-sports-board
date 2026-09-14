'use client';
import {useEffect,useState} from 'react';
import {ChevronLeft,ChevronRight,RefreshCw,UserRound} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {fresh,shiftDay,taipeiDay} from '@/lib/baseball';
import {inningRun,pitchCallZh,playEventZh} from '@/lib/live-display';
import type {LiveBases,LiveCount,LiveGameDetail,LivePlay} from '@/lib/live-game';
import {useSource} from './use-source';
import {gameDetailZh,teamZh} from './zh';
import {TeamLogo} from './team-name';
import PlayerLink from './player-link';

type Scores={date:string;games:any[];fetchedAt:string};
const clock=(stamp:string|null|undefined)=>stamp?new Date(stamp).toLocaleTimeString('zh-TW',{timeZone:'Asia/Taipei'}):'尚未同步';
const stat=(value:any)=>typeof value==='number'&&Number.isFinite(value)?value:'—';
const noCount:LiveCount={balls:null,strikes:null,outs:null};
const gameState=(game:any)=>game.status?.abstractGameState;

export function CountLights({count,compact=false}:{count:LiveCount;compact?:boolean}){
 return <div className={`live-counts${compact?' live-counts-compact':''}`}>{([
  ['S','好球',count.strikes,3,'strike'],['B','壞球',count.balls,4,'ball'],['O','出局',count.outs,3,'out'],
 ] as const).map(([letter,label,value,max,tone])=><div key={letter} aria-label={`${label} ${value??'未知'}`}><b aria-hidden="true">{letter}</b><span className="live-count-dots" aria-hidden="true">{Array.from({length:max},(_,i)=><i key={i} className={value!==null&&i<value?`lit ${tone}`:''}/>)}</span><span className="live-count-number" aria-hidden="true">{value??'—'}</span></div>)}</div>;
}

export function BaseDiamond({bases,compact=false}:{bases:LiveBases;compact?:boolean}){
 const label=bases?(['first','second','third'] as const).map((b,i)=>`${i+1} 壘${bases[b]?'有人':'無人'}`).join('，'):'壘包資料尚未提供';
 return <div className={`live-diamond${compact?' live-diamond-small':''}`} role="img" aria-label={label}>
  <div className="live-basepath"/>
  {(['first','second','third'] as const).map((base,i)=><span key={base} className={`live-base live-base-${base}${bases?.[base]?' occupied':''}${!bases?' unknown':''}`} title={`${i+1} 壘${!bases?'未知':bases[base]?'有人':'無人'}`}/>)}
  <span className="live-homeplate"/>{!compact&&<span className="live-diamond-caption">{!bases?'場況待更新':Object.values(bases).some(Boolean)?'壘上有人':'壘上無人'}</span>}
 </div>;
}

function PlayerPhoto({id}:{id:number|null|undefined}){
 const [failed,setFailed]=useState(false);
 return <span className="live-player-photo"><UserRound aria-hidden="true"/>{id&&!failed&&<img src={`https://img.mlbstatic.com/mlb-photos/image/upload/w_120,q_auto:best/v1/people/${id}/headshot/67/current`} width={64} height={64} alt="" loading="lazy" onError={()=>setFailed(true)}/>}</span>;
}

export function InningBoard({game,line,state}:{game:any;line:any;state:string}){
 const innings=Math.max(line?.scheduledInnings||9,line?.currentInning||0,...(line?.innings||[]).map((i:any)=>i.num||0));
 return <div className="live-innings-scroll" tabIndex={0} aria-label="逐局比分，可左右捲動"><table className="live-innings"><caption className="sr-only">逐局得分及 R 得分、H 安打、E 失誤</caption><thead><tr><th scope="col">球隊</th>{Array.from({length:innings},(_,i)=><th key={i} scope="col">{i+1}</th>)}<th scope="col" title="得分">R</th><th scope="col" title="安打">H</th><th scope="col" title="失誤">E</th></tr></thead><tbody>{(['away','home'] as const).map(side=><tr key={side}><th scope="row"><TeamLogo id={game.teams?.[side]?.team?.id} size={28}/><span className="sr-only">{teamZh(game.teams?.[side]?.team)}</span></th>{Array.from({length:innings},(_,i)=>{
  const active=state==='Live'&&line?.currentInning===i+1&&line.inningState===(side==='away'?'Top':'Bottom');
  const value=inningRun(line,side,i+1,state);
  return <td key={i} className={active?'live-inning-active':''} aria-label={`${i+1} 局${side==='away'?'上':'下'} ${value||'尚未進行'}`}>{value||'\u00a0'}</td>;
 })}<td className="live-total">{stat(line?.teams?.[side]?.runs??game.teams?.[side]?.score)}</td><td className="live-total">{stat(line?.teams?.[side]?.hits)}</td><td className="live-total">{stat(line?.teams?.[side]?.errors)}</td></tr>)}</tbody></table></div>;
}

function PitchList({play}:{play:LivePlay}){
 return <div className="live-pitch-list">{play.pitches.length?<ol>{play.pitches.map(p=><li key={p.id}><span className="live-pitch-number">{p.number??'—'}</span><span>{pitchCallZh(p.call,p.description)}<small>{p.type||'球種尚未提供'}</small></span><strong>{p.speed===null?'—':`${p.speed.toFixed(1)} mph`}</strong><span className="live-pitch-count">{p.count.balls??'—'}–{p.count.strikes??'—'}</span></li>)}</ol>:<p className="live-empty">尚無逐球紀錄。</p>}</div>;
}

export function PlayCard({play,game}:{play:LivePlay;game:any}){
 const label=play.complete?playEventZh(play.eventType,play.event):'打席進行中';
 const tone=['single','double','triple','home_run'].includes(play.eventType)?'hit':['walk','intent_walk','hit_by_pitch'].includes(play.eventType)?'walk':play.eventType.includes('out')||play.eventType.includes('play')?'out':'neutral';
 return <article className={`live-play-card${!play.complete?' live-play-current':''}`} data-play-id={play.id}>
  {play.actions.filter(a=>!['game_advisory','batter_timeout','pitcher_step_off'].includes(a.eventType)).map(a=><div className="live-play-action" key={a.id}><strong>{playEventZh(a.eventType,a.event)}</strong><p>{a.description}</p></div>)}
  <div className="live-play-main"><PlayerPhoto key={play.batter.id} id={play.batter.id}/><div className="live-play-body"><h4>{play.battingOrder?`第 ${play.battingOrder} 棒 `:''}{play.position&&<small>{play.position} </small>}<PlayerLink id={play.batter.id} season={game.season} gameType={game.gameType}>{play.batter.name}</PlayerLink></h4><p>{label}{play.rbi!==null&&play.rbi>0?` · ${play.rbi} 分打點`:''}{play.count.outs!==null?` · ${play.count.outs} 出局`:''}</p><div className="live-play-result"><span className={`live-event-badge ${tone}`}>{label}</span><BaseDiamond bases={play.bases} compact/><strong className="live-play-score"><TeamLogo id={game.teams?.away?.team?.id} size={22}/>{play.awayScore??'—'} : {play.homeScore??'—'}<TeamLogo id={game.teams?.home?.team?.id} size={22}/></strong></div><CountLights count={play.count} compact/><details className="live-play-more"><summary>文字與逐球紀錄（{play.pitches.length} 球）</summary><p className="live-original-text">{play.description||'此打席的完整文字紀錄尚未提供。'}</p><p className="live-pitcher-name">投手：<PlayerLink id={play.pitcher.id} season={game.season} gameType={game.gameType}>{play.pitcher.name}</PlayerLink></p><PitchList play={play}/></details></div></div>
 </article>;
}

function SelectedGame({game,now,scheduleFetchedAt}:{game:any;now:number;scheduleFetchedAt:string}){
 const detail=useSource<LiveGameDetail>(`game&gamePk=${game.gamePk}`,15000);
 const [panel,setPanel]=useState<'player'|'scoring'>('player'),[inning,setInning]=useState('latest');
 const snapshot=detail.data;
 const data=snapshot&&snapshot.gamePk===game.gamePk&&snapshot.teams.home.id===game.teams?.home?.team?.id&&snapshot.teams.away.id===game.teams?.away?.team?.id?snapshot:null;
 // Do not overwrite a newer schedule feed (or a final status) with older detail.
 const useDetail=!!data&&Date.parse(data.fetchedAt)>=Date.parse(game.detailFetchedAt||scheduleFetchedAt)&&!(gameState(game)==='Final'&&data.status.abstractGameState!=='Final');
 const state=useDetail?data!.status.abstractGameState:gameState(game),line=useDetail?data!.linescore:game.linescore;
 const live=state==='Live',final=state==='Final';
 const currentStamp=useDetail?data!.fetchedAt:game.detailFetchedAt||scheduleFetchedAt;
 const currentOK=live&&fresh(currentStamp,now,60000)&&(!detail.error||!useDetail);
 const batter=line?.offense?.batter,pitcher=line?.defense?.pitcher;
 const bases:LiveBases=currentOK&&line?.offense?{first:!!line.offense.first,second:!!line.offense.second,third:!!line.offense.third}:null;
 const currentCount:LiveCount=currentOK?{balls:line?.balls??null,strikes:line?.strikes??null,outs:line?.outs??null}:noCount;
 const plays=data?.plays||[],activePlay=data?.currentPlay;
 const currentPlay=currentOK&&activePlay&&activePlay.batter.id===batter?.id&&activePlay.inning===line?.currentInning&&!activePlay.complete?activePlay:null;
 const scoring=plays.filter(p=>p.scoring),innings=[...new Set(plays.map(p=>p.inning))].sort((a,b)=>a-b);
 const latestInning=plays.at(-1)?.inning;
 const shown=plays.filter(p=>inning==='all'||p.inning===(inning==='latest'?latestInning:Number(inning)));
 const groups=shown.reduce<{key:string;inning:number;half:'top'|'bottom';plays:LivePlay[]}[]>((all,p)=>{const key=`${p.inning}-${p.half}`;let group=all.at(-1);if(group?.key!==key){group={key,inning:p.inning,half:p.half,plays:[]};all.push(group);}group.plays.push(p);return all;},[]);
 const batterStats=(data?Object.values(data.teams).flatMap((t:any)=>t.players):[]).find((p:any)=>p.id===batter?.id)?.gameStats?.batting;
 const detailedGame={...game,status:useDetail?data!.status:game.status,linescore:line};
 const pitchingCount=useDetail?data!.pitchCount:game.pitchCount;
 return <div className="live-selected" aria-label="所選賽事詳細比分" data-game-id={game.gamePk}>
  <div className="live-detail-toolbar"><span>{data?.venue||game.venue?.name||'球場尚未提供'} · 場次 {game.gamePk}</span><span>{gameDetailZh(detailedGame)}</span><Button variant="outline" onClick={detail.refresh} disabled={detail.loading}><RefreshCw className={detail.loading?'animate-spin':''}/>更新場況</Button></div>
  {detail.error&&<p className="live-data-notice" role="status">詳細場況暫時無法更新。{data?`文字紀錄停留於 ${clock(data.fetchedAt)}。`:'比分板顯示目前取得的賽程資料。'}</p>}
  {live&&!fresh(currentStamp,now,60000)&&<p className="live-data-notice" role="status">場況資料已超過一分鐘未更新，等待重新同步。</p>}
  <div className="live-game-board"><section className="panel live-score-panel" aria-label="比分看板"><h3 className="live-section-ribbon">比分看板 <small>SCOREBOARD</small></h3><div className="live-score-layout">
   {(['away','home'] as const).map(side=><div className={`live-team-score live-team-${side}`} key={side}><TeamLogo id={game.teams?.[side]?.team?.id} size={80}/><h4>{teamZh(game.teams?.[side]?.team)}</h4><span className="live-side-label">{side==='away'?'客隊':'主隊'}</span><strong>{stat(line?.teams?.[side]?.runs??game.teams?.[side]?.score)}</strong><small>{game.teams?.[side]?.leagueRecord?`${game.teams[side].leagueRecord.wins} 勝－${game.teams[side].leagueRecord.losses} 敗`:'戰績尚未提供'}</small></div>)}
   <InningBoard game={game} line={line} state={state}/>
  </div><p className="live-board-footnote">R 得分 · H 安打 · E 失誤<span>更新 {clock(currentStamp)}（台灣）</span></p></section>
  <aside className="panel live-field-panel" aria-label="即時壘包與投打狀態"><h3 className="live-section-ribbon">{gameDetailZh(detailedGame)}</h3><BaseDiamond bases={bases}/>{live?<><div className="live-field-players"><p><span>投手</span>{currentOK?<PlayerLink id={pitcher?.id} season={game.season} gameType={game.gameType}>{pitcher?.fullName||'尚未提供'}</PlayerLink>:'等待更新'}</p><p><span>打者</span>{currentOK?<PlayerLink id={batter?.id} season={game.season} gameType={game.gameType}>{batter?.fullName||'尚未提供'}</PlayerLink>:'等待更新'}</p></div><div className="live-field-bottom"><CountLights count={currentCount}/><div className="live-pitch-total"><span>用球數</span><strong>{currentOK?stat(pitchingCount):'—'}</strong></div></div></>:<p className="live-empty">{final?'本場已結束，可查看各局紀錄。':'開賽後顯示即時場況。'}</p>}</aside></div>
  <div className="live-record-layout"><section className="panel live-current-panel" aria-label="當前打者與得分紀錄"><div className="live-panel-tabs" role="group" aria-label="切換打者與得分紀錄"><button type="button" aria-pressed={panel==='player'} onClick={()=>setPanel('player')}>當前打者 <small>NOW PLAYER</small></button><button type="button" aria-pressed={panel==='scoring'} onClick={()=>setPanel('scoring')}>得分紀錄 <small>SCORING</small></button></div>
   {panel==='player'?<div className="live-now-player">{currentOK&&batter?<><div className="live-now-identity"><PlayerPhoto key={batter.id} id={batter.id}/><div><p className="live-side-label">{line.isTopInning?'客隊進攻':'主隊進攻'}</p><h3><PlayerLink id={batter.id} season={game.season} gameType={game.gameType}>{batter.fullName}</PlayerLink></h3><p>對戰投手：<PlayerLink id={pitcher?.id} season={game.season} gameType={game.gameType}>{pitcher?.fullName||'尚未提供'}</PlayerLink></p></div></div><div className="live-batter-stats">{[['打數',batterStats?.atBats],['安打',batterStats?.hits],['全壘打',batterStats?.homeRuns],['打點',batterStats?.rbi]].map(([label,value])=><div key={label}><span>{label}</span><strong>{stat(value)}</strong></div>)}</div><h4 className="live-subheading">本打席逐球紀錄</h4>{currentPlay?<PitchList play={currentPlay}/>:<p className="live-empty">等待本打席的投球資料。</p>}</>:<p className="live-empty">{final?'比賽已結束，請查看得分與各局紀錄。':live?'正在同步當前打者…':'比賽尚未開始。'}</p>}</div>:<div className="live-scoring-list">{scoring.map(p=><div key={p.id}><p className="live-scoring-inning">{p.inning} 局{p.half==='top'?'上':'下'}</p><PlayCard play={p} game={game}/></div>)}{!scoring.length&&<p className="live-empty">{!data?.playsAvailable?'正在等待得分紀錄…':'目前沒有得分紀錄。'}</p>}</div>}
  </section><section className="panel live-all-plays" aria-label="各局文字紀錄"><h3 className="live-record-title">各局紀錄 <small>ALL PLAYS</small></h3><div className="live-inning-filter" role="group" aria-label="篩選局數">{[['latest','最新局'],['all','全部'],...innings.map(i=>[String(i),`${i} 局`])].map(([value,label])=><button type="button" key={value} aria-pressed={inning===value} onClick={()=>setInning(value)}>{label}</button>)}</div>
   {data&&<p className="live-record-stamp">文字紀錄更新 {clock(data.fetchedAt)}（台灣）</p>}
   {groups.map(group=><section key={group.key} className="live-inning-group" aria-label={`${group.inning} 局${group.half==='top'?'上':'下'}`}><h4><TeamLogo id={game.teams?.[group.half==='top'?'away':'home']?.team?.id} size={26}/>{group.inning} 局{group.half==='top'?'上':'下'}<span>{teamZh(game.teams?.[group.half==='top'?'away':'home']?.team)}</span></h4>{group.plays.map(play=><PlayCard key={play.id} play={play} game={game}/>)}</section>)}
   {!shown.length&&<p className="live-empty">{detail.loading&&!data?'正在取得各局紀錄…':!data?.playsAvailable?'文字紀錄尚未取得。':live?'等待第一筆打席紀錄。':final?'此場次尚無可用的文字紀錄。':'開賽後顯示逐打席文字紀錄。'}</p>}
  </section></div>
 </div>;
}

export default function LiveScoreboard(){
 const [now,setNow]=useState(Date.now()),[date,setDate]=useState<string|null>(null),[selectedId,setSelectedId]=useState<number|null>(null),[filter,setFilter]=useState('all');
 useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),10000);return()=>clearInterval(timer);},[]);
 const today=taipeiDay(now),day=date??today;
 const source=useSource<Scores>(`scores&date=${day}`,15000);
 // A date change must not render the preceding date's cached response.
 const data=source.data?.date===day?source.data:null;
 const games=[...(data?.games||[])].sort((a,b)=>Number(gameState(b)==='Live')-Number(gameState(a)==='Live')||Date.parse(a.gameDate)-Date.parse(b.gameDate));
 const shown=games.filter(g=>filter==='all'||filter==='live'&&gameState(g)==='Live'||filter==='final'&&gameState(g)==='Final'||filter==='upcoming'&&!['Live','Final'].includes(gameState(g)));
 const selected=shown.find(g=>g.gamePk===selectedId)||shown[0];
 function changeDay(value:string|null){setDate(value);setSelectedId(null);}
 return <section className="live-center" aria-label="MLB 即時比分與文字轉播">
  <div className="panel live-center-heading"><div><h2>即時比分</h2><p>MLB · 台灣時間 · 每 15 秒更新</p></div><div className="live-date-picker"><Button variant="ghost" aria-label="前一天" onClick={()=>changeDay(shiftDay(day,-1))}><ChevronLeft/></Button><label><span className="sr-only">選擇比分日期</span><input type="date" value={day} min="2000-01-01" max="2100-12-31" onChange={e=>{if(e.target.value)changeDay(e.target.value);}}/></label><Button variant="ghost" aria-label="後一天" onClick={()=>changeDay(shiftDay(day,1))}><ChevronRight/></Button><Button variant="outline" onClick={()=>changeDay(null)} disabled={date===null}>今天</Button></div><Button variant="outline" onClick={source.refresh} disabled={source.loading}><RefreshCw className={source.loading?'animate-spin':''}/>更新比分</Button></div>
  <div className="live-center-filters"><div className="score-filters" role="group" aria-label="篩選比分狀態">{[['all','全部'],['live','進行中'],['upcoming','未開賽'],['final','已完賽']].map(([value,label])=><Button key={value} variant="ghost" aria-pressed={filter===value} onClick={()=>setFilter(value)}>{label}</Button>)}</div><p>{data?`更新 ${clock(data.fetchedAt)}（台灣）`:'正在同步…'}</p></div>
  {source.error&&<p className="live-data-notice" role="status">比分更新失敗：{source.error}{data?'，目前保留上次取得的資料。':''}</p>}
  <div className="live-game-strip" role="group" aria-label="選擇比賽">{shown.map(game=><button type="button" className="panel live-game-chip" key={game.gamePk} aria-pressed={selected?.gamePk===game.gamePk} onClick={()=>setSelectedId(game.gamePk)}><span className={gameState(game)==='Live'?'live-chip-status active':'live-chip-status'}>{gameDetailZh(game)}</span><span className="live-chip-teams"><TeamLogo id={game.teams?.away?.team?.id} size={30}/><b>{stat(game.teams?.away?.score)} : {stat(game.teams?.home?.score)}</b><TeamLogo id={game.teams?.home?.team?.id} size={30}/></span><span className="live-chip-names">{teamZh(game.teams?.away?.team)}<br/>對 {teamZh(game.teams?.home?.team)}</span><small>{game.venue?.name||'球場尚未提供'}</small></button>)}</div>
  {selected&&data?<SelectedGame key={`${day}:${selected.gamePk}`} game={selected} now={now} scheduleFetchedAt={data.fetchedAt}/>:<p className="panel live-empty">{!data?source.error?'比分暫時無法取得，請重試。':'正在取得賽程…':games.length?'沒有符合此狀態的比賽。':'這個台灣日期沒有 MLB 賽事。'}</p>}
 </section>;
}
