import {writeFileSync,readFileSync} from 'node:fs';
import {moduleUrl} from '../tests/profile-loader.mjs';
const source=await import(moduleUrl('lib/nba-source.ts'));
const {nbaEligible,readyNbaAnalysis}=await import(moduleUrl('lib/nba-analysis.ts'));
const {nbaDay,shiftNbaDay}=await import(moduleUrl('lib/nba.ts'));
const {DEFAULT_WEIGHTS,weightKey}=await import(moduleUrl('lib/basketball-efficiency.ts'));
const snapshot=JSON.parse(readFileSync('data/nba-player-strength.json','utf8'));
const day=process.argv[2]||shiftNbaDay(nbaDay(),1);
const result={day,startedAt:new Date().toISOString(),runId:process.env.GITHUB_RUN_ID,runAttempt:process.env.GITHUB_RUN_ATTEMPT,commit:process.env.GITHUB_SHA,playerSnapshotCapturedAt:snapshot.capturedAt,games:[]};
let failed=false;
try{
 const board=await source.nbaSchedule(day);
 const games=board.games.filter(g=>nbaEligible(g));
 console.log(JSON.stringify({day,fixtures:board.games.map(g=>({id:g.id,home:g.home.name,away:g.away.name,start:g.start,state:g.state}))}));
 for(const game of games){
  const started=Date.now();let row;
  try{
   const report=await source.nbaGameAnalysis(day,game.id,DEFAULT_WEIGHTS);
   const analysis=readyNbaAnalysis(game,report,Date.now(),false,weightKey(DEFAULT_WEIGHTS));
   row={id:game.id,home:game.home.name,away:game.away.name,ready:!!analysis,status:report?.analysis?.status,reason:report?.analysis?.playerContext?.reason,context:report?.analysis?.playerContext?.status,homeGames:report?.analysis?.homeForm?.games,awayGames:report?.analysis?.awayForm?.games,sourceFetchedAt:report?.sourceFetchedAt,elapsedMs:Date.now()-started};
  }catch(error){row={id:game.id,home:game.home.name,away:game.away.name,ready:false,error:String(error?.message||error).slice(0,300),elapsedMs:Date.now()-started};}
  if(!row.ready)failed=true;
  result.games.push(row);console.log(JSON.stringify(row));
 }
 if(!games.length){result.error='No eligible fixtures to verify';failed=true;}
}catch(error){result.error=String(error?.message||error).slice(0,300);failed=true;}
result.finishedAt=new Date().toISOString();result.passed=!failed;
writeFileSync('evidence/nba-live-verification.json',JSON.stringify(result,null,2)+'\n');
if(failed)process.exitCode=1;
