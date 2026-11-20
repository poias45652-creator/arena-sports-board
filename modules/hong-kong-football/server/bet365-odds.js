import {firstPaintFeed,snapshotFeed} from './season-sync.js';
import {fixtures} from '../../../public/hk-football/league.js';
import {moreFixtures} from './records.js';
import {marketPrediction} from './market-prediction.js';
import {loadQuotes} from './bet365-es.js';
import {leagueUrl,publicEvents,publicHtml,readPublicQuote} from './public-bet365.js';
import snapshot from './bet365-snapshot.json' with {type:'json'};

const scheduled=[...fixtures,...moreFixtures];
const seasonEnd=Date.parse('2027-07-01T00:00:00+08:00');
const hour=3600000;
let cached,pending;
const identity=f=>[f.home,f.away,f.kickoff].join('/');
const saved=new Map(snapshot.map(q=>[identity(q),q]));

function fallback(f,now){
  const previous=saved.get(identity(f)),age=now-Date.parse(previous?.checkedAt);
  if(previous&&age>=0&&age<12*hour)return {...previous,cached:true};
  return {status:'unavailable',markets:[]};
}
async function update(future,key,now){
  const matches={};
  if(key){
    try{
      const regional=await loadQuotes(key,future,now);
      for(const [id,quote] of Object.entries(regional.matches)){
        if(quote.status==='priced')matches[id]={...quote,scope:'es',checkedAt:regional.checkedAt,sourceUrl:'https://www.bet365.es/?#/HO/'};
      }
    }catch{/* Public quotes carry their own region and attribution. */}
  }
  const needed=future.filter(f=>!matches[f.id]);
  if(!needed.length)return matches;
  let events=null,indexState='unrecognized_page';
  try{
    const html=await publicHtml(leagueUrl);
    if(html.includes('league-match-row')&&/Hong Kong Premier League|香港超級聯賽/.test(html)){events=publicEvents(html);indexState='read';}
  }catch(error){indexState=error.message;}
  for(let offset=0;offset<needed.length;offset+=4){
    await Promise.all(needed.slice(offset,offset+4).map(async f=>{
      const links=events?.filter(e=>e.home===f.home&&e.away===f.away)||[];
      const url=links.length===1?links[0].url:saved.get(identity(f))?.sourceUrl;
      if(!url){matches[f.id]={status:events?'noQuote':'unavailable',sourceState:indexState,markets:[]};return;}
      let sourceState='fixture_or_quote_unverified';
      try{
        const quote=readPublicQuote(await publicHtml(url),f,url,new Date(Date.now()).toISOString());
        if(quote){
          matches[f.id]=quote;
          if(quote.status==='priced')saved.set(identity(f),quote);else saved.delete(identity(f));
          return;
        }
      }catch(error){sourceState=error.message;}
      matches[f.id]={...fallback(f,now),sourceState};
    }));
  }
  return matches;
}
async function readOrRefresh(future,key,now,request,signature){
  const cache=globalThis.caches?.default;
  const cacheUrl=new URL('/.hkpl-cache/bet365-quotes-v2',request.url);
  cacheUrl.searchParams.set('round',signature);
  if(cache){
    try{
      const hit=await cache.match(cacheUrl.href);
      if(hit){
        const entry=await hit.json();
        if(entry.signature===signature&&entry.until>now&&entry.data)return entry.data;
      }
    }catch{}
  }
  const data=await update(future,key,now);
  for(const f of future){
    const quote=data[f.id];
    if(quote?.status==='priced'){
      data[f.id]={...quote,home:f.home,away:f.away,kickoff:f.kickoff,prediction:marketPrediction(quote)};
    }
  }
  const fresh=Object.values(data).some(quote=>quote.status==='priced'&&!quote.cached);
  if(cache&&fresh){
    try{
      await cache.put(cacheUrl.href,Response.json({signature,data,until:now+300000},{headers:{'Cache-Control':'public, max-age=300'}}));
    }catch{}
  }
  return data;
}
export async function oddsResponse(env={},request,ctx){
  const now=Date.now(),key=env?.ODDS_API_KEY;
  const feed=now<seasonEnd?await firstPaintFeed(request,ctx):snapshotFeed;
  const pairs=new Map(feed.rows.map(r=>[r.home+'-'+r.away,r]));
  const matches={},future=[];
  for(const f of scheduled){
    const r=pairs.get(f.home+'-'+f.away);
    const kickoff=r?.time?Date.parse(r.dateISO+'T'+r.time+':00+08:00'):NaN;
    if(r?.state==='pre'&&kickoff>now&&now<seasonEnd){
      if(kickoff-now<8*24*hour)future.push({id:f.id,home:f.home,away:f.away,kickoff});
      else matches[f.id]={status:'noQuote',markets:[]};
    }else matches[f.id]={status:r?.state==='pre'&&!r.time?'unconfirmed':'closed',markets:[]};
  }
  const signature=(key?'es':'public')+'|'+future.map(f=>f.id+'@'+f.kickoff).join(',');
  if(future.length){
    if(cached?.signature===signature&&cached.until>now){
      Object.assign(matches,cached.data);
    }else{
      if(pending?.signature!==signature){
        const job={signature};
        job.task=readOrRefresh(future,key,now,request,signature).then(data=>{
          if(pending===job)cached={signature,until:Date.now()+5*60000,data};
          return data;
        }).finally(()=>{if(pending===job)pending=null;});
        pending=job;
      }
      Object.assign(matches,await pending.task);
    }
  }
  return Response.json({bookmaker:'bet365',competition:'hkg.1',status:future.length?'checked':'closed',officialUrl:'https://www.bet365.es/?#/HO/',matches},{headers:{'Cache-Control':'private, no-store'}});
}
