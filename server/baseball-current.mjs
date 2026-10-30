import {collectLeague as collectBase,fetchPublic,dayInTaipei,npbScheduleIds,parseNpb,plain,integerOrNull,validateGame} from './baseball-live-providers.mjs';
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

/** Fallback for KBO's publicly readable first-team scoreboard.
 * Strict date, league and game identity checks; unsupported fields remain null.
 * Runner freshness and 65-second changes are verified separately.
 */
const KBO_OFFICIAL_TEAMS={
 SS:'三星獅',HT:'起亞虎',SK:'SSG登陸者',HH:'韓華鷹',KT:'KT巫師',
 LG:'LG雙子',NC:'NC恐龍',LT:'樂天巨人',OB:'斗山熊',WO:'培證英雄'
};
export function parseKboOfficialScoreboard(html,page,date){
 const displayed=plain(html.match(/<span\b[^>]*id=["'][^"']*lblGameDate["'][^>]*>([\s\S]*?)<\/span>/i)?.[1]||'');
 if(!displayed.startsWith(date.replaceAll('-','.')))throw new Error('Official KBO selected-date mismatch: '+displayed+' vs '+date);
 const cards=html.split(/<div\b[^>]*class=["']smsScore["'][^>]*>/i).slice(1);
 if(!cards.length)throw new Error('Official KBO scoreboard has no identifiable first-team game; not proof of off-day');
 const games=[],errors=[];
 for(const card of cards){
  try{
   const idMatch=card.match(/LiveText\.aspx\?leagueId=(\d+)(?:&amp;|&)seriesId=(\d+)(?:&amp;|&)gameId=(\d{8}[A-Z0-9]+)(?:&amp;|&)/i);
   // The first-team public scoreboard hides LiveText/gameId until first pitch.
   // Only verified pregame cards may use a provisional internal key. Never
   // invent an official game ID, and never relax LIVE/FINAL identity checks.
   const rawStatus=plain(card.match(/<strong\b[^>]*class=["']flag["'][^>]*>([\s\S]*?)<\/strong>/i)?.[1]||'');
   const inningStatus=rawStatus.match(/^(\d{1,2})회(초|말)$/);
   const status=inningStatus?'live':/경기종료|경기끝|종료|콜드게임/.test(rawStatus)?'final':/경기전|시작전|경기예정/.test(rawStatus)?'pregame':/취소/.test(rawStatus)?'cancelled':/연기/.test(rawStatus)?'postponed':/중단/.test(rawStatus)?'suspended':'unknown';
   if(status==='unknown')throw new Error('Unknown KBO state: '+rawStatus);
   const pregameWithoutId=!idMatch&&status==='pregame';
   if(!pregameWithoutId&&(!idMatch||idMatch[1]!=='1'||!['0','1','5'].includes(idMatch[2])))throw new Error('Not a recognized first-team regular/postseason game');
   const id=idMatch?.[3]??null;
   if(id&&!id.startsWith(date.replaceAll('-','')))throw new Error('Official game ID/date mismatch');
   const section=name=>card.match(new RegExp('<p\\b[^>]*class=[\\x22\\x27]'+name+'[\\x22\\x27][^>]*>([\\s\\S]*?)<\\/p>','i'))?.[1]||'';
   const awayRaw=section('leftTeam'),homeRaw=section('rightTeam');
   const awayCode=awayRaw.match(/emblem_([A-Z]{2})\.png/i)?.[1];
   const homeCode=homeRaw.match(/emblem_([A-Z]{2})\.png/i)?.[1];
   if(!KBO_OFFICIAL_TEAMS[awayCode]||!KBO_OFFICIAL_TEAMS[homeCode]||awayCode===homeCode)throw new Error('Official team codes missing or invalid');
   if(id&&!id.includes(awayCode+homeCode))throw new Error('Official game ID/team code mismatch');
   const played=['live','final','suspended'].includes(status);
   const table=card.match(/<table\b[^>]*class=["']tScore["'][^>]*>([\s\S]*?)<\/table>/i)?.[1]||'';
   if(!table)throw new Error('Official score table missing');
   const rows=[...table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map(x=>x[1]).filter(x=>/scope=["']row["']/.test(x));
   if(rows.length!==2)throw new Error('Official score table sides missing');
   const data=rows.map(row=>({
    name:plain(row.match(/<th\b[^>]*>([\s\S]*?)<\/th>/i)?.[1]||''),
    cells:[...row.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(x=>plain(x[1]))
   }));
   if(data.some(d=>d.cells.length!==19))throw new Error('Unexpected KBO scoreboard row width');
   const nameRaw=s=>plain(s.match(/<strong\b[^>]*class=["']teamT["'][^>]*>([\s\S]*?)<\/strong>/i)?.[1]||'');
   if(data[0].name!==nameRaw(awayRaw)||data[1].name!==nameRaw(homeRaw))throw new Error('Scoreboard team identity conflict');
   const labelScore=s=>integerOrNull(plain(s.match(/<em\b[^>]*class=["']score["'][^>]*>([\s\S]*?)<\/em>/i)?.[1]||''));
   const score=(s,d)=>{const v=integerOrNull(d.cells[15]);if(played&&(v===null||labelScore(s)!==v))throw new Error('Official header and table scores differ');return played?v:null;};
   const away={id:awayCode,name:KBO_OFFICIAL_TEAMS[awayCode],score:score(awayRaw,data[0]),hits:played?integerOrNull(data[0].cells[16]):null,errors:played?integerOrNull(data[0].cells[17]):null};
   const home={id:homeCode,name:KBO_OFFICIAL_TEAMS[homeCode],score:score(homeRaw,data[1]),hits:played?integerOrNull(data[1].cells[16]):null,errors:played?integerOrNull(data[1].cells[17]):null};
   const time=plain(section('place')).match(/\b([01]\d|2[0-3]):([0-5]\d)\b/);
   const startTime=time?new Date(date+'T'+time[1]+':'+time[2]+':00+09:00').toISOString():null;
   if(pregameWithoutId&&!startTime)throw new Error('Official pregame card missing start time');
   const provisionalKey='KBO:official-pregame:'+date.replaceAll('-','')+':'+awayCode+':'+homeCode+':'+time?.[1]+time?.[2];
   const g={
    key:id?'KBO:'+id:provisionalKey,id:id??provisionalKey.slice(4),sourceGameId:id,league:'KBO',date,startTime,status,rawStatus,away,home,
    inning:inningStatus?Number(inningStatus[1]):null,
    half:inningStatus?(inningStatus[2]==='초'?'top':'bottom'):null,
    balls:null,strikes:null,outs:null,bases:null,currentPitcher:null,currentBatter:null,
    starters:{away:null,home:null},lineups:{away:[],home:[]},lineupConfirmation:'not_verified',
    batting:{away:[],home:[]},pitching:{away:[],home:[]},innings:{away:[],home:[]},
    source:{provider:'kbo-official-scoreboard',url:page.url,fetchedAt:page.fetchedAt,httpDate:page.httpDate??null,cacheAgeSeconds:page.cacheAgeSeconds??null,providerUpdatedAt:null},
    warnings:[...(pregameWithoutId?['official_pregame_game_id_not_exposed_internal_key_provisional']:[]),'lineup_confirmation_not_verified','bases_not_verified','pitch_count_not_supplied','provider_update_time_not_supplied']
   };
   if(played)for(const [side,d] of [['away',data[0]],['home',data[1]]])
    g.innings[side]=d.cells.slice(0,15).map((v,i)=>({inning:i+1,runs:integerOrNull(v)})).filter(x=>x.runs!==null);
   if(status==='live'){
    const bs=plain(card.match(/<div\b[^>]*class=(?:["']?)base(?:["']?)[^>]*>([\s\S]*?)<\/div>/i)?.[1]||'');
    const m=bs.match(/(\d+)\s*-\s*(\d+)\s*(\d+)\s*out/i);
    if(m){const b=integerOrNull(m[1]),s=integerOrNull(m[2]),o=integerOrNull(m[3]);
     g.balls=b!==null&&b<=3?b:null;g.strikes=s!==null&&s<=2?s:null;g.outs=o!==null&&o<=3?o:null;}
   }
   // The official scoreboard can pre-render "1회초" with 0:0 and empty game
   // events well before the scheduled first pitch. It is not LIVE evidence.
   const prematureEmptyFirstInning=g.status==='live'&&Number.isFinite(Date.parse(g.startTime))&&
    Number.isFinite(Date.parse(page.fetchedAt))&&Date.parse(page.fetchedAt)<Date.parse(g.startTime)-120000&&
    g.inning===1&&g.half==='top'&&g.away.score===0&&g.home.score===0&&
    g.away.hits===0&&g.home.hits===0&&g.away.errors===0&&g.home.errors===0&&
    g.innings.away.length===1&&g.innings.away[0].inning===1&&g.innings.away[0].runs===0&&
    g.innings.home.length===0&&g.balls===null&&g.strikes===null&&g.outs===null;
   if(prematureEmptyFirstInning){
    g.status='pregame';g.inning=null;g.half=null;
    for(const side of ['away','home']){g[side].score=null;g[side].hits=null;g[side].errors=null;g.innings[side]=[];}
    g.warnings.push('official_zero_zero_first_inning_placeholder_before_scheduled_start_not_live');
   }
   games.push(validateGame(g));
  }catch(err){errors.push(String(err?.message||err));}
 }
 if(!games.length)throw new Error('Official KBO page contained no validated first-team games: '+errors.join('; '));
 return {schemaVersion:1,league:'KBO',date,collectedAt:new Date().toISOString(),games,errors,status:errors.length?'partial':'ok',liveLatencyVerified:false,publicFallback:true};
}

/** The KBO public scoreboard follows Korea time and advances its selected day
 * at 23:00 Taipei. For the single-hour date gap, use the same public Prev Date
 * control that the site exposes. Strictly parse/check the resulting day;
 * never treat a next-day response as requested-day evidence.
 */
export async function kboOfficialPageForDate(initialPage,date,fetcher=fetch){
 const selectedDay=page=>plain(page.text.match(/<span\b[^>]*id=["'][^"']*lblGameDate["'][^>]*>([\s\S]*?)<\/span>/i)?.[1]||'');
 const display=selectedDay(initialPage);
 if(display.startsWith(date.replaceAll('-','.')))return initialPage;
 const selected=display.match(/^(\d{4})\.(\d{2})\.(\d{2})/);
 const selectedDate=selected?[selected[1],selected[2],selected[3]].join('-'):null;
 const followingDate=new Date(Date.parse(date+'T00:00:00Z')+86400000).toISOString().slice(0,10);
 if(selectedDate!==followingDate)throw new Error('Official KBO selected-date mismatch: '+display+' vs '+date);
 const original=new URLSearchParams();
 for(const input of initialPage.text.matchAll(/<input\b([^>]*)>/gi)){
  const attrs=input[1];const name=attrs.match(/\bname=["']([^"']+)["']/i)?.[1];
  const value=attrs.match(/\bvalue=["']([^"']*)["']/i)?.[1];
  if(name&&value!==undefined)original.set(name,value);
 }
 const prefix='ctl00$ctl00$ctl00$cphContents$cphContents$cphContents$';
 if(!original.has('__VIEWSTATE')||!original.has('__EVENTVALIDATION')||
    !original.has(prefix+'hfSearchDate')||
    !initialPage.text.includes(prefix+'btnPreDate')||
    !initialPage.text.includes(prefix+'btnCalendarSelect'))
  throw new Error('KBO public day-selection form cannot be verified; no navigation performed');
 const url='https://www.koreabaseball.com/Schedule/ScoreBoard.aspx';
 const submit=async(button,searchDate)=>{
  const form=new URLSearchParams(original);
  form.set('__EVENTTARGET',prefix+button);
  form.set('__EVENTARGUMENT','');
  if(searchDate)form.set(prefix+'hfSearchDate',searchDate);
  return fetchPublic(url,(u,init)=>fetcher(u,{...init,method:'POST',
   headers:{...init.headers,'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8'},body:form.toString()}));
 };
 // Try the site's public date-picker first; strict validation prevents returning another day.
 const calendar=await submit('btnCalendarSelect',date.replaceAll('-',''));
 if(selectedDay(calendar).startsWith(date.replaceAll('-','.')))return calendar;
 const previous=await submit('btnPreDate',null);
 if(selectedDay(previous).startsWith(date.replaceAll('-','.')))return previous;
 throw new Error('Official KBO public date-navigation mismatch: requested '+date+
  '; calendar '+selectedDay(calendar)+'; previous '+selectedDay(previous));
}

/** NPB's selected-game detail page omits that game's sidebar identity card.
 * Match the exact opaque game ID from the dated schedule, not team-name guesses.
 */
export async function collectLeague(league,options={}){
 if(league==='KBO'){
  try{return await collectBase(league,options);}
  catch(primaryError){
   const date=options.date||dayInTaipei(),fetcher=options.fetcher||fetch;
   try{
    const initialPage=await fetchPublic('https://www.koreabaseball.com/Schedule/ScoreBoard.aspx',fetcher);
    const page=await kboOfficialPageForDate(initialPage,date,fetcher);
    const result=parseKboOfficialScoreboard(page.text,page,date);
    result.status='partial';
    result.errors.push('Naver primary unavailable: '+String(primaryError.message));
    return result;
   }catch(fallbackError){throw new Error('KBO Naver: '+primaryError.message+'; official fallback: '+fallbackError.message);}
  }
 }
 if(league!=='NPB'){
  const result=await collectBase(league,options);
  return league==='CPBL'?quarantineCpblScheduleCollisions(result):result;
 }
 const date=options.date||dayInTaipei(),fetcher=options.fetcher||fetch;
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw new Error('Invalid date');
 const schedule=await fetchPublic('https://baseball.yahoo.co.jp/npb/schedule/?date='+date,fetcher);
 // The upstream page can ignore the requested query date and return yesterday's
 // selected game. Reject the entire page before parsing weekly navigation cards.
 const selectedText=plain(schedule.text).split('CS・日本シリーズトーナメント表')[0];
 const selectedDayMatches=[...selectedText.matchAll(/(\d{1,2})月\s*(\d{1,2})日[（(][^）)]*[）)]/g)];
 const selectedDay=selectedDayMatches.at(-1);
 const [,requestedMonth,requestedDay]=date.split('-').map(Number);
 if(!selectedDay||Number(selectedDay[1])!==requestedMonth||Number(selectedDay[2])!==requestedDay)
  throw new Error('NPB schedule selected day mismatch: requested '+date+'; upstream day '+(selectedDay?selectedDay[1]+'/'+selectedDay[2]:'unknown')+'; not evidence of an off-day');
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
