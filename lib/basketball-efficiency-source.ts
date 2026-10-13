import {nbaFixtureKey,type NbaGame} from './nba';
import {analyzeEfficiency,efficiencyHistory,type BasketballLeague,type EfficiencyBox,type Weights,DEFAULT_WEIGHTS} from './basketball-efficiency';
import {fetchEfficiencyBox} from './basketball-box-source';
const cache=new Map<string,{box:EfficiencyBox;expires:number}>(),pending=new Map<string,Promise<EfficiencyBox>>();
let active=0;const queue:(()=>void)[]=[];
async function box(game:NbaGame,league:BasketballLeague){
 const key=`${league}:${nbaFixtureKey(game)}:${game.homeScore}:${game.awayScore}`,hit=cache.get(key);if(hit&&hit.expires>Date.now())return hit.box;if(pending.has(key))return pending.get(key)!;
 if(queue.length>=160)throw Error('效率資料更新忙碌中');
 const task=(async()=>{if(active>=8)await new Promise<void>(r=>queue.push(r));else active++;
  try{
   const result=await fetchEfficiencyBox(game,league),capturedAt=Date.now();
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
