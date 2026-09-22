/** Independent request-bounded refresh loops; hosting sleep still stops this process. */
export const BASEBALL_LEAGUES = Object.freeze(['CPBL', 'NPB', 'KBO']);
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
      if(feed.stale||feed.status==='unavailable')throw Error('來源暫時無法更新');
      failures.set(league,0);state.succeededAt=new Date(now()).toISOString();state.error=null;
      const statKey=league+':'+date;
      if(feed.games.some(g=>g.status==='pregame'&&!g.sourceStale)&&
          (!statsAt.has(statKey)||now()-statsAt.get(statKey)>=300000)) {
        statsAt.set(statKey,now());
        try {await getPregame(league,date);} catch {state.error='場況已更新；賽前統計暫時失敗';}
      }
      if(statsAt.size>12)for(const key of statsAt.keys())if(!key.endsWith(':'+date))statsAt.delete(key);
      const nearStart=feed.games.some(g=>g.status==='pregame'&&
        Date.parse(g.startTime)-now()>=0&&Date.parse(g.startTime)-now()<=1800000);
      delay=feed.games.some(g=>g.status==='live')||nearStart||feed.status==='partial'?60000:300000;
    } catch {
      const n=(failures.get(league)||0)+1;failures.set(league,n);
      state.status='unavailable';state.error='本聯盟來源更新失敗，其他聯盟繼續';
      delay=Math.min(900000,60000*2**Math.min(n-1,4));
    } finally {
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
