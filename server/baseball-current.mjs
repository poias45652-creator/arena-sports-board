import {collectLeague as collectBase,fetchPublic,dayInTaipei,npbScheduleIds,parseNpb,plain} from './baseball-live-providers.mjs';
export {dayInTaipei} from './baseball-live-providers.mjs';
/**
 * When a postponed CPBL game and a different scheduled game have identical
 * teams and start timestamps, the latter is ambiguous, not an independently
 * verified first-team match. Quarantine it until the upstream calendar settles.
 * Keep the raw collision in audit evidence instead of fabricating a new date.
 */
export function quarantineCpblScheduleCollisions(result){
 if(result?.league!=='CPBL'||!Array.isArray(result.games))return result;
 const postponed=result.games.filter(g=>g.status==='postponed');
 const conflicted=result.games.filter(g=>g.status==='pregame'&&postponed.some(p=>
  p.key!==g.key&&p.date===g.date&&p.startTime===g.startTime&&
  p.away?.id===g.away?.id&&p.home?.id===g.home?.id));
 if(!conflicted.length)return result;
 const keys=new Set(conflicted.map(g=>g.key));
 return {...result,
  games:result.games.filter(g=>!keys.has(g.key)),
  status:'partial',
  errors:[...(result.errors||[]),`CPBL schedule collision: quarantined ${conflicted.length} unverified pregame entry/entries (postponed same teams/time)`],
  quarantinedScheduleEntries:conflicted.map(g=>({key:g.key,rawStatus:g.rawStatus,status:g.status,date:g.date,startTime:g.startTime,awayId:g.away?.id,homeId:g.home?.id,reason:'same teams/start as a postponed game; authoritative schedule reconciliation required'}))
 };
}
/** NPB's selected-game detail page omits that game's sidebar identity card.
 * Match the exact opaque game ID from the dated schedule, not team-name guesses.
 */
export async function collectLeague(league,options={}){
 if(league!=='NPB'){
  const result=await collectBase(league,options);
  return league==='CPBL'?quarantineCpblScheduleCollisions(result):result;
 }
 const date=options.date||dayInTaipei(),fetcher=options.fetcher||fetch;
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw new Error('Invalid date');
 const schedule=await fetchPublic('https://baseball.yahoo.co.jp/npb/schedule/?date='+date,fetcher);
 const ids=npbScheduleIds(schedule.text),games=[],errors=[];
 if(!ids.length){
  // Require the requested date and the page's explicit no-game marker in the
  // selected-day section. Other dates in the weekly sidebar do not count.
  const selectedDay=plain(schedule.text).split('CS・日本シリーズトーナメント表')[0];
  const [,month,day]=date.split('-').map(Number);
  const dateMarker=new RegExp(`${month}月\\s*${day}日`);
  if(dateMarker.test(selectedDay)&&/試合はありません/.test(selectedDay)){
   return {schemaVersion:1,league,date,collectedAt:new Date().toISOString(),games:[],errors:[],status:'ok',offDayVerified:true,offDayEvidence:{url:schedule.url,fetchedAt:schedule.fetchedAt,marker:'試合はありません'},liveLatencyVerified:false};
  }
  throw new Error('No recognizable first-team schedule; not proof of no games');
 }
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
