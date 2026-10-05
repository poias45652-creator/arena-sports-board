import {existsSync} from 'node:fs';
import {join} from 'node:path';
import {nbaSchedule,nbaGameAnalysis} from './nba-source';
import {nbaDay,shiftNbaDay} from './nba';
import {nbaEligible,readyNbaAnalysis} from './nba-analysis';
// One public-source warmup per YJ process, only with a build-prepared cache.
// No perpetual collector, member login, private market request or auth bypass.
export function startNbaStartupWarmup(){
 const state=globalThis as typeof globalThis&{__yjNbaStartupWarmupV1?:boolean};
 if(state.__yjNbaStartupWarmupV1||process.env.RENDER_SERVICE_ID!=='srv-dahruorm8hqs73d57edg'||!existsSync(join(process.cwd(),'data','nba-public-cache-seed.json')))return;
 state.__yjNbaStartupWarmupV1=true;
 const timer=setTimeout(()=>{void run().catch(()=>console.warn('nba-startup-warmup',{status:'source_unavailable'}));},1000);timer.unref();
}
async function run(){
 const started=Date.now(),day=nbaDay(),boards=await Promise.all([nbaSchedule(day),nbaSchedule(shiftNbaDay(day,1))]);
 const todo=boards.flatMap(b=>b.games.filter(g=>nbaEligible(g)).map(game=>({day:b.day,game}))).slice(0,15),rows:any[]=[];
 async function worker(){while(todo.length){const {day,game}=todo.shift()!,at=Date.now();try{
  const report=await nbaGameAnalysis(day,game.id);rows.push({id:game.id,ready:!!readyNbaAnalysis(game,report),elapsedMs:Date.now()-at});
 }catch{rows.push({id:game.id,ready:false,elapsedMs:Date.now()-at});}}}
 await Promise.all([worker(),worker()]);
 console.info('nba-startup-warmup',JSON.stringify({origin:'render-startup-not-browser',elapsedMs:Date.now()-started,rows}));
}
