import {parseFootballDetail,parseFootballStandings,attachFootballStandingForm} from './football-live';
import type {FootballGame,FootballLeague} from './football';
const cache=new Map<string,{data:any;fetchedAt:string;expires:number}>(),pending=new Map<string,Promise<{data:any;fetchedAt:string;expires:number}>>();
async function source(url:string,ttl:number){
 const hit=cache.get(url);if(hit&&hit.expires>Date.now())return hit;if(pending.has(url))return pending.get(url)!;
 const task=(async()=>{const r=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('足球資料來源暫時無法連線');const text=await r.text();if(text.length>12000000)throw Error('足球來源資料過大');const entry={data:JSON.parse(text),fetchedAt:new Date().toISOString(),expires:Date.now()+ttl};if(cache.size>=100)cache.delete(cache.keys().next().value!);cache.set(url,entry);return entry;})().finally(()=>pending.delete(url));pending.set(url,task);return task;
}
export async function footballDetail(game:FootballGame){const row=await source(`https://site.api.espn.com/apis/site/v2/sports/soccer/${game.league}/summary?event=${game.id}`,game.state==='final'?300000:8000);return parseFootballDetail(row.data,game,row.fetchedAt);}
export async function footballStandings(league:FootballLeague,season:number){
 const row=await source(`https://site.api.espn.com/apis/v2/sports/soccer/${league}/standings?season=${season}`,300000),table=parseFootballStandings(row.data,league,season,row.fetchedAt);
 const years=[season,season+1].filter(y=>y<=new Date().getUTCFullYear()),history=await Promise.allSettled(years.map(y=>source(`https://site.api.espn.com/apis/site/v2/sports/soccer/${league}/scoreboard?dates=${y}&limit=1000`,600000)));
 if(history.some(r=>r.status==='rejected'||!Array.isArray(r.value.data?.events)||r.value.data.events.length>=1000))return table;
 return attachFootballStandingForm(table,history.flatMap(r=>r.status==='fulfilled'?[r.value.data]:[]));
}
