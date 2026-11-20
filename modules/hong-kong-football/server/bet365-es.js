const bookmaker = 'Bet365 ES';
export const aliases = {
  LM:['lee man','lee man warriors'], ND:['north district','golik north district','golik north','north district sports association'],
  TP:['tai po','wofoo tai po'], KC:['kitchee','kitchee sc'],
  SO:['southern','southern district','kwoon chung southern','southern district rsa'],
  BR:['rangers','bc rangers','biu chun rangers','hong kong rangers','hk rangers','b.c. rangers'],
  ST:['supreme shatin','supreme sha tin','sha tin','shatin'],
  EA:['eastern','eastern sports club','eastern aa','eastern long lions','eastern sc','eastern football team'],
  HK:['hkfc','hong kong football club','hong kong fc'], ED:['eastern district','eastern district sports association'],
  KL:['kowloon city','wofoo kowloon city','kowloon city football club']
};
export function normalized(s) {
  return String(s || '').toLowerCase().replace(/\bfootball club\b|\bfc\b/g,'').replace(/[^a-z0-9]/g,'');
}
function leagueMatches(slug) {
  return /^(?:china-)?hong-?kong(?:-china)?-(?:premier-league|premier-division|hong-kong-premier-league)$/.test(slug);
}
function sameEvent(match,event) {
  const sameTeam=(id,team)=>aliases[id]?.some(alias=>normalized(alias)===normalized(team));
  return event.sport?.slug==='football' && leagueMatches(event.league?.slug) &&
    sameTeam(match.home,event.home) && sameTeam(match.away,event.away) &&
    Math.abs(Date.parse(event.date)-match.kickoff)<=300000;
}
function number(value) {
  return typeof value==='number' || (typeof value==='string' && /^[-+]?\d+(\.\d+)?$/.test(value.trim())) ? Number(value) : NaN;
}
function suspended(value) {
  return value.suspended === true || value.active === false || value.locked === true ||
    ['closed','suspended','locked','inactive'].includes(String(value.status).toLowerCase());
}
function parseMarkets(event) {
  const list=event.bookmakers?.[bookmaker];
  if (!Array.isArray(list)) return [];
  return list.flatMap(market=>{
    if (!market || !Array.isArray(market.odds) || suspended(market)) return [];
    if (market.name==='ML') {
      const active=market.odds.filter(row=>row && !suspended(row));
      if (active.length!==1) return [];
      const prices=['home','draw','away'].map(side=>number(active[0][side]));
      if (!prices.every(price=>Number.isFinite(price)&&price>1)) return [];
      return [{name:'1X2',prices:prices.map(price=>Math.round((price-1)*1000)/1000)}];
    }
    if (!['Spread','Totals'].includes(market.name)) return [];
    const spread=market.name==='Spread';
    const lines=market.odds.flatMap(item=>{
      if (!item || suspended(item) || item.draw!=null) return [];
      const line=number(item.hdp);
      const first=number(spread?item.home:item.over), second=number(spread?item.away:item.under);
      if (!Number.isInteger(line*4) || (!spread && line<0) || !Number.isFinite(first) || !Number.isFinite(second) || first<=1 || second<=1) return [];
      return [{line,first:Math.round((first-1)*1000)/1000,second:Math.round((second-1)*1000)/1000}];
    }).sort((a,b)=>a.line-b.line);
    if (!lines.length) return [];
    const time=Date.parse(market.updatedAt);
    return [{name:market.name,updatedAt:Number.isFinite(time)?new Date(time).toISOString():null,lines}];
  });
}
async function provider(resource,params,key) {
  const url=new URL('https://api.odds-api.io/v3/'+resource);
  url.search=new URLSearchParams({...params,apiKey:key});
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),6500);
  try {
    const res=await fetch(url,{headers:{accept:'application/json'},redirect:'manual',signal:controller.signal});
    if (!res.ok) throw new Error([401,402,403].includes(res.status)?'permission':res.status===429?'rateLimit':'unavailable');
    const rows=await res.json();
    if (!Array.isArray(rows)) throw new Error('unavailable');
    return rows;
  } finally { clearTimeout(timer); }
}
let leagueCache, eventCache;
async function activeEvents(key,now) {
  if (!leagueCache || now>=leagueCache.until) {
    const rows=await provider('leagues',{sport:'football'},key);
    const slugs=rows.map(row=>row.slug).filter(leagueMatches);
    leagueCache={until:now+(slugs.length?3600000:300000),slugs};
  }
  if (!leagueCache.slugs.length) return null;
  if (!eventCache || now>=eventCache.until) {
    const data=await Promise.all(leagueCache.slugs.map(league=>provider('events',{sport:'football',league,status:'pending',limit:'100'},key)));
    eventCache={until:now+300000,events:data.flat()};
  }
  return eventCache.events;
}
export async function loadQuotes(key,future,now) {
  const events=await activeEvents(key,now);
  const matches={}, pairs=[];
  for (const match of future) {
    const hits=(events||[]).filter(row=>row.status==='pending' && sameEvent(match,row));
    if (hits.length!==1 || !Number.isSafeInteger(hits[0].id)) {
      matches[match.id]={status:events?'unmatched':'leagueUnavailable'}; continue;
    }
    pairs.push({match,id:hits[0].id});
  }
  for(let index=0;index<pairs.length;index+=10) {
    const group=pairs.slice(index,index+10);
    const odds=await provider('odds/multi',{eventIds:group.map(p=>p.id).join(','),bookmakers:bookmaker,markets:'ML,Spread,Totals'},key);
    for(const {id,match} of group) {
      const event=odds.find(row=>row.id===id && sameEvent(match,row));
      const markets=event && (!event.status || event.status==='pending') ? parseMarkets(event) : [];
      matches[match.id]={status:markets.length?'priced':'noQuote',markets};
    }
  }
  return {status:'checked',checkedAt:new Date(now).toISOString(),matches};
}
