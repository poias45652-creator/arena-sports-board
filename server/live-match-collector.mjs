// Next builds the instrumentation and route handlers separately in one Node process.
const key=Symbol.for('xingzhun.live-match-collector.v1');
const processState=globalThis[key]??={controller:null,results:new Map()};
export const matchCollectionStatus=()=>processState.controller?.snapshot()??{enabled:false,leagues:[]};
export const currentCollector=()=>processState.controller;
export function registerCollector(controller){processState.controller=controller;}
export function collectedMatch(league,id,day='',maxAge=12000){
  const row=processState.results.get(JSON.stringify([league,String(id),day]));
  return row&&Date.now()-row.time<=maxAge?row.data:null;
}
// MLB and regional basketball expose provider-wide unique match IDs without a date in the detail URL.
export function collectedByUniqueId(league,id){
  const today=new Date(Date.now()+8*3600000).toISOString().slice(0,10);
  const yesterday=new Date(Date.parse(today)-86400000).toISOString().slice(0,10);
  return collectedMatch(league,id,today)||collectedMatch(league,id,yesterday);
}
export function saveCollectedMatch(league,id,day,data){
  const map=processState.results,k=JSON.stringify([league,String(id),day]);
  map.delete(k);
  map.set(k,{time:Date.now(),data});
  if(map.size>100)map.delete(map.keys().next().value);
}

export function createMatchCollector(adapters,{now=Date.now,concurrency=4,record=saveCollectedMatch}={}){
  let running=false,active=0,timer;
  const schedules=new Map(),matches=new Map(),health=new Map();
  for(const [index,adapter] of adapters.entries()){
    health.set(adapter.league,{league:adapter.league,lastScheduleAt:null,lastMatchAt:null,failures:0});
    schedules.set(adapter.league,{adapter,due:now()+index*1000,busy:false,failures:0});
  }
  const stamp=()=>new Date(now()).toISOString();
  async function discover(job){
    const {adapter}=job, rows=await adapter.fixtures(now()), seen=new Set();
    if(!Array.isArray(rows))throw Error('Invalid fixtures');
    for(const fixture of rows){
      const id=JSON.stringify([adapter.league,fixture.day,String(fixture.id)]);
      const existing=matches.get(id);
      if(fixture.live){
        seen.add(id);
        if(existing){existing.fixture=fixture;existing.lastListed=now();}
        else matches.set(id,{id,adapter,fixture,lastListed:now(),due:now(),busy:false,failures:0});
      }else if(fixture.final&&existing){
        existing.fixture=fixture;
        if(!existing.finishing){existing.finishing=true;existing.due=now();}
      }
    }
    for(const [id,match] of matches){
      if(match.adapter===adapter&&!match.busy&&!seen.has(id)&&now()-match.lastListed>6*3600000)matches.delete(id);
    }
    health.get(adapter.league).lastScheduleAt=stamp();
    return seen.size?60000:120000;
  }
  async function sample(job){
    const {adapter,fixture}=job, result=await adapter.detail(fixture);
    if(!result)throw Error('Missing match detail');
    record(adapter.league,fixture.id,fixture.day,result);
    health.get(adapter.league).lastMatchAt=stamp();
    if(job.finishing){
      if(!fixture.final)return 0;
      const final=result.final===true||result.game?.state==='final'||result.match?.state==='final'||
        result.status==='final'||result.status?.abstractGameState==='Final';
      if(!final)throw Error('Final reading pending');
      matches.delete(job.id);
    }
    return adapter.interval;
  }
  function tick(){
    if(!running)return;
    // Stop orphaned jobs even if a league's schedule stays offline.
    for(const [id,job] of matches){
      if(!job.busy&&now()-job.lastListed>8*3600000)matches.delete(id);
    }
    const due=[...schedules.values(),...matches.values()].filter(j=>!j.busy&&j.due<=now()).sort((a,b)=>a.due-b.due);
    for(const job of due.slice(0,Math.max(0,concurrency-active))){
      job.busy=true;active++;
      const finalAtStart=job.finishing;
      Promise.resolve().then(()=>job.fixture?sample(job):discover(job)).then(delay=>{
        job.failures=0;job.due=now()+(job.finishing&&!finalAtStart?0:delay);
      }).catch(()=>{
        job.failures++;
        health.get(job.adapter.league).failures++;
        job.due=now()+Math.min(300000,15000*2**Math.min(job.failures-1,5));
      }).finally(()=>{job.busy=false;active--;});
    }
  }
  return {
    start(){if(running)return;running=true;tick();timer=setInterval(tick,1000);timer.unref?.();},
    stop(){running=false;clearInterval(timer);},
    tick,
    snapshot(){return {enabled:running,leagues:[...health.values()].map(row=>({...row,
      tracked:[...matches.values()].filter(j=>j.adapter.league===row.league).length}))};}
  };
}
