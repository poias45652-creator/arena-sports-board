import {collectLeague as collectBase,fetchPublic,dayInTaipei,npbScheduleIds,parseNpb} from './baseball-live-providers.mjs';
export {dayInTaipei} from './baseball-live-providers.mjs';
/** NPB's selected-game detail page omits that game's sidebar identity card.
 * Match the exact opaque game ID from the dated schedule, not team-name guesses.
 */
export async function collectLeague(league,options={}){
 if(league!=='NPB')return collectBase(league,options);
 const date=options.date||dayInTaipei(),fetcher=options.fetcher||fetch;
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw new Error('Invalid date');
 const schedule=await fetchPublic('https://baseball.yahoo.co.jp/npb/schedule/?date='+date,fetcher);
 const ids=npbScheduleIds(schedule.text),games=[],errors=[];
 if(!ids.length)throw new Error('No recognizable first-team schedule; not proof of no games');
 const anchors=[...schedule.text.matchAll(/<a\b[^>]*href=["'][^"']*\/npb\/game\/(\d+)\/(?:index|score)[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi)];
 for(const id of ids){
  try{
   const card=anchors.find(m=>m[1]===id&&/bb-score__homeLogo/.test(m[2]));
   if(!card)throw new Error('Exact schedule identity card missing');
   const root='https://baseball.yahoo.co.jp/npb/game/'+id;
   const page=await fetchPublic(root+'/score',fetcher);
   let stats=null;
   try{stats=await fetchPublic(root+'/stats',fetcher);}catch(e){errors.push(id+':stats '+e.message);}
   // Append only this game's factual card, never unrelated sidebar scores.
   const g=parseNpb(page.text+'\n'+card[0],stats?.text||'',id,page);
   if(g.date!==date)throw new Error('Requested date differs from game date: '+g.date);
   g.source.supportingSources=[{url:schedule.url,fetchedAt:schedule.fetchedAt},...(stats?[{url:stats.url,fetchedAt:stats.fetchedAt}]:[])];
   games.push(g);
  }catch(e){errors.push(id+': '+e.message);}
 }
 return {schemaVersion:1,league,date,collectedAt:new Date().toISOString(),games,errors,status:errors.length?'partial':'ok',liveLatencyVerified:false};
}
