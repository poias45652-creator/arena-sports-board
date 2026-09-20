'use client';
import {useState} from 'react';
import {UserRound} from 'lucide-react';
import {BaseDiamond,CountLights} from './live-scoreboard';
import InternationalTeamLogo from './international-team-logo';
import {internationalBatter,internationalInningRecords,internationalPosition,type InternationalLiveGame,type InternationalInningRecord} from '@/lib/international-live-display';
const stat=(n:unknown)=>typeof n==='number'&&Number.isFinite(n)?n:'—';

function InningSummary({record,game}:{record:InternationalInningRecord;game:InternationalLiveGame}){
 return <article className="live-play-card" data-record-id={record.key}><div className="live-play-main"><span className="live-player-photo"><InternationalTeamLogo league={game.league} name={game[record.side].name} size={34}/></span><div className="live-play-body"><h4>{game[record.side].name}</h4><p>本局得分：{record.runs}{record.active?' · 進行中':''}</p><div className="live-play-result"><span className={`live-event-badge ${record.runs>0?'hit':'neutral'}`}>逐局得分</span><strong className="live-play-score"><InternationalTeamLogo league={game.league} name={game.away.name} size={22}/>{stat(record.awayScore)} : {stat(record.homeScore)}<InternationalTeamLogo league={game.league} name={game.home.name} size={22}/></strong></div></div></div></article>;
}

export default function InternationalLiveRecords({game,stale}:{game:InternationalLiveGame;stale:boolean}){
 const [panel,setPanel]=useState<'player'|'scoring'>('player'),[inning,setInning]=useState('latest');
 const current=!stale&&game.status==='live',batter=current?internationalBatter(game):null;
 const records=internationalInningRecords(game),scoring=records.filter(r=>r.runs>0);
 const innings=[...new Set([...records.map(r=>r.inning),...(game.inning?[game.inning]:[])])].sort((a,b)=>a-b);
 const latest=records.at(-1)?.inning??game.inning;
 const shown=records.filter(r=>inning==='all'||r.inning===(inning==='latest'?latest:Number(inning)));
 const bases=current&&game.bases?.length===3&&game.bases.every(v=>typeof v==='boolean')?{first:game.bases[0]!,second:game.bases[1]!,third:game.bases[2]!}:null;
 return <div className="live-record-layout">
  <section className="panel live-current-panel" aria-label="當前打者與得分紀錄">
   <div className="live-panel-tabs" role="group" aria-label="切換打者與得分紀錄"><button type="button" aria-pressed={panel==='player'} onClick={()=>setPanel('player')}>當前打者 <small>NOW PLAYER</small></button><button type="button" aria-pressed={panel==='scoring'} onClick={()=>setPanel('scoring')}>得分紀錄 <small>SCORING</small></button></div>
   {panel==='player'?<div className="live-now-player">{batter?<><div className="live-now-identity"><span className="live-player-photo"><UserRound aria-hidden="true"/></span><div><p className="live-side-label">{batter.side==='away'?'客隊進攻':batter.side==='home'?'主隊進攻':'當前打者'}</p><h3>{batter.order?`第 ${batter.order} 棒 `:''}{batter.name}</h3><p>對戰投手：{game.currentPitcher?.name||'—'}</p></div></div><div className="live-batter-stats">{[['打數','AT_BATS'],['安打','HITS'],['全壘打','HOME_RUNS'],['打點','RBIS']].map(([label,key])=><div key={key}><span>{label}</span><strong>{stat(batter.stats?.[key])}</strong></div>)}</div><div className="international-current-count"><BaseDiamond bases={bases} compact/><CountLights count={{balls:game.balls,strikes:game.strikes,outs:game.outs}} compact/></div><h4 className="live-subheading">本打席逐球紀錄</h4><p className="live-empty">尚無逐球紀錄。</p></>:<p className="live-empty">{game.status==='final'?'比賽已結束，請查看得分與各局紀錄。':game.status==='pregame'?'比賽尚未開始。':stale?'場況待更新。':'尚無當前打者資料。'}</p>}</div>:<div className="live-scoring-list">{scoring.map(r=><div key={r.key}><p className="live-scoring-inning">{r.inning} 局{r.half==='top'?'上':'下'}</p><InningSummary record={r} game={game}/></div>)}{!scoring.length&&<p className="live-empty">{records.length?'目前沒有得分紀錄。':'尚無得分紀錄。'}</p>}</div>}
   <details className="international-lineup-details"><summary>先發與打序 <small>LINEUP</small></summary><div className="international-lineups">{(['away','home'] as const).map(side=><div key={side}><h4><InternationalTeamLogo league={game.league} name={game[side].name} size={30}/>{game[side].name}</h4><p>預告先發：{game.starters[side]?.name||'—'}</p>{game.lineups[side].length?<ol>{game.lineups[side].map((p,i)=><li key={`${p.id||p.name}:${i}`}><span>{p.position==='PITCHER'?'投':p.order??'—'}</span>{p.name||'—'}<small>{internationalPosition(p.position)}</small></li>)}</ol>:<p className="live-empty">尚無打序。</p>}</div>)}</div></details>
  </section>
  <section className="panel live-all-plays" aria-label="各局文字紀錄"><h3 className="live-record-title">各局紀錄 <small>ALL PLAYS</small></h3><div className="live-inning-filter" role="group" aria-label="篩選局數">{[['latest','最新局'],['all','全部'],...innings.map(n=>[String(n),`${n} 局`])].map(([value,label])=><button type="button" key={value} aria-pressed={inning===value} onClick={()=>setInning(value)}>{label}</button>)}</div>
   {shown.map(r=><section key={r.key} className="live-inning-group" aria-label={`${r.inning} 局${r.half==='top'?'上':'下'}`}><h4><InternationalTeamLogo league={game.league} name={game[r.side].name} size={26}/>{r.inning} 局{r.half==='top'?'上':'下'}<span>{game[r.side].name}</span></h4><InningSummary record={r} game={game}/></section>)}
   {!shown.length&&<p className="live-empty">{game.status==='pregame'?'開賽後顯示各局紀錄。':'尚無本局紀錄。'}</p>}
  </section>
 </div>;
}
