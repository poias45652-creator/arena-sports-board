'use client';
import {basketballMarketGrid,footballMarketGrids,sportMarketStatus,settleSportGrid,sportQuoteLabel,preferredSportOutcome,type SportFixture,type SportQuote,type SportOutcomes} from '@/lib/sport-super-markets';
const percent=(n:number)=>(n*100).toFixed(1)+'%';
export default function SportMarkets({game,analysis,snapshot,error='',sport,now}:{game:SportFixture;analysis?:any;snapshot:any;error?:string;sport:'NBA'|'WNBA'|'FOOTBALL';now:number}){
 if(game.state!=='scheduled'||!game.timeConfirmed||Date.parse(game.start)<=now)return null;
 const status=sportMarketStatus(error?null:snapshot,game,sport,now),event=!error?status.event:null;
 const valid=analysis?.status==='ready'&&analysis.expected&&analysis.probabilities&&now-Date.parse(analysis.capturedAt)>=-60000&&now-Date.parse(analysis.capturedAt)<15*60000;
 const e=valid?analysis.expected:null,p=valid?analysis.probabilities:null,context=valid?analysis.playerContext:null;
 // Applied WNBA projections can rank market scenarios while availability is pending.
 // Explain that uncertainty visibly; unavailable/stale models remain ineligible.
 const wnbaScenario=sport==='WNBA'&&context?.status==='applied'&&!context.recommendationEligible;
 const eligible=!!valid&&(!context||context.status==='applied'&&(context.recommendationEligible||context.preseason||wnbaScenario));
 const recommendationTitle=wnbaScenario?'依目前球員情境的獲利機率（含中洞贏）推薦；出賽狀態待確認':context?.preseason?'依熱身賽輪替情境的獲利機率（含中洞贏）推薦':'依模型獲利機率（含中洞贏）推薦';
 const football=sport==='FOOTBALL'&&valid?footballMarketGrids(analysis):null;
 const margin=sport==='FOOTBALL'?football?.margin||[]:valid?basketballMarketGrid(e.margin,context?.marginSigma??analysis.simulation?.sigma,'margin',p.home):[];
 const total=sport==='FOOTBALL'?football?.total||[]:valid?basketballMarketGrid(e.total,analysis.totalSigma,'total'):[];
 function identity(side:'home'|'away'){
  const team=game[side],logo=team.logo||(sport==='FOOTBALL'&&/^\d+$/.test(team.id||'')?`https://a.espncdn.com/i/teamlogos/soccer/500/${team.id}.png`:null);
  return <>{logo&&<img className="sport-market-logo" src={logo} alt="" width={24} height={24} loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={e=>{e.currentTarget.hidden=true;}}/>}<span>{team.name}</span></>;
 }
 function market(quote:SportQuote|null,kind:'spread'|'total'){
  const sides=kind==='spread'?['home','away'] as const:['over','under'] as const;
  const outcomes=quote?sides.map(side=>settleSportGrid(kind==='spread'?margin:total,quote,side)):[];
  const best=eligible?preferredSportOutcome(outcomes):null;
  return <div className="sport-market-block" data-market-state={status.markets[kind].code}><div className="sport-market-heading"><strong>{kind==='spread'?(sport==='FOOTBALL'?'全場讓球':'全場讓分'):(sport==='FOOTBALL'?'全場大小球':'全場大小分')}</strong>{!quote&&<b>{status.markets[kind].message}</b>}</div>{quote&&<div className="sport-market-options">{sides.map((side,i)=>{
   const r=outcomes[i];
   return <div className="sport-market-option" key={side}>
    <div className="sport-market-option-heading"><strong className="sport-market-team">{side==='home'||side==='away'?identity(side):<span>{side==='over'?'大':'小'}</span>}{best===i&&r&&<em title={recommendationTitle}>推薦</em>}</strong><strong className="sport-market-quote">{sportQuoteLabel(quote,side)} @{(i===0?quote.home:quote.away).toFixed(3)}</strong></div>
    {r?<Outcome result={r}/>:<p className="sport-market-pending">{valid?'暫無可用分布':'等待分析'}</p>}
   </div>;
  })}</div>}</div>;
 }
 const summary=status.availableCount?`${status.availableCount} 種玩法`:error?'來源連線異常':!snapshot?'資料更新中':'暫無可用玩法';
 return <details key={`${sport}:${game.id}:${game.start}`} className="match-market-details sport-market-details" data-market-status={error?'source_error':status.code}><summary><span>查看分析</span><span>{valid?summary:'分析更新中'}</span></summary><section className="sport-markets" aria-label="全場讓分與大小分析"><div className="sport-market-heading"><span>{sport==='FOOTBALL'?'90 分鐘・不含加時':'全場・含延長賽'}</span>{event&&<small>賠率不含本金</small>}</div>{error?<p role="status">{error}</p>:!event?<p role="status">{status.message}</p>:<>
  {wnbaScenario&&<p className="sport-market-pending">推薦依目前球員情境推估；出賽狀態待確認。</p>}
  {market(event.spread,'spread')}{market(event.total,'total')}
  <div className="sport-market-block" data-market-state={status.markets.moneyline.code}><div className="sport-market-heading"><strong>全場獨贏</strong>{!event.moneyline&&<b>{status.markets.moneyline.message}</b>}</div>{event.moneyline&&<div className="sport-market-options sport-market-moneyline">{(['home',...(sport==='FOOTBALL'?['draw']:[]),'away'] as ('home'|'draw'|'away')[]).map(side=><div className="sport-market-option" key={side}><div className="sport-market-option-heading"><strong className="sport-market-team">{side==='draw'?<span>和局</span>:identity(side)}</strong><strong className="sport-market-quote">@{event.moneyline![side]!.toFixed(3)}</strong></div>{p&&<div className="sport-market-win-rate"><span>勝率</span><b>{percent(p[side])}</b></div>}</div>)}</div>}</div>
 </>}</section></details>;
}
function Outcome({result:r}:{result:SportOutcomes}){
 return <><dl className="sport-market-outcomes">{([['全贏',r.win,'win'],['中洞贏',r.partialWin,'win'],['中洞輸',r.partialLoss,'loss'],['全輸',r.loss,'loss']] as const).map(([label,p,tone])=><div key={label} data-tone={tone}><dt>{label}</dt><dd>{percent(p)}</dd></div>)}</dl>{r.push>1e-7&&<div className="sport-market-push"><span>退回</span><b>{percent(r.push)}</b></div>}</>;
}
