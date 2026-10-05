// Prepare optional PUBLIC source caches before a Render release. No saved
// forecasts, current scoreboards, member sessions or private market requests.
import {mkdirSync,writeFileSync,renameSync,existsSync,unlinkSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const target='data/nba-public-cache-seed.json';
if(!process.argv.includes('--worker')){
 if(existsSync(target))unlinkSync(target);
 const r=spawnSync(process.execPath,[import.meta.filename,'--worker'],{stdio:'inherit',timeout:90000,env:{...process.env,YJ_NBA_SEED_CAPTURE:'1'}});
 if(r.status!==0){if(existsSync(target))unlinkSync(target);console.warn('nba-public-cache-prepare: optional seed unavailable; normal live reads remain enabled');}
}else{
 const {moduleUrl}=await import('../tests/profile-loader.mjs');
 const {nbaSchedule,nbaGameAnalysis}=await import(moduleUrl('lib/nba-source.ts'));
 const {nbaDay,shiftNbaDay}=await import(moduleUrl('lib/nba.ts'));
 const {nbaEligible,readyNbaAnalysis}=await import(moduleUrl('lib/nba-analysis.ts'));
 const {exportNbaSeed}=await import(moduleUrl('lib/nba-public-cache-seed.ts'));
 const today=nbaDay(),boards=await Promise.all([nbaSchedule(today),nbaSchedule(shiftNbaDay(today,1))]);
 const todo=boards.flatMap(b=>b.games.filter(g=>nbaEligible(g)).map(game=>({day:b.day,game}))).slice(0,15),results=[];
 async function work(){while(todo.length){const {day,game}=todo.shift();try{const report=await nbaGameAnalysis(day,game.id);results.push({id:game.id,ready:!!readyNbaAnalysis(game,report),status:report?.analysis?.status});}catch{results.push({id:game.id,ready:false,status:'source_unavailable'});}}}
 await Promise.all([work(),work()]);
 const seed=exportNbaSeed(),text=JSON.stringify(seed);if(Buffer.byteLength(text)>16*1024*1024)throw Error('Public seed exceeds fixed budget');
 mkdirSync('data',{recursive:true});writeFileSync(target+'.tmp',text);renameSync(target+'.tmp',target);
 console.log('nba-public-cache-prepared',JSON.stringify({bytes:Buffer.byteLength(text),entries:seed.entries.length,official:seed.entries.filter(r=>r.kind==='official').length,efficiency:seed.entries.filter(r=>r.kind==='efficiency').length,builtAt:seed.builtAt,results}));
}
