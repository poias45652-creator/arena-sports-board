'use client';
import type {NbaGame} from '@/lib/nba';
import type {NbaAnalysis} from '@/lib/nba-analysis';

export default function BasketballPlayerDetails({game,analysis}:{game:NbaGame;analysis:NbaAnalysis}){
 const context='playerContext' in analysis?analysis.playerContext:undefined;
 if(context?.status!=='applied')return <p className="mt-3 text-sm text-slate-400">尚無可用的球員與輪替資料。</p>;
 return <div className="mt-4 nba-analysis-numbers">
  {!context.recommendationEligible&&<div className="nba-estimates"><div><span>輪替情境・客勝</span><b>{context.probabilityRange?`${((1-context.probabilityRange[1])*100).toFixed(1)}–${((1-context.probabilityRange[0])*100).toFixed(1)}%`:'—'}</b></div><div><span>輪替情境・主勝</span><b>{context.probabilityRange?`${(context.probabilityRange[0]*100).toFixed(1)}–${(context.probabilityRange[1]*100).toFixed(1)}%`:'—'}</b></div></div>}
{context?.status==='applied'&&<details className="nba-player-rotation"><summary>球員數據與預估上場</summary>{(['away','home'] as const).map(side=><div className="nba-table-scroll" key={side}><table className="nba-quarter-table"><caption>{game[side].name}・近期個人成績</caption><thead><tr><th>球員</th><th>得分</th><th>籃板</th><th>助攻</th><th>預估分鐘</th><th>出賽狀態</th></tr></thead><tbody>{[...context[side]].sort((a,b)=>b.minutes-a.minutes).map(player=><tr key={player.id}><th><a href={game[side].league==='WNBA'?player.sourceUrl:`/players/nba/${player.id}`}>{player.name}</a></th><td>{player.rating?.points.toFixed(1)??'—'}</td><td>{player.rating?.rebounds.toFixed(1)??'—'}</td><td>{player.rating?.assists.toFixed(1)??'—'}</td><td>{Math.round(player.minutesLow)}–{Math.round(player.minutesHigh)}</td><td>{({out:'缺席',doubtful:'可能缺席',questionable:'出賽存疑',probable:'可能出賽',expected:'預計出賽',unknown:'未確認'} as const)[player.status]}</td></tr>)}</tbody></table></div>)}</details>}
 </div>;
}
