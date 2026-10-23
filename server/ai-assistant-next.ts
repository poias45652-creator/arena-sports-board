import {aiDay,validAiDay,type AiMatch} from '@/lib/ai-assistant';
import {isFootballLeague} from '@/lib/football';
import {listAiMatches} from './ai-assistant-data';

// Search only the same providers and fixtures that the assistant can open.
// A calendar date alone is not enough: confirm its selectable matches as well.
export async function nextAiMatches(league:string,after:string,signal:AbortSignal):Promise<{day:string|null;matches:AiMatch[]}>{
 signal.throwIfAborted();
 let day:string|null=null;
 if(league==='MLB'){
  const {loadSource}=await import('@/app/api/analysis/source');
  const schedule=await loadSource('schedule');
  day=(schedule.games||[]).filter((g:any)=>Number.isFinite(Date.parse(g.date))).map((g:any)=>aiDay(g.date)).filter((d:string)=>d>after&&validAiDay(d)).sort()[0]||null;
 }else if(league==='NPB'){
  const {getInternationalLive}=await import('@/lib/international-feed');
  // Inspect lightweight daily feeds; load pitching/model data only on a found day.
  for(let offset=1;offset<=14;offset++){
   signal.throwIfAborted();
   const candidate=new Date(Date.parse(after)+offset*86400000).toISOString().slice(0,10);
   if(!validAiDay(candidate))break;
   const feed=await getInternationalLive('NPB',candidate);
   signal.throwIfAborted();
   if(feed.stale||feed.status!=='ok')throw Error('Schedule unavailable');
   if(feed.games.some((g:any)=>!g.sourceStale&&Number.isFinite(Date.parse(g.startTime))&&aiDay(g.startTime)===candidate&&!['cancelled','postponed'].includes(g.status))){day=candidate;break;}
   if(!feed.noGames)throw Error('Schedule unconfirmed');
  }
 }else if(league==='NBA'){
  const {nextNbaDay}=await import('@/lib/nba-source');day=(await nextNbaDay(after)).day;
 }else if(league==='WNBA'){
  const {nextWnbaDay}=await import('@/lib/wnba-source');day=(await nextWnbaDay(after)).day;
 }else if(isFootballLeague(league)){
  const {nextFootballDay}=await import('@/lib/football-source');day=(await nextFootballDay(league,after)).day;
 }else throw Error('Invalid league');
 signal.throwIfAborted();
 if(!day)return {day:null,matches:[]};
 if(!validAiDay(day)||day<=after)return {day:null,matches:[]};
 const matches=(await listAiMatches(league,day)).filter(g=>g.league===league&&g.day===day&&Number.isFinite(Date.parse(g.start))&&aiDay(g.start)===day);
 signal.throwIfAborted();
 if(!matches.length)throw Error('Schedule changed');
 return {day,matches};
}
