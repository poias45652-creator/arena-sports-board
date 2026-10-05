import {wnbaSchedule,wnbaGameAnalysis} from './wnba-source';
import {wnbaDay,shiftWnbaDay} from './wnba';
import {nbaEligible,readyNbaAnalysis} from './nba-analysis';
export function startWnbaStartupWarmup(){
 const state=globalThis as typeof globalThis&{__yjWnbaWarmup?:boolean};
 if(state.__yjWnbaWarmup||process.env.RENDER_SERVICE_ID!=='srv-dahruorm8hqs73d57edg')return;
 state.__yjWnbaWarmup=true;
 const timer=setTimeout(()=>{void run().catch(error=>console.warn('wnba-startup-warmup',JSON.stringify({error:error instanceof Error?error.message:'source unavailable'})));},15000);timer.unref();
}
async function run(){
 const started=Date.now(),day=wnbaDay(),rows:any[]=[];
 // Bounded one-time warmup for today's and the next three Taiwan dates.
 const boards=await Promise.all(Array.from({length:4},(_,i)=>wnbaSchedule(shiftWnbaDay(day,i))));
 const todo=boards.flatMap(b=>b.games.filter(g=>nbaEligible(g)).map(game=>({day:b.day,game}))).slice(0,6);
 async function worker(){while(todo.length){const {day,game}=todo.shift()!,at=Date.now();try{
  const report=await wnbaGameAnalysis(day,game.id),analysis=report&&readyNbaAnalysis(game,report);
  rows.push({day,id:game.id,ready:!!analysis,model:analysis?.model,context:analysis&&'playerContext' in analysis?analysis.playerContext?.status:null,elapsedMs:Date.now()-at});
 }catch(error){rows.push({day,id:game.id,ready:false,error:error instanceof Error?error.message:'source unavailable'});}}}
 await Promise.all([worker(),worker()]);
 console.info('wnba-startup-warmup',JSON.stringify({origin:'render-startup-not-browser',elapsedMs:Date.now()-started,rows}));
}
