import {retainFixtureStart} from './baseball-live-retention.mjs';
import {baseballBackgroundStatus} from './baseball-background-state.mjs';
import {isRetiredNpbFixture,npbFixtureRetirementDecision,isVerifiedNpbOffday} from './baseball-npb-schedule.mjs';
/** Shared-source feed. No account credentials leave this server. */
export function createLiveFeed({collect,read,write,day,now=Date.now,responseBudgetMs=2000}) {
 const cache=new Map(),pending=new Map();
 if(!Number.isFinite(responseBudgetMs)||responseBudgetMs<=0)throw new Error('Invalid response budget');
 function retained(league,date,older,prior,refreshing=false){
  // Reuse the last verified retirement proof only for an unchanged stored row.
  // Newer evidence or any evidence of play must still be shown.
  const retiredFixtures=(prior?.retiredFixtures||[]).filter(r=>{
   const g=older.get(r.key);return g&&g.source.fetchedAt===r.previousFetchedAt&&
    isRetiredNpbFixture(g,prior.scheduleProof,Date.parse(prior.scheduleProof?.source?.fetchedAt));
  });
  const retiredKeys=new Set(retiredFixtures.map(g=>g.key));
  const games=[...older.values()].filter(g=>!retiredKeys.has(g.key)).map(g=>({...g,sourceStale:true}));
  return {schemaVersion:1,league,date,games,status:games.length?'stale':'unavailable',stale:true,
   checkedAt:refreshing?prior?.checkedAt:new Date(now()).toISOString(),
   error:refreshing?(games.length?'正在更新場況；先顯示上次取得的資料。':'正在取得來源資料，稍後自動更新；不代表今日沒有比賽。'):'目前無法更新來源；不代表今日沒有比賽。',
   ...(refreshing?{refreshing:true}:{}),pollAfterMs:refreshing?5000:60000,
   liveLatencyVerified:false,automaticBackgroundSync:baseballBackgroundStatus().enabled,background:baseballBackgroundStatus(),
   retiredFixtures,...(retiredFixtures.length?{scheduleProof:prior.scheduleProof}: {})};
 }
 async function respond(job,preferCached){
  if(!preferCached)return job.task;
  const available=job.retained();
  if(available.games.length)return available;
  let timer;
  try{
   // The display can stop waiting without cancelling the shared collection.
   // Other clients, the background loop and pregame analysis reuse that job.
   return await Promise.race([job.task,job.ready,new Promise(resolve=>{
    timer=setTimeout(()=>resolve(job.retained()),responseBudgetMs);
   })]);
  }finally{clearTimeout(timer);}
 }
 return async function get(league,requestedDate,{preferCached=false}={}) {
  if(!['NPB','KBO','CPBL'].includes(league))throw new Error('Invalid league');
  const date=requestedDate||day();
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw new Error('Invalid date');
  const key=league+':'+date,previous=cache.get(key);
  if(previous&&previous.until>now())return previous.value;
  if(pending.has(key))return respond(pending.get(key),preferCached);
  if(cache.size>=12&&!cache.has(key))cache.delete(cache.keys().next().value);
  const matches=g=>g?.league===league&&g.date===date&&g.key&&Number.isFinite(Date.parse(g.source?.fetchedAt))&&Date.parse(g.source.fetchedAt)<=now()+60000;
  const older=new Map((previous?.value.games||[]).filter(matches).map(g=>[g.key,g]));
  let ready;
  const job={ready:new Promise(resolve=>{ready=resolve;}),retained:()=>retained(league,date,older,previous?.value,true)};
  const task=(async()=>{
   let stored=[];
   try{const rows=await read(league,date);if(Array.isArray(rows))stored=rows;}catch{}
   for(const g of [...stored,...(previous?.value.games||[])].filter(matches)){
    const old=older.get(g.key);
    if(!old||Date.parse(g.source.fetchedAt)>Date.parse(old.source.fetchedAt))older.set(g.key,g);
   }
   const available=job.retained();if(available.games.length)ready(available);
   try{
    const fresh=await collect(league,{date});
    if(fresh?.league!==league||fresh.date!==date||!Array.isArray(fresh.games))throw new Error('No verified current-date games');
    const freshKeys=new Set(fresh.games.map(g=>g.key));
    // The dated calendar and completed bracket must agree before an unplayed
    // conditional fixture is retired, including a verified day with no games.
    const retirementChecks=league==='NPB'?[...older.values()].filter(g=>!freshKeys.has(g.key))
     .map(g=>({id:g.id,key:g.key,...npbFixtureRetirementDecision(g,fresh.scheduleProof,now())})):[];
    const confirmed=new Map(retirementChecks.filter(g=>g.retired).map(g=>[g.key,g.reason]));
    const retiredFixtures=[...older.values()].filter(g=>confirmed.has(g.key))
     .map(g=>({key:g.key,id:g.id,league:g.league,date:g.date,startTime:g.startTime,home:g.home.name,away:g.away.name,
      previousFetchedAt:g.source.fetchedAt,reason:confirmed.get(g.key),source:fresh.scheduleProof.source}));
    const retiredKeys=new Set(retiredFixtures.map(g=>g.key));
    if(!fresh.games.length){
     const proof=fresh.scheduleProof,ids=new Set(['cpbl.t.1','cpbl.t.2','cpbl.t.5','cpbl.t.6','cpbl.t.7','cpbl.t.8']);
     const cpblOffday=league==='CPBL'&&proof?.date===date&&proof.listedGames===0&&
      proof.teams?.length===6&&new Set(proof.teams.map(t=>t.teamId)).size===6&&
      proof.teams.every(t=>ids.has(t.teamId)&&t.from<=date&&t.through>=date&&
       Number.isFinite(Date.parse(t.fetchedAt))&&now()-Date.parse(t.fetchedAt)>=-60000&&now()-Date.parse(t.fetchedAt)<=900000);
     const verified=(cpblOffday||league==='NPB'&&isVerifiedNpbOffday(proof,date,now()))&&
      fresh.status==='ok'&&Array.isArray(fresh.errors)&&fresh.errors.length===0&&older.size===retiredKeys.size;
     if(!verified)throw new Error('No verified current-date games');
     const value={schemaVersion:1,league,date,games:[],status:'ok',stale:false,noGames:true,
      scheduleProof:proof,retiredFixtures,retirementChecks,nextGameDate:fresh.nextGameDate,checkedAt:new Date(now()).toISOString(),collectedAt:fresh.collectedAt,
      pollAfterMs:300000,liveLatencyVerified:false,automaticBackgroundSync:baseballBackgroundStatus().enabled,background:baseballBackgroundStatus()};
     cache.set(key,{value,until:now()+300000});return value;
    }
    if(fresh.games.length>20||fresh.games.some(g=>!matches(g)))throw new Error('Game identity mismatch');
    for(const g of fresh.games){
     const age=now()-Date.parse(g.source.fetchedAt);
     if(!Number.isFinite(age)||age< -60000||age>900000)throw new Error('Invalid source observation time');
    }
    const errors=Array.isArray(fresh.errors)?fresh.errors:[];
    const games=new Map([...older].filter(([k])=>!retiredKeys.has(k)).map(([k,g])=>[k,{...g,sourceStale:true}]));
    const accepted=[];
    for(const g of fresh.games){
     const old=older.get(g.key);
     if(old&&(Date.parse(old.source.fetchedAt)>Date.parse(g.source.fetchedAt)||(['live','final'].includes(old.status)&&['pregame','unknown'].includes(g.status))))continue;
     const enriched=retainFixtureStart(g,old);accepted.push(enriched);
     games.set(g.key,{...enriched,sourceStale:false});
    }
    let persistence;
    try{persistence=accepted.length?await write({...fresh,games:accepted}):{written:0};}catch{persistence={written:0,error:'本次資料尚未成功保存；其他裝置可能仍讀到先前資料。'};}
    const rows=[...games.values()],partial=errors.length>0||rows.some(g=>g.sourceStale);
    const nearStart=rows.some(g=>g.status==='pregame'&&Date.parse(g.startTime)>now()&&Date.parse(g.startTime)-now()<=1800000);
    const pollAfterMs=rows.some(g=>g.status==='live')||partial||nearStart?60000:300000;
    const value={schemaVersion:1,league,date,games:rows,status:partial?'partial':'ok',stale:false,checkedAt:new Date(now()).toISOString(),collectedAt:fresh.collectedAt,persistence,pollAfterMs,liveLatencyVerified:false,automaticBackgroundSync:baseballBackgroundStatus().enabled,background:baseballBackgroundStatus(),sourceErrors:errors,sourceWarnings:Array.isArray(fresh.warnings)?fresh.warnings:[],retiredFixtures,...(league==='NPB'?{retirementChecks,scheduleVerification:fresh.scheduleVerification}:{}),...(fresh.scheduleProof?{scheduleProof:fresh.scheduleProof}:{}),...(partial?{error:'部分場次更新失敗；舊資料保留原擷取時間。'}:{})};
    cache.set(key,{value,until:now()+pollAfterMs});return value;
   }catch{
    const value=retained(league,date,older,previous?.value);
    cache.set(key,{value,until:now()+60000});return value;
   }
  })().finally(()=>pending.delete(key));
  job.task=task;pending.set(key,job);
  // A display may already have returned while this shared job is still running.
  // Fresh-data callers still observe any unexpected rejection from the task.
  void task.catch(()=>{});
  return respond(job,preferCached);
 };
}
