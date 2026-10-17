/** Independent request-bounded refresh loops; hosting sleep still stops this process. */
export const BASEBALL_LEAGUES = Object.freeze(['CPBL', 'NPB', 'KBO']);
// Bounded public-source diagnostics: no player names or stored payload contents.
function tableShape(game,kind,side){
  const rows=game[kind]?.[side];if(!Array.isArray(rows))return {rows:'invalid'};
  const nonNull=new Set(),positive=new Set();
  for(const row of rows){
    const metrics=kind==='innings'?{runs:row?.runs}:{...row?.stats,...(kind==='pitching'?{pitchCount:row?.pitchCount,outsRecorded:row?.outsRecorded}:{})};
    for(const [key,value] of Object.entries(metrics)){
      if(value!==null&&value!==undefined)nonNull.add(key);
      if(typeof value==='number'&&value>0)positive.add(key);
    }
  }
  return {rows:rows.length,nonNullMetricKeys:[...nonNull].sort().slice(0,30),positiveMetricKeys:[...positive].sort().slice(0,30)};
}
function npbStaleShape(game){
  return {key:game.key,date:game.date,idType:typeof game.id,homeIdType:typeof game.home?.id,awayIdType:typeof game.away?.id,
    rawStatus:String(game.rawStatus||'').slice(0,160),homeHits:game.home?.hits,awayHits:game.away?.hits,homeErrors:game.home?.errors,awayErrors:game.away?.errors,
    liveStateObserved:game.liveStateObserved,liveChangesVerified:game.liveChangesVerified,
    nonNullStateFields:['inning','half','balls','strikes','outs','bases','currentBatter','currentPitcher','currentAtBat'].filter(k=>game[k]!==null&&game[k]!==undefined),
    tables:Object.fromEntries(['innings','batting','pitching'].map(kind=>[kind,Object.fromEntries(['home','away'].map(side=>[side,tableShape(game,kind,side)]))]))};
}
export function createBaseballRefreshLoops({getLive, getPregame, day,
  now=Date.now, schedule=setTimeout, cancel=clearTimeout, onTick=(_state)=>{}, staggerMs=15000}) {
  let stopped=true;
  const timers=new Map(), busy=new Set(), statsAt=new Map(), failures=new Map();
  const states=Object.fromEntries(BASEBALL_LEAGUES.map(league=>[league,
    {league, running:false, checkedAt:null, succeededAt:null, nextCheckAt:null,
      date:null, status:'waiting', games:0, error:null}]));
  function queue(league, delay) {
    if(stopped)return;
    states[league].nextCheckAt=new Date(now()+delay).toISOString();
    const timer=schedule(()=>void tick(league),delay);timer?.unref?.();timers.set(league,timer);
  }
  async function tick(league) {
    if(stopped||busy.has(league))return;
    busy.add(league);timers.delete(league);let delay=300000;
    const state=states[league],date=day();state.date=date;state.running=true;state.checkedAt=new Date(now()).toISOString();
    try {
      const feed=await getLive(league,date);
      if(feed?.league!==league||feed.date!==date||!Array.isArray(feed.games))throw Error('來源場次格式不符');
      state.status=feed.status;state.games=feed.games.length;
      state.sourceErrors=feed.sourceErrors||[];
      state.retiredFixtures=(feed.retiredFixtures||[]).map(g=>({id:g.id,reason:g.reason}));
      if(league==='NPB'){
        const proof=feed.scheduleProof;
        state.scheduleVerification={available:!!proof,stage:feed.scheduleVerification?.stage,
          date:proof?.date,sourceFetchedAt:proof?.source?.fetchedAt,
          listedGames:proof?.listedGames,completedFirstStages:proof?.completedFirstStages};
        state.retirementChecks=(feed.retirementChecks||[]).map(g=>({id:g.id,retired:g.retired,reason:g.reason}));
      }
      state.staleFixtures=feed.games.filter(g=>g.sourceStale).map(g=>({id:g.id,status:g.status,
        homeId:g.home?.id,awayId:g.away?.id,homeScore:g.home?.score,awayScore:g.away?.score,
        startTime:g.startTime,fetchedAt:g.source?.fetchedAt,url:g.source?.url,...(league==='NPB'?npbStaleShape(g):{})}));
      if(feed.stale||feed.status==='unavailable')throw Error('來源暫時無法更新');
      failures.set(league,0);state.succeededAt=new Date(now()).toISOString();state.error=null;
      const nextDate=league==='CPBL'&&feed.noGames&&/^\d{4}-\d{2}-\d{2}$/.test(feed.nextGameDate||'')&&feed.nextGameDate>date&&Date.parse(feed.nextGameDate)-Date.parse(date)<=7*86400000?feed.nextGameDate:null;
      const statsDate=nextDate||date,statKey=league+':'+statsDate;
      if((nextDate||feed.retiredFixtures?.length||feed.games.some(g=>g.status==='pregame'&&!g.sourceStale))&&
          (!statsAt.has(statKey)||now()-statsAt.get(statKey)>=300000)) {
        statsAt.set(statKey,now());
        try {await getPregame(league,statsDate);} catch {statsAt.delete(statKey);state.error='場況已更新；賽前統計暫時失敗';}
      }
      if(statsAt.size>12)for(const key of statsAt.keys())if(!key.endsWith(':'+date)&&key!==statKey)statsAt.delete(key);
      const nearStart=feed.games.some(g=>g.status==='pregame'&&
        Date.parse(g.startTime)-now()>=0&&Date.parse(g.startTime)-now()<=1800000);
      delay=feed.games.some(g=>g.status==='live')||nearStart||feed.status==='partial'?60000:300000;
    } catch {
      const n=(failures.get(league)||0)+1;failures.set(league,n);
      state.status='unavailable';state.error='本聯盟來源更新失敗，其他聯盟繼續';
      delay=Math.min(900000,60000*2**Math.min(n-1,4));
    } finally {
      // Warm tomorrow even when today's sources fail or today's games have ended.
      const tomorrow=new Date(Date.parse(date+'T00:00:00Z')+86400000).toISOString().slice(0,10);
      const upcomingKey=league+':'+tomorrow;
      if(!stopped&&(!statsAt.has(upcomingKey)||now()-statsAt.get(upcomingKey)>=300000)){
        try{await getPregame(league,tomorrow);statsAt.set(upcomingKey,now());}
        catch{state.error=(state.error?state.error+'；':'')+'明日資料待重試';}
      }
      busy.delete(league);state.running=false;
      try {onTick({...state,nextDelayMs:delay});} catch {}
      queue(league,delay);
    }
  }
  return {
    start(){if(!stopped)return;stopped=false;BASEBALL_LEAGUES.forEach((league,i)=>queue(league,i*staggerMs));},
    stop(){stopped=true;for(const timer of timers.values())cancel(timer);timers.clear();for(const s of Object.values(states))s.nextCheckAt=null;},
    snapshot(){return {enabled:!stopped,mode:'in-process',continuousAcrossHostingSleep:false,
      leagues:BASEBALL_LEAGUES.map(league=>({...states[league]}))};}
  };
}
