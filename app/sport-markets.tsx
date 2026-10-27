'use client';
import {memberOddsRecovery,recoverMemberOdds} from '@/lib/member-odds-client';
import {basketballMarketGrid,footballMarketGrids,sportMarketStatus,settleSportGrid,sportQuoteLabel,preferredSportOutcome,type SportFixture,type SportQuote,type SportOutcomes} from '@/lib/sport-super-markets';
const percent=(n:number)=>(n*100).toFixed(1)+'%';
export type SportMarketAnalysisState='loading'|'ready'|'waiting'|'error'|'stale'|'unavailable';
const analysisLabels:Record<SportMarketAnalysisState,string>={loading:'分析載入中',ready:'分析已就緒',waiting:'分析資料不足',error:'分析更新失敗',stale:'分析已過期',unavailable:'分析暫不可用'};
const analysisMessages:Record<Exclude<SportMarketAnalysisState,'ready'>,string>={loading:'正在取得本場分析資料。',waiting:'分析資料尚未完整，等待來源補足後再計算。',error:'本場分析更新失敗，請稍後重試。',stale:'本場分析已過期，等待重新取得。',unavailable:'目前沒有可用的本場分析。'};
export default function SportMarkets({game,analysis,analysisState,analysisMessage,snapshot,sourceLoading=false,error='',errorCode='',sport,now}:{game:SportFixture;analysis?:any;analysisState?:SportMarketAnalysisState;analysisMessage?:string;snapshot:any;sourceLoading?:boolean;error?:string;errorCode?:string;sport:'NBA'|'WNBA'|'FOOTBALL';now:number}){
 if(game.state!=='scheduled'||!game.timeConfirmed||Date.parse(game.start)<=now)return null;
 const status=sportMarketStatus(error?null:snapshot,game,sport,now),event=!error?status.event:null;
 const age=now-Date.parse(analysis?.capturedAt||'');
 const valid=analysis?.status==='ready'&&analysis.expected&&analysis.probabilities&&age>=-60000&&age<15*60000;
 // Loading is an explicit request state. A finished, unavailable analysis must
 // retain its reason, independently of whether the source has matching markets.
 // Presentation props never authorize an invalid or expired model.
 const modelState:SportMarketAnalysisState=valid?'ready':analysisState&&analysisState!=='ready'?analysisState:analysis?.status==='waiting'?'waiting':analysis?.status==='ready'&&(!Number.isFinite(age)||age< -60000||age>=15*60000)?'stale':'unavailable';
 const modelMessage=modelState==='ready'?'':analysisMessage?.trim()||analysis?.reason||analysisMessages[modelState];
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
    {r?<Outcome result={r}/>:<p className="sport-market-pending">{valid?'暫無可用分布':analysisLabels[modelState]}</p>}
   </div>;
  })}</div>}</div>;
 }
 const availableCount=sport==='FOOTBALL'?Number(status.markets.spread.code==='ready')+Number(status.markets.total.code==='ready'):status.availableCount;
 const marketStates=(sport==='FOOTBALL'?['spread','total'] as const:['spread','total','moneyline'] as const).map(kind=>status.markets[kind].code);
 const recovery=memberOddsRecovery(errorCode);
 const sourceRecoverable=['source_pending','source_stale','source_time_invalid','source_invalid'].includes(status.code);
 const sourceSummary=error?recovery.summary:availableCount?`${availableCount} 種玩法`:status.code==='source_pending'?(sourceLoading?'玩法資料載入中':'尚未取得玩法資料'):status.code==='source_stale'?(sourceLoading?'玩法資料更新中':'玩法資料已過期'):['source_invalid','source_time_invalid'].includes(status.code)?'玩法來源資料異常':['fixture_unmatched','sport_unavailable'].includes(status.code)?'來源尚未提供本場玩法':status.code==='matched'?(marketStates.includes('invalid')||marketStates.includes('ambiguous')?'玩法資料待確認':marketStates.includes('closed')?'玩法已暫停':'來源尚未提供玩法'):'玩法配對待確認';
 const sourceMessage=status.code==='source_pending'?(sourceLoading?'正在取得玩法來源資料…':'目前尚未取得玩法來源資料，請更新來源。'):status.message;
 return <details key={`${sport}:${game.id}:${game.start}`} className="match-market-details sport-market-details" data-market-status={error?'source_error':status.code} data-analysis-state={modelState}><summary><span>查看分析</span><span>{modelState==='ready'?sourceSummary:`${analysisLabels[modelState]}・${sourceSummary}`}</span></summary><section className="sport-markets" aria-label="全場讓分與大小分析"><div className="sport-market-heading"><span>{sport==='FOOTBALL'?'90 分鐘・不含加時':'全場・含延長賽'}</span>{event&&<small>賠率不含本金</small>}</div>{modelMessage&&<p className="sport-market-pending" role="status">{modelMessage}</p>}{error?<div role="status"><p>{error}</p><button type="button" disabled={sourceLoading} onClick={()=>recoverMemberOdds(errorCode)}>{recovery.label}</button></div>:!event?<div role="status"><p>{sourceMessage}</p>{sourceRecoverable&&<button type="button" disabled={sourceLoading} onClick={()=>recoverMemberOdds('')}>{sourceLoading?'正在更新玩法…':'重新取得玩法'}</button>}</div>:<>
  {wnbaScenario&&<p className="sport-market-pending">推薦依目前球員情境推估；出賽狀態待確認。</p>}
  {market(event.spread,'spread')}{market(event.total,'total')}
  {sport!=='FOOTBALL'&&<div className="sport-market-block" data-market-state={status.markets.moneyline.code}><div className="sport-market-heading"><strong>全場獨贏</strong>{!event.moneyline&&<b>{status.markets.moneyline.message}</b>}</div>{event.moneyline&&<div className="sport-market-options sport-market-moneyline">{(['home','away'] as const).map(side=><div className="sport-market-option" key={side}><div className="sport-market-option-heading"><strong className="sport-market-team">{identity(side)}</strong><strong className="sport-market-quote">@{event.moneyline![side]!.toFixed(3)}</strong></div>{p&&<div className="sport-market-win-rate"><span>勝率</span><b>{percent(p[side])}</b></div>}</div>)}</div>}</div>}
 </>}</section></details>;
}
function Outcome({result:r}:{result:SportOutcomes}){
 return <><dl className="sport-market-outcomes">{([['全贏',r.win,'win'],['中洞贏',r.partialWin,'win'],['中洞輸',r.partialLoss,'loss'],['全輸',r.loss,'loss']] as const).map(([label,p,tone])=><div key={label} data-tone={tone}><dt>{label}</dt><dd>{percent(p)}</dd></div>)}</dl>{r.push>1e-7&&<div className="sport-market-push"><span>退回</span><b>{percent(r.push)}</b></div>}</>;
}
