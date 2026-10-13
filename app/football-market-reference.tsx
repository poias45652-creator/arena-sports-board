import type {FootballGame} from '@/lib/football';
import {currentFootballMarketReference} from '@/lib/football-market-reference';

export default function FootballMarketReference({game,now}:{game:FootballGame;now:number}){
  const reference=currentFootballMarketReference(game,now);if(!reference)return null;
  const p=reference.probabilities,favourite=p.home>p.away?'home':'away',team=game[favourite],handicap=favourite==='home'?reference.homeHandicap:reference.awayHandicap;
  return <section className="football-market-reference" aria-label="市場參考">
    <header><strong>市場參考</strong><a href={reference.sourceUrl} target="_blank" rel="noopener noreferrer">ESPN · {reference.provider}</a></header>
    <p>{p[favourite]>p.draw?<><b>{team.name}</b> 勝率參考 <strong>{(p[favourite]*100).toFixed(1)}%</strong></>:'市場未顯示明確勝方'}</p>
    <div>{[['主勝',p.home],['和局',p.draw],['客勝',p.away]].map(([label,value])=><span key={String(label)}>{label} <b>{(Number(value)*100).toFixed(1)}%</b></span>)}</div>
    {handicap!==null&&handicap<0&&<p>{team.name} 讓 {Math.abs(handicap)} 球{reference.total!==null?` · 大小球 ${reference.total}`:''}</p>}
    <small>由三方賠率去除水位推算，非模型預測；讓球不代表保證贏幾球。</small>
    <small>擷取時間 {new Date(reference.fetchedAt).toLocaleTimeString('zh-TW',{timeZone:'Asia/Taipei',hour12:false})}</small>
  </section>;
}
