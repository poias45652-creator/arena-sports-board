import {npbGameStart,recoverNpbPregameState} from './baseball-npb-start.mjs';
import {recoverKboPregameState} from './baseball-pregame-state.mjs';
import {collectLeague as collectBase,fetchPublic,dayInTaipei,npbScheduleIds,parseNpb,validateGame,plain} from './baseball-live-providers.mjs';
import {addNpbLive} from './baseball-npb-live.mjs';
import {addNpbContext} from './baseball-npb-context.mjs';
import {enrichLeaguePlayText} from './baseball-play-text.mjs';
import {collectCpblCurrent} from './cpbl-current.mjs';
import {npbScheduleProof} from './baseball-npb-schedule.mjs';
export {dayInTaipei} from './baseball-live-providers.mjs';

// Validate every page independently before optional details can be merged. In
// particular, a stats page from the other half of a doubleheader is not usable.
function verifyNpbPage(page,id,date,kind){
 const expected=`https://baseball.yahoo.co.jp/npb/game/${id}/${kind}`;
 const canonical=page.text.match(/property=["']og:url["']\s+content=["']([^"']+)["']/)?.[1];
 if(page.url!==expected||canonical!==expected)throw Error(`NPB ${kind} game identity conflict`);
 const title=plain(page.text.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]||'');
 const day=title.match(/^(\d{4})年(\d{1,2})月(\d{1,2})日/);
 if(!day||`${day[1]}-${day[2].padStart(2,'0')}-${day[3].padStart(2,'0')}`!==date)throw Error(`NPB ${kind} date conflict`);
 return page;
}

/** Match the exact opaque game ID from the dated schedule, not team-name guesses. */
export async function collectLeague(league,options={}){
 const deadline=AbortSignal.timeout(35000),original=options.fetcher||fetch;
 options={...options,fetcher:(url,init={})=>original(url,{...init,signal:init.signal?AbortSignal.any([deadline,init.signal]):deadline})};
 if(league==='CPBL')return enrichLeaguePlayText(await collectCpblCurrent(options),options);
 if(league!=='NPB'){
  const result=await collectBase(league,options);
  if(league==='KBO')result.games.forEach(recoverKboPregameState);
  return enrichLeaguePlayText(result,options);
 }
 const date=options.date||dayInTaipei(),fetcher=options.fetcher||fetch;
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw new Error('Invalid date');
 const schedule=await fetchPublic('https://baseball.yahoo.co.jp/npb/schedule/?date='+date,fetcher);
 const scheduleVerification={},ids=npbScheduleIds(schedule.text),scheduleProof=npbScheduleProof(schedule,date,scheduleVerification),games=[],errors=[],warnings=[],npbTextPages=new Map();
 if(!ids.length)throw new Error('No recognizable first-team schedule; not proof of no games');
 const anchors=[...schedule.text.matchAll(/<a\b[^>]*href=["'][^"']*\/npb\/game\/(\d+)\/(?:index|score)[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi)];
 await Promise.all(ids.map(async id=>{
  try{
   const card=anchors.find(m=>m[1]===id&&/bb-score__homeLogo/.test(m[2]));
   if(!card)throw new Error('Exact schedule identity card missing');
   const root='https://baseball.yahoo.co.jp/npb/game/'+id;
   const requests=await Promise.allSettled([fetchPublic(root+'/top',fetcher),fetchPublic(root+'/stats',fetcher),fetchPublic(root+'/score',fetcher),fetchPublic(root+'/text',fetcher)]);
   npbTextPages.set(id,requests[3].status==='fulfilled'?requests[3].value:null);
   const detailWarnings=[],pages={};
   const warn=(kind,error)=>detailWarnings.push(`npb_${kind}: ${error?.message||error}`);
   for(const [kind,index] of [['top',0],['stats',1],['score',2]]){
    const request=requests[index];
    try{
     if(request.status!=='fulfilled')throw request.reason;
     pages[kind]=verifyNpbPage(request.value,id,date,kind);
    }catch(e){warn(kind,e);}
   }
   let page,g;
   // The score and top pages can each supply a fresh fixture. Stats are parsed
   // separately so a missing or mismatched stats page cannot discard its score.
   for(const kind of ['score','top']){
    if(!pages[kind])continue;
    try{const parsed=parseNpb(pages[kind].text+'\n'+card[0],'',id,pages[kind]);g=parsed;page=pages[kind];break;}
    catch(e){warn(kind,e);}
   }
   if(!g)throw Error('NPB game pages unavailable; '+detailWarnings.join('; '));
   if(page===pages.score){
    try{g=addNpbLive(structuredClone(g),page);}
    catch(e){
     // Conflicting/missing live inning evidence cannot authorize one of the
     // competing inning labels. The independently verified score stays fresh.
     if(e?.message==='NPB live inning conflict'){g.inning=null;g.half=null;}
     warn('live_detail',e);
    }
   }
   // A missing top page must not be passed to the top-only clock parser. Leave
   // an unreported start null; the feed may retain this exact fixture's clock.
   if(pages.top)g.startTime=npbGameStart(pages.top.text,id,g.date,g.startTime);
   recoverNpbPregameState(g);
   if(g.date!==date)throw new Error('Requested date differs from game date: '+g.date);
   try{if(pages.top)g=addNpbContext(structuredClone(g),pages.top);}catch(e){warn('starters',e);}
   const supporting=[schedule,...(pages.top&&page!==pages.top?[pages.top]:[])];
   if(pages.stats){
    try{
     const parsed=parseNpb(page.text+'\n'+card[0],pages.stats.text,id,page);
     g.batting=parsed.batting;g.pitching=parsed.pitching;supporting.push(pages.stats);
    }catch(e){warn('stats',e);}
   }
   g.source.supportingSources=supporting.map(p=>({url:p.url,fetchedAt:p.fetchedAt}));
   validateGame(g);g.warnings=[...new Set([...g.warnings,...detailWarnings])];
   warnings.push(...detailWarnings.map(w=>`${id}: ${w}`));
   games.push(g);
  }catch(e){errors.push(id+': '+e.message);}
 }));
 return enrichLeaguePlayText({schemaVersion:1,league,date,collectedAt:new Date().toISOString(),games,errors,warnings,scheduleProof,scheduleVerification,status:errors.length?'partial':'ok',liveLatencyVerified:false},{...options,npbTextPages});
}
