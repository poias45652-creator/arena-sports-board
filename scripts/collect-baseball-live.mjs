import {mkdir,writeFile,copyFile} from 'node:fs/promises';
import {setTimeout as delay} from 'node:timers/promises';
import {collectLeague,dayInTaipei} from '../server/baseball-current.mjs';
const output='baseball-current';
await mkdir(output,{recursive:true});
const finite=v=>typeof v==='number'&&Number.isFinite(v);
function materialChanges(old,g){
 const changes={};
 const scalars=[
  ['awayScore',old.away?.score,g.away?.score],['homeScore',old.home?.score,g.home?.score],
  ['inning',old.inning,g.inning],['balls',old.balls,g.balls],['strikes',old.strikes,g.strikes],['outs',old.outs,g.outs]
 ];
 for(const [key,before,after] of scalars)if(finite(before)&&finite(after)&&before!==after)changes[key]={before,after};
 for(const side of ['away','home']){
  const before=new Map((old.pitching?.[side]||[]).map(p=>[String(p.id||p.name),p]));
  for(const p of g.pitching?.[side]||[]){
   const prior=before.get(String(p.id||p.name));if(!prior)continue;
   for(const field of ['pitchCount','outsRecorded']){const a=prior[field],b=p[field];if(finite(a)&&finite(b)&&a!==b)(changes[`${side}Pitching`]??={})[`${p.id||p.name}:${field}`]={before:a,after:b};}
  }
 }
 return changes;
}
async function capture(){
 const date=dayInTaipei();
 const results=await Promise.all(['NPB','KBO','CPBL'].map(async league=>{
  try{return await collectLeague(league,{date});}
  catch(e){return {schemaVersion:1,league,date,collectedAt:new Date().toISOString(),games:[],status:'unavailable',errors:[e.message],liveLatencyVerified:false};}
 }));
 return {schemaVersion:1,date,capturedAt:new Date().toISOString(),purpose:'current feed validation; not production deployment',leagues:results};
}
const first=await capture();await writeFile(output+'/capture-1.json',JSON.stringify(first,null,2));
let latest=first;
const active=first.leagues.some(l=>l.games.some(g=>g.status==='live'));
if(active){
 await delay(65000);
 latest=await capture();await writeFile(output+'/capture-2.json',JSON.stringify(latest,null,2));
 const before=new Map(first.leagues.flatMap(l=>l.games).map(g=>[g.key,g]));
 for(const g of latest.leagues.flatMap(l=>l.games)){
  const old=before.get(g.key),interval=Date.parse(g.source.fetchedAt)-Date.parse(old?.source.fetchedAt);
  const sameTeams=!!old&&old.away?.id===g.away?.id&&old.home?.id===g.home?.id;
  const changes=old?materialChanges(old,g):{};
  g.liveChangesVerified=!!old&&old.date===g.date&&sameTeams&&old.status==='live'&&g.status==='live'&&interval>=60000&&Object.keys(changes).length>0;
  if(g.liveChangesVerified)g.liveChangeProof={beforeHash:old.stateHash,afterHash:g.stateHash,beforeFetchedAt:old.source.fetchedAt,afterFetchedAt:g.source.fetchedAt,intervalSeconds:interval/1000,changes};
 }
}
await writeFile(output+'/current.json',JSON.stringify(latest,null,2));
for(const league of latest.leagues)await writeFile(output+'/'+league.league.toLowerCase()+'.json',JSON.stringify(league,null,2));
const verification={date:latest.date,checkedAt:latest.capturedAt,secondCapturePerformed:active,productionDeployed:false,leagues:latest.leagues.map(l=>({league:l.league,games:l.games.length,status:l.status,errors:l.errors,pregame:l.games.filter(g=>g.status==='pregame').length,live:l.games.filter(g=>g.status==='live').length,final:l.games.filter(g=>g.status==='final').length,liveStateObserved:l.games.some(g=>g.liveStateObserved),liveChangesVerified:l.games.some(g=>g.liveChangesVerified),lineupRows:l.games.reduce((n,g)=>n+g.lineups.home.length+g.lineups.away.length,0),pitchingRows:l.games.reduce((n,g)=>n+g.pitching.home.length+g.pitching.away.length,0),gamesSummary:l.games.map(g=>({key:g.key,away:g.away.name,home:g.home.name,startTime:g.startTime,status:g.status,awayScore:g.away.score,homeScore:g.home.score,inning:g.inning,source:g.source,liveChangeProof:g.liveChangeProof??null}))}))};
await writeFile(output+'/verification.json',JSON.stringify(verification,null,2));
await copyFile('server/baseball-live-providers.mjs',output+'/baseball-live-providers.mjs');
await copyFile('server/baseball-current.mjs',output+'/baseball-current.mjs');
await copyFile('scripts/collect-baseball-live.mjs',output+'/collect-baseball-live.mjs');
console.log('VERIFIED_CURRENT_COLLECTION '+JSON.stringify(verification));
if(latest.leagues.every(l=>l.games.length===0))process.exitCode=1;
