// Optional verified historical box scores only. Current schedules, rosters,
// availability, forecasts, accounts and private markets are never seeded.
import {mkdirSync,writeFileSync,renameSync,existsSync,unlinkSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const target='data/wnba-public-cache-seed.json';
if(!process.argv.includes('--worker')){
 if(existsSync(target))unlinkSync(target);
 const result=spawnSync(process.execPath,[import.meta.filename,'--worker'],{stdio:'inherit',timeout:120000,env:{...process.env,YJ_NBA_SEED_CAPTURE:'1'}});
 // Completed checkpoints contain only individually parsed, verified sources.
 // A timeout may retain those sources, but never claims a finished analysis.
 if(result.status!==0)console.warn('wnba-public-cache-prepare: optional preparation incomplete; verified checkpoints may be used and normal live reads remain enabled');
}else{
 const {moduleUrl}=await import('../tests/profile-loader.mjs');
 const {wnbaSchedule,wnbaGameAnalysis}=await import(moduleUrl('lib/wnba-source.ts'));
 const {wnbaDay,shiftWnbaDay}=await import(moduleUrl('lib/wnba.ts'));
 const {nbaEligible,readyNbaAnalysis}=await import(moduleUrl('lib/nba-analysis.ts'));
 const {exportNbaSeed}=await import(moduleUrl('lib/nba-public-cache-seed.ts'));
 const today=wnbaDay(),results=[];
 function checkpoint(){
  const all=exportNbaSeed(),seed={...all,entries:all.entries.filter(r=>r.kind==='efficiency'&&r.key.startsWith('WNBA:'))},text=JSON.stringify(seed);
  if(Buffer.byteLength(text)>4*1024*1024)throw Error('WNBA public seed exceeds fixed budget');
  mkdirSync('data',{recursive:true});writeFileSync(target+'.tmp',text);renameSync(target+'.tmp',target);return {seed,text};
 }
 const boards=await Promise.allSettled(Array.from({length:4},(_,i)=>wnbaSchedule(shiftWnbaDay(today,i))));
 const todo=boards.flatMap(b=>b.status==='fulfilled'?b.value.games.filter(g=>nbaEligible(g)).map(game=>({day:b.value.day,game})):[]).slice(0,6);
 async function work(){while(todo.length){const {day,game}=todo.shift();try{
  const report=await wnbaGameAnalysis(day,game.id),analysis=report&&readyNbaAnalysis(game,report);
  results.push({day,id:game.id,ready:!!analysis,status:report?.analysis?.status});
 }catch(error){results.push({day,id:game.id,ready:false,error:error instanceof Error?error.message:'source unavailable'});}finally{checkpoint();}}}
 await Promise.all([work(),work()]);
 const {seed,text}=checkpoint();
 console.log('wnba-public-cache-prepared',JSON.stringify({bytes:Buffer.byteLength(text),entries:seed.entries.length,builtAt:seed.builtAt,failedScheduleDays:boards.filter(b=>b.status==='rejected').length,results}));
}
