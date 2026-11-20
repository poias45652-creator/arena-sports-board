import {fetchFixtureFeed} from './fixture-feed.js';

import {fetchHkfaSchedule} from './hkfa-scoreboard.js';
import snapshotRows from './schedule-snapshot.json' with {type:'json'};
export const snapshotFeed={rows:snapshotRows,checkedAt:'2026-11-19T21:18:00Z',source:'snapshot'};
const interval=5*60*1000;
function ttl(rows,now){
  return rows.some(r=>r.state==='live'||(r.state==='pre'&&r.time&&Math.abs(now-Date.parse(r.dateISO+'T'+r.time+':00+08:00'))<3*3600000))?15000:interval;
}

let lastGood, nextCheck=0, pending;
function valid(value){
  return value && value.rows?.length===110 && Number.isFinite(Date.parse(value.checkedAt));
}
export async function readSeasonFeed(request, now=Date.now()){
  if(now<nextCheck)return lastGood||snapshotFeed;
  if(pending)return pending;
  pending=(async()=>{
    const cache=globalThis.caches?.default;
    const cacheKey=new URL('/.hkpl-cache/official-2026-v2',request.url).href;
    try{
      if(cache&&!lastGood){
        const stored=await cache.match(cacheKey);
        const data=stored && await stored.json();
        if(valid(data))lastGood=data;
      }
    }catch{}
    if(lastGood&&now-Date.parse(lastGood.checkedAt)<ttl(lastGood.rows,now)){
      nextCheck=Date.parse(lastGood.checkedAt)+ttl(lastGood.rows,now);
      return lastGood;
    }
    try{
      let rows,provider;
      const previous=new Map((lastGood?.rows||snapshotRows).map(r=>[r.home+'-'+r.away,r]));
      try{
        const data=await fetchHkfaSchedule({signal:AbortSignal.timeout(12000)});
        rows=data.map(row=>({...row,week:previous.get(row.home+'-'+row.away)?.dateISO===row.dateISO?previous.get(row.home+'-'+row.away).week:null}));
        provider='hkfa';
      }catch{
        const data=await fetchFixtureFeed({signal:AbortSignal.timeout(6500)});
        rows=data.map(row=>{
          const old=previous.get(row.home+'-'+row.away);
          if(old?.state==='final'&&row.state!=='final')return old;
          return {...row,officialId:old?.officialId||null,time:old&&old.time===null&&old.dateISO===row.dateISO?null:row.time};
        });
        provider='hkfpl';
      }
      const value={rows,provider,checkedAt:new Date(now).toISOString(),source:'feed'};
      lastGood=value;nextCheck=now+ttl(rows,now);
      if(cache)try{await cache.put(cacheKey,Response.json(value,{headers:{'Cache-Control':'public, max-age=2592000'}}));}catch{}
      return value;
    }catch{
      nextCheck=now+60000;
      if(lastGood)lastGood={...lastGood,source:'cached'};
      return lastGood||snapshotFeed;
    }
  })();
  try{return await pending;}finally{pending=null;}
}

export async function firstPaintFeed(request,ctx){
  const update=readSeasonFeed(request);
  if(!ctx?.waitUntil)return await update;
  ctx.waitUntil(update);
  let timeout;
  try{return await Promise.race([update,new Promise(resolve=>{
    timeout=setTimeout(()=>resolve(lastGood||snapshotFeed),850);
  })]);}finally{clearTimeout(timeout);}
}
const localDay=time=>new Date(time+8*3600000).toISOString().slice(0,10);
const dayNumber=day=>Date.parse(day+'T00:00:00Z')/86400000;
// Matchweeks run Tuesday to Monday in Hong Kong.
function weekStart(day){
  const n=dayNumber(day);
  return n-((new Date(n*86400000).getUTCDay()+5)%7);
}
export function selectMatchweek(games, now){
  if(!games.length)return [];
  const today=localDay(now),week=weekStart(today);
  const anchor=games.find(g=>weekStart(g.day)===week)||games.find(g=>g.day>today)||games.at(-1);
  return games.filter(g=>anchor.week&&g.week?g.week===anchor.week:weekStart(g.day)===weekStart(anchor.day));
}
const status={
  live:['STATUS_IN_PROGRESS','進行中'], final:['STATUS_FULL_TIME','已完場'], scheduled:['STATUS_SCHEDULED','未開賽'],
  pending:['STATUS_UNCONFIRMED','待確認賽果'],postponed:['STATUS_POSTPONED','延期'],
  cancelled:['STATUS_CANCELLED','取消'],unknown:['STATUS_UNKNOWN','狀態待確認']
};
export function mergeSeason(games, feed, now){
  const byPair=new Map((feed?.rows||[]).map(r=>[r.home+'-'+r.away,r]));
  return games.map(base=>{
    const row=byPair.get(base.home.id+'-'+base.away.id);
    // Retain the association's archived match sheet if the secondary feed lacks a final.
    if(base.state==='final'&&row?.state!=='final'&&!(feed?.provider==='hkfa'&&row))return base;
    const day=row?.dateISO||base.day;
    const confirmed=row?!!row.time:base.timeConfirmed;
    const start=row?day+'T'+(row.time||'12:00')+':00+08:00':base.start;
    let state=row?(row.state==='pre'?'scheduled':row.state):base.state;
    if(state==='scheduled'&&(confirmed?Date.parse(start)<=now:day<localDay(now)))state='pending';
    if(!Object.hasOwn(status,state))state='unknown';
    const hasScore=state==='final'||state==='live';
    const scoresChanged=base.state==='final'&&row&&(row.hg!==base.homeScore||row.ag!==base.awayScore);
    return {...base,day,start,state,timeConfirmed:confirmed,officialId:row?.officialId||null,week:row?.week||null,round:row?.round||null,statusLabel:state==='live'?(feed?.source==='cached'?'上次確認進行中':row.officialStatus||status.live[1]):status[state][1],statusName:status[state][0],
      venue:row?.venue||base.venue,homeScore:hasScore?(row?.hg??base.homeScore):null,awayScore:hasScore?(row?.ag??base.awayScore):null,
      sourceKey:scoresChanged?null:base.sourceKey,sourceUrl:'/?league=FOOTBALL&competition=hkg.1&view=live&date='+day+'&game='+encodeURIComponent(base.id)};
  }).sort((a,b)=>a.start.localeCompare(b.start));
}
