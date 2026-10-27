import {collectLeague as collectBase,fetchPublic,dayInTaipei,npbScheduleIds,parseNpb,plain} from './baseball-live-providers.mjs';
export {dayInTaipei} from './baseball-live-providers.mjs';
// Conditional postseason fixtures can remain on Yahoo's team-card schedule even
// when the series has already ended. Suppress only a *metadata-only pregame* card
// whose non-occurrence has separately been verified; never suppress a real
// LIVE/FINAL record or infer cancellation from a missing box score alone.
const VOIDED_CPBL_CONDITIONAL_FIXTURES = new Map([
 ['CPBL:261027007', {
  date:'2026-10-27',startTime:'2026-10-27T10:35:00.000Z',
  awayId:'cpbl.t.1',homeId:'cpbl.t.7',
  evidenceUrl:'https://sports.ltn.com.tw/news/breakingnews/5619302',
  reason:'Taiwan Series ended 2026-10-26: Wei Chuan won G6 6-0 and the series 4-2; conditional G7 does not take place'
 }]
]);
/**
 * Yahoo can put G5/G6/G7 in the same CPBL date/time slot after postponements.
 * Keep independently detailed games; quarantine unverified schedule-only entries.
 * If two games claim the slot without a unique detailed game, keep neither.
 * Never infer an additional game from duplicate pregame team cards.
 */
export function quarantineCpblScheduleCollisions(result){
 if(result?.league!=='CPBL'||!Array.isArray(result.games))return result;
 const slots=new Map();
 for(const g of result.games){
  const slot=[g.date,g.startTime,g.away?.id,g.home?.id].join('|');
  if(!slots.has(slot))slots.set(slot,[]);
  slots.get(slot).push(g);
 }
 const rejected=new Map();
 for(const g of result.games){
  const voided=VOIDED_CPBL_CONDITIONAL_FIXTURES.get(g.key);
  if(voided&&g.status==='pregame'&&g.date===voided.date&&g.startTime===voided.startTime&&
   g.away?.id===voided.awayId&&g.home?.id===voided.homeId&&
   g.warnings?.includes('pregame_metadata_only_game_detail_has_no_full_boxscore'))
   rejected.set(g.key,voided.reason);
 }
 for(const group of slots.values()){
  if(group.length<2)continue;
  const pregame=group.filter(g=>g.status==='pregame');
  const conflictingStatus=group.some(g=>['postponed','live','final','suspended','cancelled'].includes(g.status));
  if(conflictingStatus){
   for(const g of pregame)rejected.set(g.key,'same-slot game already has a postponed, live, final, suspended or cancelled record');
   continue;
  }
  if(pregame.length<2)continue;
  // A full game detail payload supplies stronger provenance than a team-card
  // preview. This identifies the current G5 without pretending G6/G7 are today.
  const full=pregame.filter(g=>
   !g.warnings?.includes('pregame_metadata_only_game_detail_has_no_full_boxscore')&&
   /^https:\/\/tw\.sports\.yahoo\.com\/cpbl\/[^/]+-\d{9}\/$/.test(g.source?.url||''));
  const keep=full.length===1?full[0]:null;
  for(const g of pregame)if(g!==keep)rejected.set(g.key,
   keep?'same teams/start as uniquely detailed CPBL game '+keep.key:
   'multiple pregame entries share the same teams/start; no unique detailed game');
 }
 if(!rejected.size)return result;
 return {...result,
  games:result.games.filter(g=>!rejected.has(g.key)),
  status:'partial',
  errors:[...(result.errors||[]),'CPBL schedule collision: quarantined '+rejected.size+' unverified same-slot entry/entries'],
  quarantinedScheduleEntries:result.games.filter(g=>rejected.has(g.key)).map(g=>({
   key:g.key,rawStatus:g.rawStatus,status:g.status,date:g.date,startTime:g.startTime,
   awayId:g.away?.id,homeId:g.home?.id,sourceUrl:g.source?.url||null,reason:rejected.get(g.key),
   evidenceUrl:VOIDED_CPBL_CONDITIONAL_FIXTURES.get(g.key)?.evidenceUrl||null
  }))
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
