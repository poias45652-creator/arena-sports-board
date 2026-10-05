import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
import {performance} from 'node:perf_hooks';
import {moduleUrl} from '../tests/profile-loader.mjs';
const label=process.argv[2]||'candidate',output=process.argv[3]||'evidence/nba-loading-candidate.json';
const source=await import(moduleUrl('lib/nba-source.ts'));
const {nbaEligible,readyNbaAnalysis}=await import(moduleUrl('lib/nba-analysis.ts'));
const {nbaDay,shiftNbaDay}=await import(moduleUrl('lib/nba.ts'));
const {DEFAULT_WEIGHTS,weightKey}=await import(moduleUrl('lib/basketball-efficiency.ts'));
const snapshot=JSON.parse(readFileSync('data/nba-player-strength.json','utf8'));
const day=process.argv[4]||shiftNbaDay(nbaDay(),1),native=globalThis.fetch;
let requests=0;const hosts={};
globalThis.fetch=async(...args)=>{requests++;const host=new URL(String(args[0])).hostname;hosts[host]=(hosts[host]||0)+1;return native(...args);};
const result={label,day,runId:process.env.GITHUB_RUN_ID,runAttempt:process.env.GITHUB_RUN_ATTEMPT,codeRef:process.env.NBA_BENCH_CODE_REF||process.env.GITHUB_SHA,startedAt:new Date().toISOString(),snapshotCapturedAt:snapshot.capturedAt,phases:[]};
try{
 const board=await source.nbaSchedule(day),games=board.games.filter(g=>nbaEligible(g)).slice(0,5);
 if(!games.length)throw Error('No upcoming NBA fixtures available for a live benchmark');
 if(globalThis.gc)globalThis.gc();result.heapBefore=process.memoryUsage().heapUsed;
 for(const phase of ['cold','warm']){
  const start=performance.now(),before=requests,rows=[],todo=[...games];
  async function worker(){while(todo.length){const game=todo.shift(),at=performance.now();try{
   const report=await source.nbaGameAnalysis(day,game.id,DEFAULT_WEIGHTS);
   const ready=!!readyNbaAnalysis(game,report,Date.now(),false,weightKey(DEFAULT_WEIGHTS));
   rows.push({id:game.id,away:game.away.name,home:game.home.name,ready,status:report?.analysis?.status,context:report?.analysis?.playerContext?.status,reason:report?.analysis?.playerContext?.reason||null,elapsedMs:Math.round((performance.now()-at)*100)/100,capturedAt:report?.analysis?.capturedAt});
  }catch(e){rows.push({id:game.id,ready:false,error:String(e.message||e).slice(0,200),elapsedMs:Math.round(performance.now()-at)});}}}
  await Promise.all([worker(),worker()]);
  result.phases.push({phase,elapsedMs:Math.round((performance.now()-start)*100)/100,upstreamRequests:requests-before,rows:rows.sort((a,b)=>a.id.localeCompare(b.id))});
 }
 if(globalThis.gc)globalThis.gc();result.heapAfter=process.memoryUsage().heapUsed;result.requestCounts=hosts;
 result.passed=result.phases.every(p=>p.rows.length===games.length&&p.rows.every(g=>g.ready));
}catch(e){result.error=String(e.message||e).slice(0,300);result.passed=false;}
finally{globalThis.fetch=native;result.finishedAt=new Date().toISOString();mkdirSync(dirname(output),{recursive:true});writeFileSync(output,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));}
if(!result.passed)process.exitCode=1;
