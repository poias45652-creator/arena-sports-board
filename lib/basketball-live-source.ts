import {basketballPage} from './wnba-fetch';
import {parseBasketballDetail,parseBasketballStandings,type BasketballLeague} from './basketball-live';
import type {NbaGame} from './nba';
const cache=new Map<string,{data:any;fetchedAt:string;until:number}>(),pending=new Map<string,Promise<{data:any;fetchedAt:string;until:number}>>();
async function source(url:string,ttl:number,league:BasketballLeague){
 const cached=cache.get(url);if(cached&&cached.until>Date.now())return cached;
 const waiting=pending.get(url);if(waiting)return waiting;
 const task=(async()=>{const data=JSON.parse(await basketballPage(url,10000,league)),entry={data,fetchedAt:new Date().toISOString(),until:Date.now()+ttl};if(cache.size>=120)cache.delete(cache.keys().next().value!);cache.set(url,entry);return entry;})().finally(()=>pending.delete(url));
 pending.set(url,task);return task;
}
export async function basketballDetail(game:NbaGame,league:BasketballLeague){
 const row=await source(`https://site.api.espn.com/apis/site/v2/sports/basketball/${league.toLowerCase()}/summary?event=${game.id}`,game.state==='final'?300000:8000,league);
 return parseBasketballDetail(row.data,game,league,row.fetchedAt);
}
export async function basketballStandings(league:BasketballLeague,season:number,phase:number){
 const row=await source(`https://site.api.espn.com/apis/v2/sports/basketball/${league.toLowerCase()}/standings?season=${season}&seasontype=${phase}`,300000,league);
 return parseBasketballStandings(row.data,league,season,phase,row.fetchedAt);
}
