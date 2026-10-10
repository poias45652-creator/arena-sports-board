'use client';

import {useId} from 'react';
import {createPortal} from 'react-dom';
import type {FootballGame,FootballLeague} from '@/lib/football';
import {footballTeamHref} from '@/lib/football-team-profile';
import {footballScoreScenarios} from '@/lib/football-score-scenarios';
import {footballRecommendations,footballSourceStale,retainFootballForecast,type FootballReport,type ReadyFootballAnalysis} from '@/lib/football-recommendations';
import {useSuperWorkspace} from './super-workspace';

import SportMarkets from './sport-markets';

const percent=(n:number)=>(n*100).toFixed(1)+'%';
const time=(value:string)=>new Date(value).toLocaleString('zh-TW',{timeZone:'Asia/Taipei',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false});

// Render the exact same numbers in the match card and the floating recommendation.
export function FootballAnalysisNumbers({analysis}:{analysis:ReadyFootballAnalysis}){
  const p=analysis.probabilities,scenarios=footballScoreScenarios(analysis);
  return <>
    <div className="football-probabilities">{[['主勝',p.home],['和局',p.draw],['客勝',p.away]].map(([label,value])=><div key={String(label)}><span>{label}</span><strong>{percent(Number(value))}</strong></div>)}</div>
    <div className="football-probability-bar" aria-hidden="true"><span style={{width:p.home*100+'%'}}/><span style={{width:p.draw*100+'%'}}/><span style={{width:p.away*100+'%'}}/></div>
    <div className="football-goals"><div><span>模型大 2.5 球</span><b>{percent(p.over25)}</b></div><div><span>模型小 2.5 球</span><b>{percent(p.under25)}</b></div><div><span>雙方都進球</span><b>{percent(p.btts)}</b></div></div>
    {scenarios.scores.length>0&&<div className="football-scores" data-score-mode={scenarios.mode}><span>三組比分{scenarios.mode==='attacking'?'情境':'預測'}<small>主：客</small></span>{scenarios.scores.map(s=><div key={`${s.home}:${s.away}`}><small className="football-score-label">{s.label}</small><b>{s.home} : {s.away}</b><small>{percent(s.probability)}</small></div>)}</div>}
    {scenarios.mode==='attacking'&&<div className="football-margin-chances"><span>{scenarios.favourite==='home'?'主隊':'客隊'}贏2球以上 <b>{percent(scenarios.winBy2Plus!)}</b></span><span>贏3球以上 <b>{percent(scenarios.winBy3Plus!)}</b></span><small>進攻、大勝為進取情境；百分比為各比分的模型機率。</small></div>}
  </>;
}

type Props={snapshot:any;oddsError:string;games:FootballGame[];reports:Record<string,FootballReport>;league:FootballLeague;leagueName:string;day:string;now:number;sourceFetchedAt?:string;unavailable:boolean;loading:boolean};
export default function FootballRecommendationsPane(props:Props){
  const id=useId(),workspace=useSuperWorkspace();
  const docked=workspace?.activePane===id&&!!workspace.host;
  const clock=Math.max(props.now,Date.now());
  const unavailable=props.unavailable||(props.sourceFetchedAt?footballSourceStale(props.sourceFetchedAt,clock):!props.loading);
  const rows=docked?footballRecommendations({...props,now:clock,unavailable}):[];
  const pending=props.loading||props.games.some(game=>((game.state==='scheduled'&&game.timeConfirmed&&Date.parse(game.start)>clock)||retainFootballForecast(game,clock))&&!props.reports[game.id]);
  return <>
    <span data-super-parlay={id} hidden/>
    {docked&&createPortal(<section className="football-recommendations" aria-label="足球推薦內容">
      <div className="football-recommendations-context"><strong>{props.leagueName}</strong><span>{props.day}・{rows.length} 場</span></div>
      {rows.length?rows.map(row=><article className="football-recommendation-card" key={row.game.id}>
        <header><time dateTime={row.game.start}>{time(row.game.start)}</time><span>{row.game.state==='live'?'LIVE':row.game.state==='final'?'完場':'90 分鐘'}</span></header>
        {retainFootballForecast(row.game,clock)&&<p>賽前預測・保留至今日 24:00</p>}
        <div className="football-recommendation-match"><div><small>主隊</small><a className="football-team-link" href={footballTeamHref(props.league,row.game.home.id,props.day)} aria-label={`查看${row.game.home.name}球隊數據`}><strong>{row.game.home.name}</strong></a></div><b>{row.game.homeScore!==null&&row.game.awayScore!==null?`${row.game.homeScore} : ${row.game.awayScore}`:'VS'}</b><div><small>客隊</small><a className="football-team-link" href={footballTeamHref(props.league,row.game.away.id,props.day)} aria-label={`查看${row.game.away.name}球隊數據`}><strong>{row.game.away.name}</strong></a></div></div>
        <dl className="football-recommendation-directions">{[['勝負推薦',row.result],['雙方進球',row.btts]].map(([label,pick])=>typeof pick==='object'&&pick&&<div key={String(label)}><dt>{String(label)}</dt><dd><strong>{pick.label}</strong><b>{percent(pick.probability)}</b></dd></div>)}</dl>
        <FootballAnalysisNumbers analysis={row.analysis}/><SportMarkets game={row.game} analysis={row.analysis} snapshot={props.snapshot} error={props.oddsError} sport="FOOTBALL" now={clock}/>
      </article>):<p className="football-recommendations-empty" role="status">{unavailable?'推薦資料暫時無法取得':pending?'正在整理足球推薦…':'目前沒有可用的賽前推薦'}</p>}
    </section>,workspace!.host!)}
  </>;
}
