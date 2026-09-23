import {retainFixtureStart} from './baseball-live-retention.mjs';
import {baseballBackgroundStatus} from './baseball-background-state.mjs';
/** Shared-source feed. No account credentials leave this server. */
export function createLiveFeed({collect,read,write,day,now=Date.now}) {
 const cache=new Map(),pending=new Map();
 return async function get(league,requestedDate) {
  if(!['NPB','KBO','CPBL'].includes(league))throw new Error('Invalid league');
  const date=requestedDate||day();
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw new Error('Invalid date');
  const key=league+':'+date,previous=cache.get(key);
  if(previous&&previous.until>now())return previous.value;
  if(pending.has(key))return pending.get(key);
  if(cache.size>=12&&!cache.has(key))cache.delete(cache.keys().next().value);
  const task=(async()=>{
   let stored=[];
   try{stored=await read(league,date);}catch{}
   const matches=g=>g?.league===league&&g.date===date&&g.key&&g.source?.fetchedAt;
   const older=new Map();
   for(const g of [...stored,...(previous?.value.games||[])].filter(matches)){
    const old=older.get(g.key);
    if(!old||Date.parse(g.source.fetchedAt)>Date.parse(old.source.fetchedAt))older.set(g.key,g);
   }
   try{
    const fresh=await collect(league,{date});
    if(fresh?.league!==league||fresh.date!==date||!Array.isArray(fresh.games))throw new Error('No verified current-date games');
    if(!fresh.games.length){
     const proof=fresh.scheduleProof,ids=new Set(['cpbl.t.1','cpbl.t.2','cpbl.t.5','cpbl.t.6','cpbl.t.7','cpbl.t.8']);
     const verified=league==='CPBL'&&proof?.date===date&&proof.listedGames===0&&
      proof.teams?.length===6&&new Set(proof.teams.map(t=>t.teamId)).size===6&&
      proof.teams.every(t=>ids.has(t.teamId)&&t.from<=date&&t.through>=date&&
       Number.isFinite(Date.parse(t.fetchedAt))&&now()-Date.parse(t.fetchedAt)>=-60000&&now()-Date.parse(t.fetchedAt)<=900000)&&
      fresh.status==='ok'&&Array.isArray(fresh.errors)&&fresh.errors.length===0&&older.size===0;
     if(!verified)throw new Error('No verified current-date games');
     const value={schemaVersion:1,league,date,games:[],status:'ok',stale:false,noGames:true,
      scheduleProof:proof,nextGameDate:fresh.nextGameDate,checkedAt:new Date(now()).toISOString(),collectedAt:fresh.collectedAt,
      pollAfterMs:300000,liveLatencyVerified:false,automaticBackgroundSync:baseballBackgroundStatus().enabled,background:baseballBackgroundStatus()};
     cache.set(key,{value,until:now()+300000});return value;
    }
    if(fresh.games.length>20||fresh.games.some(g=>!matches(g)))throw new Error('Game identity mismatch');
    for(const g of fresh.games){
     const age=now()-Date.parse(g.source.fetchedAt);
     if(!Number.isFinite(age)||age< -60000||age>900000)throw new Error('Invalid source observation time');
    }
    const errors=Array.isArray(fresh.errors)?fresh.errors:[];
    const games=new Map([...older].map(([k,g])=>[k,{...g,sourceStale:true}]));
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
    const value={schemaVersion:1,league,date,games:rows,status:partial?'partial':'ok',stale:false,checkedAt:new Date(now()).toISOString(),collectedAt:fresh.collectedAt,persistence,pollAfterMs,liveLatencyVerified:false,automaticBackgroundSync:baseballBackgroundStatus().enabled,background:baseballBackgroundStatus(),...(partial?{error:'部分場次更新失敗；舊資料保留原擷取時間。'}:{})};
    cache.set(key,{value,until:now()+pollAfterMs});return value;
   }catch{
    const games=[...older.values()].map(g=>({...g,sourceStale:true}));
    const value={schemaVersion:1,league,date,games,status:games.length?'stale':'unavailable',stale:true,checkedAt:new Date(now()).toISOString(),error:'目前無法更新來源；不代表今日沒有比賽。',pollAfterMs:60000,liveLatencyVerified:false,automaticBackgroundSync:baseballBackgroundStatus().enabled,background:baseballBackgroundStatus()};
    cache.set(key,{value,until:now()+60000});return value;
   }
  })().finally(()=>pending.delete(key));
  pending.set(key,task);return task;
 };
}
