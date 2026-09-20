import {requestOrigin} from '@/lib/request-origin';
import {isSiteAdmin} from '@/app/admin-access';
import {gradeSavedMarkets} from '@/lib/recommendation-ledger';
import validation from '@/data/model-validation.json';
import historicalOdds from '@/data/historical-odds.json';
import {statcastHistorySummary} from '@/lib/statcast-history';
import {retrosheetSummary} from '@/lib/retrosheet';
import {auditReadiness} from '@/lib/analysis-readiness';
import {getRawDb} from '@/db';
import {loadSource} from '../route';
export const dynamic='force-dynamic';
export async function POST(request:Request){
 const origin=request.headers.get('origin');if(origin&&origin!==requestOrigin(request))return Response.json({error:'來源不符'},{status:403});
 try{
  const db=getRawDb();
  const pending=await db.prepare('SELECT s.game_id FROM analysis_snapshots s LEFT JOIN analysis_results r ON r.game_id=s.game_id WHERE s.start_time<? AND r.game_id IS NULL GROUP BY s.game_id ORDER BY MAX(s.start_time) DESC LIMIT 4').bind(new Date(Date.now()-3*3600000).toISOString()).all();
  let updated=0;
  for(const row of pending.results??[]){try{
   const game=await loadSource('game&gamePk='+row.game_id);const a=game.linescore?.teams?.away?.runs,h=game.linescore?.teams?.home?.runs;
   if(game.status?.abstractGameState!=='Final'||!Number.isInteger(a)||!Number.isInteger(h)||a===h||!Number.isFinite(game.linescore?.currentInning)||Number(game.linescore?.currentInning)<9)continue;
   await db.prepare('INSERT OR IGNORE INTO analysis_results (game_id,scheduled_start,away,home,fetched_at) VALUES (?,?,?,?,?)').bind(row.game_id,game.scheduledStart,a,h,new Date().toISOString()).run();updated++;
  }catch{/* A failed source leaves the game pending for a later update. */}}
  // Keep the existing result collection running for frontend requests, but only
  // return administrative reports to the authenticated owner.
  if(!(await isSiteAdmin()))return Response.json({updated},{headers:{'Cache-Control':'no-store'}});
  const paired=await db.prepare('SELECT s.payload,r.away,r.home FROM analysis_snapshots s JOIN analysis_results r ON r.game_id=s.game_id WHERE s.captured_at<s.start_time AND s.start_time=r.scheduled_start AND s.captured_at=(SELECT MAX(s2.captured_at) FROM analysis_snapshots s2 WHERE s2.game_id=s.game_id AND s2.captured_at<s2.start_time) ORDER BY s.captured_at DESC LIMIT 2000').all();
  let n=0,brier=0,logLoss=0;const empty=()=>({n:0,win:0,partialWin:0,push:0,partialLoss:0,loss:0,profitUnits:0});const markets:any={spread:empty(),total:empty()},ledger:any[]=[];
  for(const row of paired.results??[]){const p=JSON.parse(String(row.payload));const h=p.baseline?.homeWin,y=Number(Number(row.home)>Number(row.away));if(typeof h==='number'&&h>0&&h<1){n++;brier+=(h-y)**2;logLoss-=y*Math.log(h)+(1-y)*Math.log(1-h);}
   for(const entry of gradeSavedMarkets(p,Number(row.home),Number(row.away))){const m=markets[entry.market];m.n++;m[entry.result]++;m.profitUnits+=entry.profitUnits;ledger.push(entry);}
  }
  const recorded=await db.prepare(`SELECT json_object('game',json_extract(s.payload,'$.game'),'capturedAt',json_extract(s.payload,'$.capturedAt'),'issues',json_extract(s.payload,'$.issues'),'sources',json_extract(s.payload,'$.sources'),'baseline',json_object('markets',json_extract(s.payload,'$.baseline.markets')),'context',json_object('sides',json_object('away',json_object('lineupStatus',json_extract(s.payload,'$.context.sides.away.lineupStatus')),'home',json_object('lineupStatus',json_extract(s.payload,'$.context.sides.home.lineupStatus'))),'coversOdds',json_object('game',json_extract(s.payload,'$.context.coversOdds.game.coversGameId')))) AS payload FROM analysis_snapshots s WHERE s.captured_at<s.start_time AND s.captured_at=(SELECT MAX(s2.captured_at) FROM analysis_snapshots s2 WHERE s2.game_id=s.game_id AND s2.captured_at<s2.start_time) ORDER BY s.captured_at DESC LIMIT 500`).all();
  const reports:any[]=[];let unreadableRecords=0;for(const row of recorded.results??[]){try{reports.push(JSON.parse(String(row.payload)));}catch{unreadableRecords++;}}
  const readiness={...auditReadiness(reports),unreadableRecords,limit:500};
  const count=await db.prepare('SELECT COUNT(*) AS snapshots,COUNT(DISTINCT game_id) AS games FROM analysis_snapshots').first();
  return Response.json({updated,...count,readiness,historicalData:retrosheetSummary(),historicalValidation:validation,historicalOdds:historicalOdds.summary,statcastData:statcastHistorySummary(),evaluatedGames:n,baselineBrier:n?brier/n:null,baselineLogLoss:n?logLoss/n:null,markets,ledger:ledger.slice(0,100),ledgerScope:'每場最後一筆賽前快照的模型方向；每項固定 1 單位試算，非實際下注紀錄。僅核對九局以上完賽；提前結束、取消、特殊裁定待人工核對。',candidateEvaluatedGames:0,candidateStatus:'untrained',scope:'latest pregame snapshot; baseline only; not historical backtest',fetchedAt:new Date().toISOString()},{headers:{'Cache-Control':'no-store'}});
 }catch{return Response.json({error:'賽後核對服務暫不可用'},{status:503});}
}
