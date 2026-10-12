import {nbaFixtureKey,type NbaGame} from './nba';
import {analyzeEfficiency,efficiencyHistory,parseEfficiencyBox,type BasketballLeague,type EfficiencyBox,type Weights,DEFAULT_WEIGHTS} from './basketball-efficiency';
import {wnbaPage,nbaPage} from './wnba-fetch';
const cache=new Map<string,{box:EfficiencyBox;expires:number}>(),pending=new Map<string,Promise<EfficiencyBox>>();
let active=0;const queue:(()=>void)[]=[];
async function box(game:NbaGame,league:BasketballLeague){
 const key=`${league}:${nbaFixtureKey(game)}:${game.homeScore}:${game.awayScore}`,hit=cache.get(key);if(hit&&hit.expires>Date.now())return hit.box;if(pending.has(key))return pending.get(key)!;
 if(queue.length>=160)throw Error('效率資料更新忙碌中');
 const task=(async()=>{if(active>=8)await new Promise<void>(r=>queue.push(r));else active++;
  try{
   const url=`https://site.api.espn.com/apis/site/v2/sports/basketball/${league.toLowerCase()}/summary?event=${game.id}`;
   let raw:any;
   if(league==='WNBA')raw=JSON.parse(await wnbaPage(url,12000));
   else raw=JSON.parse(await nbaPage(url,12000));
   const result=parseEfficiencyBox(raw,game,league),capturedAt=Date.now();
   if(cache.size>=1200)cache.delete(cache.keys().next().value!);cache.set(key,{box:result,expires:capturedAt+24*3600000});return result;
  }finally{const next=queue.shift();if(next)next();else active--;}
 })().finally(()=>pending.delete(key));pending.set(key,task);return task;
}
export async function efficiencyGameAnalysis(game:NbaGame,history:NbaGame[],league:BasketballLeague,weights:Weights=DEFAULT_WEIGHTS){
 const now=Date.now(),home=efficiencyHistory(game,history,game.home.id,league,now),away=efficiencyHistory(game,history,game.away.id,league,now);
 if(home.length<8||away.length<8)return analyzeEfficiency(game,history,[],league,weights,now);
 const unique=[...new Map([...home,...away].map(g=>[g.id,g])).values()],boxes=await Promise.all(unique.map(g=>box(g,league)));
 return analyzeEfficiency(game,history,boxes,league,weights,Date.now());
}
