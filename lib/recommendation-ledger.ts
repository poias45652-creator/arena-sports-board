import {scoreFraction,validLine,type MarketPick} from './markets';
import {netProfit} from './settlement';
export function gradeSavedMarkets(report:any,home:number,away:number){
 if(report?.version!=='pregame-super007-v2'||!Number.isInteger(home)||!Number.isInteger(away))return [];
 if(report.issues?.some((s:string)=>s.includes('衝突')||s.includes('先發投手來源不一致')))return [];
 const out:any[]=[];
 for(const market of ['spread','total'] as const){
  const choices=(report.baseline?.markets??[]).filter((q:any)=>q.source==='Super007'&&q.pick?.market===market&&q.probability).sort((a:any,b:any)=>(b.probability.win+(b.probability.partialWin??0))-(a.probability.win+(a.probability.partialWin??0)));
  const q=choices[0];if(!q)continue;
  const p=q.pick as MarketPick,r=q.probability;
  const quoteTime=Date.parse(q.quoteFetchedAt),captured=Date.parse(report.capturedAt),start=Date.parse(report.game?.date);
  if(!Number.isFinite(quoteTime)||!Number.isFinite(captured)||captured>=start||quoteTime>captured+60000||captured-quoteTime>150000)continue;
  if(r.win+(r.partialWin??0)<=r.loss+(r.partialLoss??0)+.000001||!validLine(market,p.line)||!Number.isFinite(q.netOdds)||q.netOdds<=0)continue;
  const fraction=scoreFraction({home,away},p);if(!Number.isFinite(fraction)||Math.abs(fraction)>1)continue;
  out.push({gameId:report.game.id,home:report.game.home.name,away:report.game.away.name,score:{home,away},market,side:p.side,line:p.display??p.line,capturedAt:report.capturedAt,quoteFetchedAt:q.quoteFetchedAt,netOdds:q.netOdds,fraction,result:fraction===1?'win':fraction===-1?'loss':fraction>0?'partialWin':fraction<0?'partialLoss':'push',profitUnits:netProfit(fraction,q.netOdds)});
 }
 return out;
}
