import {dayInTaipei,plain,npbScheduleIds} from './baseball-live-providers.mjs';

const ORIGIN='https://baseball.yahoo.co.jp';
const KIND='npb-dated-first-team-schedule';
const TEAM_IDS=new Set(['1','2','3','4','5','6','7','8','9','11','12','376']);
const isDay=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+'T00:00:00Z'))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;
const shift=(date,days)=>new Date(Date.parse(date+'T00:00:00Z')+days*86400000).toISOString().slice(0,10);
const scheduleUrl=date=>`${ORIGIN}/npb/schedule/?date=${date}`;
const csUrl=date=>`${ORIGIN}/npb/schedule/first/cs?date=${date}`;
const gameId=value=>typeof value==='string'&&/^\d+$/.test(value);
const teamsOk=g=>TEAM_IDS.has(g.homeId)&&TEAM_IDS.has(g.awayId)&&g.homeId!==g.awayId;
const BATTING_METRICS=Object.freeze(['AT_BATS','RUNS','HITS','RBIS','HOME_RUNS','WALKS','STRIKEOUTS']);
function emptyPregameBatting(rows){
 return rows.length<=50&&rows.every(row=>{
  const stats=row?.stats;
  return stats&&typeof stats==='object'&&!Array.isArray(stats)&&Object.keys(stats).length===BATTING_METRICS.length&&
   BATTING_METRICS.every(key=>Object.hasOwn(stats,key)&&(stats[key]===null||stats[key]===0));
 });
}
function attrs(text){
 const result={};
 for(const m of text.matchAll(/\b([a-z][\w:-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)){
  const key=m[1].toLowerCase();if(Object.hasOwn(result,key))throw Error('Duplicate source attribute');result[key]=m[2]??m[3];
 }
 return result;
}
const hasClass=(a,name)=>(a.class||'').split(/\s+/).includes(name);
const blocks=(html,tag)=>[...html.matchAll(new RegExp(`<${tag}\\b([^>]*)>([\\s\\S]*?)<\\/${tag}>`,'gi'))].map(m=>({attrs:attrs(m[1]),body:m[2]}));
function selectedBlock(html,tag,predicate){
 const openings=[...html.matchAll(new RegExp(`<${tag}\\b([^>]*)>`,'gi'))].filter(m=>predicate(attrs(m[1])));
 if(openings.length!==1)throw Error('Missing or ambiguous source section');
 const opening=openings[0],tokens=new RegExp(`<\\/?${tag}\\b[^>]*>`,'gi');tokens.lastIndex=opening.index+opening[0].length;let depth=1;
 for(let m;m=tokens.exec(html);){depth+=/^<\//.test(m[0])?-1:/\/>$/.test(m[0])?0:1;if(!depth)return {attrs:attrs(opening[1]),body:html.slice(opening.index+opening[0].length,m.index)};}
 throw Error('Incomplete source section');
}
const byId=(html,tag,id)=>selectedBlock(html,tag,a=>a.id===id);
const oneClass=(html,tag,name)=>selectedBlock(html,tag,a=>hasClass(a,name));
function listedCard(card){
 const id=card.attrs.href?.match(/^(?:https:\/\/baseball\.yahoo\.co\.jp)?\/npb\/game\/(\d+)\/(?:index|score)$/)?.[1];
 const home=[...card.body.matchAll(/bb-score__homeLogo--npbTeam(\d+)\b/g)],away=[...card.body.matchAll(/bb-score__awayLogo--npbTeam(\d+)\b/g)];
 const row={id,homeId:home[0]?.[1],awayId:away[0]?.[1]};
 if(!gameId(id)||home.length!==1||away.length!==1||!teamsOk(row))throw Error('Invalid first-team score card');return row;
}
function calendarGame(row){
 const status=oneClass(row,'p','bb-scheduleTable__status'),links=blocks(status.body,'a');
 const id=links.length===1?links[0].attrs.href?.match(/^\/npb\/game\/(\d+)\/(?:index|score)$/)?.[1]:null;
 const side=name=>{const part=oneClass(row,'div',`bb-scheduleTable__${name}Name`),links=blocks(part.body,'a');return links.length===1?links[0].attrs.href?.match(/^\/npb\/teams\/(\d+)\/index$/)?.[1]:null;};
 const result={id,homeId:side('home'),awayId:side('away')};if(!gameId(id)||!teamsOk(result))throw Error('Invalid dated calendar fixture');return result;
}
// Extract only the JSON value assigned to Sportsnavi's tournament data variable.
// Bracket matching respects JSON strings; source JavaScript is never evaluated.
function tournamentData(html){
 const found=[];
 for(const script of blocks(html,'script'))for(const assignment of script.body.matchAll(/\b(?:var|let|const)\s+data\s*=\s*(?=\{)/g)){
  const start=assignment.index+assignment[0].length;let depth=0,quoted=false,escaped=false,end=-1;
  for(let i=start;i<script.body.length;i++){
   const c=script.body[i];if(quoted){if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c==='"')quoted=false;continue;}
   if(c==='"')quoted=true;else if(c==='{')depth++;else if(c==='}'&&!--depth){end=i+1;break;}
  }
  if(end<0||!/^\s*;/.test(script.body.slice(end)))continue;
  let data;try{data=JSON.parse(script.body.slice(start,end));}catch{continue;}
  if(data?.title==='CS・日本シリーズトーナメント表')found.push(data);
 }
 if(found.length!==1)throw Error('Missing or ambiguous tournament JSON');return found[0];
}
function completedSweeps(data,date){
 if(!data.array_list?.some(r=>r.note_text==='CSファーストステージは2戦先勝')||data.tournaments?.length!==1)return [];
 const content=data.tournaments[0]?.content;
 if(!content||content.rounds?.[0]?.text!=='CSファーストステージ'||content.rounds?.[1]?.text!=='CSファイナルステージ'||!Array.isArray(content.blocks)||!Array.isArray(content.section?.[1]))return [];
 const blocksById=new Map();
 for(const b of content.blocks){if(!Number.isInteger(b.id)||blocksById.has(b.id))return [];blocksById.set(b.id,b);}
 const sweeps=[];
 for(const series of content.section[1]){
  if(series.type!=='even'||series.family_count!==2||series.children?.length!==2||series.children[0]===series.children[1])continue;
  const [home,away]=series.children.map(id=>blocksById.get(id));
  const league=home?.sub_text?.match(/^(セ|パ)・リーグ2位$/)?.[1];if(!league||away?.sub_text!==league+'・リーグ3位')continue;
  const homeId=home.url?.match(/^https:\/\/baseball\.yahoo\.co\.jp\/npb\/teams\/(\d+)\/top$/)?.[1],awayId=away.url?.match(/^https:\/\/baseball\.yahoo\.co\.jp\/npb\/teams\/(\d+)\/top$/)?.[1];
  if(!teamsOk({homeId,awayId}))continue;
  const wins=[String(series.score_top),String(series.score_bottom)];
  const winner=wins[0]==='2'&&wins[1]==='0'?0:wins[0]==='0'&&wins[1]==='2'?1:-1;if(winner<0)continue;
  if(series.status!==(winner===0?'activeTop':'activeBottom')||[home,away][winner].flag!=='true'||[home,away][1-winner].flag!=='false')continue;
  const startDate=series.info_url?.match(/^https:\/\/baseball\.yahoo\.co\.jp\/npb\/schedule\/first\/cs\?date=(\d{4}-\d{2}-\d{2})$/)?.[1];
  if(!isDay(startDate)||startDate.slice(0,4)!==date.slice(0,4)||series.info_text!==`${Number(startDate.slice(5,7))}/${Number(startDate.slice(8,10))}～`)continue;
  // This proof only covers the ordinary third day of a two-win first stage.
  // Postponed/rescheduled games and every later playoff round remain untouched.
  const thirdGameDate=shift(startDate,2);if(thirdGameDate!==date)continue;
  sweeps.push({startDate,thirdGameDate,homeId,awayId,winnerId:[homeId,awayId][winner],eliminatedId:[homeId,awayId][1-winner],wins:wins.map(Number),sourceUrl:series.info_url});
 }
 const keys=sweeps.map(s=>s.homeId+':'+s.awayId);return new Set(keys).size===keys.length?sweeps:[];
}

/** A dated, complete first-team calendar plus its exact CS first-stage bracket.
 * Unknown or partial markup cannot authorize removing a previously seen game. */
export function npbScheduleProof(page,date,diagnostics){
 let stage='date';
 try{
  if(!isDay(date))return null;
  stage='source';
  if(page?.url!==scheduleUrl(date)||typeof page.text!=='string'||page.text.length>8000000||!Number.isFinite(Date.parse(page.fetchedAt)))return null;
  stage='canonical';
  const html=page.text,metas=[...html.matchAll(/<meta\b([^>]*)>/gi)].map(m=>attrs(m[1])).filter(a=>a.property==='og:url');
  if(metas.length!==1||metas[0].content!==page.url)return null;
  stage='heading';
  const [year,month,day]=date.split('-').map(Number),weekday='日月火水木金土'[new Date(date+'T00:00:00Z').getUTCDay()],label=`${month}月${day}日（${weekday}）`;
  const headings=blocks(html,'h2').filter(b=>hasClass(b.attrs,'bb-head01__title')&&/^\d+月\d+日[（(]/.test(plain(b.body)));
  if(headings.length!==1||plain(headings[0].body)!==label)return null;
  stage='menu';
  const menu=byId(html,'nav','sch_menu'),selected=blocks(menu.body,'li').filter(b=>hasClass(b.attrs,'bb-menuWhite__item--current'));
  if(selected.length!==1||blocks(selected[0].body,'a').length!==1||blocks(selected[0].body,'a')[0].attrs.href!=='/npb/schedule/first/all')return null;
  stage='navigation';
  const navigation=blocks(byId(html,'nav','day_nav').body,'a').map(a=>a.attrs.href);
  if(![-1,1].every(n=>navigation.includes(`/npb/schedule/first/all?date=${shift(date,n)}`)))return null;
  // An empty response is not an off day. Both the selected day's explicit
  // message and its dated weekly-calendar row must confirm no first-team games.
  if(npbScheduleIds(html).length===0){
   stage='offday';
   const messages=blocks(html,'p').filter(p=>hasClass(p.attrs,'bb-noData')&&plain(p.body)==='試合はありません');
   const calendar=byId(html,'table','wk_sche'),days=blocks(calendar.body,'tbody').filter(b=>blocks(b.body,'th').some(h=>hasClass(h.attrs,'bb-scheduleTable__head')&&plain(h.body)===label));
   if(messages.length!==1||days.length!==1)return null;
   const rows=blocks(days[0].body,'tr'),cells=blocks(days[0].body,'td'),heads=blocks(days[0].body,'th');
   if(rows.length!==1||heads.length!==1||cells.length!==1||!hasClass(cells[0].attrs,'bb-scheduleTable__data--nogame')||plain(cells[0].body)!=='試合はありません'||blocks(days[0].body,'a').length)return null;
   stage='verified';return {schemaVersion:1,kind:'npb-verified-offday',league:'NPB',date,noGames:true,listedGames:[],source:{provider:'sportsnavi',url:page.url,fetchedAt:page.fetchedAt}};
  }
  stage='cards';
  const listedGames=blocks(byId(html,'div','gm_card').body,'a').filter(a=>hasClass(a.attrs,'bb-score__content')).map(listedCard);
  if(!listedGames.length||listedGames.length>12||new Set(listedGames.map(g=>g.id)).size!==listedGames.length)return null;
  const collectorIds=npbScheduleIds(html);if(collectorIds.length!==listedGames.length||listedGames.some(g=>!collectorIds.includes(g.id)))return null;
  stage='calendar';
  const calendar=byId(html,'table','wk_sche'),days=blocks(calendar.body,'tbody').filter(b=>blocks(b.body,'th').some(h=>hasClass(h.attrs,'bb-scheduleTable__head')&&plain(h.body)===label));
  if(days.length!==1)return null;
  const rows=blocks(days[0].body,'tr').filter(r=>hasClass(r.attrs,'bb-scheduleTable__row')),heads=blocks(days[0].body,'th');
  if(heads.length!==1||Number(heads[0].attrs.rowspan)!==rows.length||!rows.length)return null;
  const calendarGames=rows.map(r=>calendarGame(r.body)),key=g=>`${g.id}:${g.homeId}:${g.awayId}`;
  if(calendarGames.length!==listedGames.length||new Set(calendarGames.map(key)).size!==calendarGames.length||calendarGames.some(g=>!listedGames.some(c=>key(c)===key(g))))return null;
  // The adjacent date links and canonical URL establish the year. Keep the
  // explicit check here so a malformed numeric date cannot become provenance.
  stage='date';
  if(year<2000||year>2100)return null;
  stage='tournament';
  const completedFirstStages=completedSweeps(tournamentData(html),date);
  const proof={schemaVersion:1,kind:KIND,league:'NPB',date,source:{provider:'sportsnavi',url:page.url,fetchedAt:page.fetchedAt},listedGames,completedFirstStages};
  stage='verified';return proof;
 }catch{return null;}
 finally{
  // Diagnostics contain only this bounded stage enum, never source HTML or
  // exception messages. A missing/frozen diagnostics target changes no result.
  if(diagnostics&&typeof diagnostics==='object'&&!Array.isArray(diagnostics))try{diagnostics.stage=stage;}catch{}
 }
}

export function isVerifiedNpbOffday(proof,date,now=Date.now()){
 const age=now-Date.parse(proof?.source?.fetchedAt);
 return isDay(date)&&proof?.schemaVersion===1&&proof.kind==='npb-verified-offday'&&proof.league==='NPB'&&proof.date===date&&proof.noGames===true&&Array.isArray(proof.listedGames)&&proof.listedGames.length===0&&proof.source?.provider==='sportsnavi'&&proof.source.url===scheduleUrl(date)&&Number.isFinite(age)&&age>=-60000&&age<=900000;
}

/** The existing retirement guards with a bounded explanation of the first
 * rejecting guard. Dynamic reason suffixes come only from fixed field lists. */
export function npbFixtureRetirementDecision(game,proof,now=Date.now()){
 const reject=reason=>({retired:false,reason});
 try{
  if(!game)return reject('fixture_missing');
  if(game.league!=='NPB')return reject('fixture_league');
  if(!gameId(game.id))return reject('fixture_id');
  if(game.key!==`NPB:${game.id}`)return reject('fixture_key');
  if(!isDay(game.date))return reject('fixture_date');
  if(!['pregame','unknown'].includes(game.status))return reject('fixture_status');
  if(!Number.isFinite(now))return reject('clock_invalid');
  if(dayInTaipei(new Date(now))!==game.date)return reject('fixture_day');
  if(proof?.schemaVersion!==1)return reject('proof_schema');
  if(proof.kind!==KIND)return reject('proof_kind');
  if(proof.league!=='NPB')return reject('proof_league');
  if(proof.date!==game.date)return reject('proof_date');
  if(proof.source?.provider!=='sportsnavi')return reject('proof_provider');
  if(proof.source.url!==scheduleUrl(game.date))return reject('proof_source_url');
  const at=Date.parse(proof.source.fetchedAt),previous=Date.parse(game.source?.fetchedAt),start=Date.parse(game.startTime);
  if(!Number.isFinite(at))return reject('proof_time_invalid');
  if(!Number.isFinite(previous))return reject('fixture_time_invalid');
  if(now-at< -60000)return reject('proof_time_future');
  if(now-at>900000)return reject('proof_time_stale');
  if(at<previous)return reject('proof_older_than_fixture');
  if(!Number.isFinite(start))return reject('fixture_start_invalid');
  if(new Date(start+9*3600000).toISOString().slice(0,10)!==game.date)return reject('fixture_start_date');
  if(!['score','top'].some(part=>game.source?.url===`${ORIGIN}/npb/game/${game.id}/${part}`))return reject('fixture_source_url');
  if(game.home?.score!==null)return reject('score_home_present');
  if(game.away?.score!==null)return reject('score_away_present');
  if(!teamsOk({homeId:game.home?.id,awayId:game.away?.id}))return reject('fixture_team_identity');
  if(game.liveStateObserved)return reject('observed_live_state');
  if(game.liveChangesVerified)return reject('verified_live_changes');
  for(const field of ['inning','half','balls','strikes','outs','bases','currentBatter','currentPitcher','currentAtBat'])if(game[field]!==null&&game[field]!==undefined)return reject('play_field:'+field);
  if(/試合終了|コールド|\d+回[表裏]|中断/.test(game.rawStatus||''))return reject('raw_status_played');
  if(game.status==='unknown'&&!/予告先発|スタメン|見どころ|試合前|開始前/.test(game.rawStatus||''))return reject('unknown_status_without_pregame_marker');
  for(const side of ['home','away']){
   if(game[side].hits!==null&&game[side].hits!==undefined)return reject('team_metric:'+side+':hits');
   if(game[side].errors!==null&&game[side].errors!==undefined)return reject('team_metric:'+side+':errors');
   for(const kind of ['innings','batting','pitching'])if(game[kind]){
    if(!Array.isArray(game[kind][side]))return reject('table_invalid:'+side+':'+kind);
    // Legacy /stats parsing could turn a colspan "合計" row into a player
    // with only zero/null batting totals. An explicit pregame observation made
    // before the verified start cannot make those empty totals evidence of play.
    if(game[kind][side].length&&!(kind==='batting'&&game.status==='pregame'&&previous<start&&emptyPregameBatting(game[kind][side])))return reject('table_nonempty:'+side+':'+kind);
   }
  }
  const listed=proof.listedGames;
  if(!Array.isArray(listed))return reject('proof_listed_games_missing');
  if(!listed.length)return reject('proof_listed_games_empty');
  if(listed.length>12)return reject('proof_listed_games_excessive');
  if(listed.some(g=>!gameId(g.id)||!teamsOk(g)))return reject('proof_listed_game_invalid');
  if(new Set(listed.map(g=>g.id)).size!==listed.length)return reject('proof_listed_game_duplicate');
  if(listed.some(g=>g.id===game.id))return reject('fixture_still_listed');
  // A reissued ID or reversed venue for this matchup contradicts a stale
  // tournament bracket. Keep the old record until its identity is reconciled.
  if(listed.some(g=>g.homeId===game.home.id&&g.awayId===game.away.id||g.homeId===game.away.id&&g.awayId===game.home.id))return reject('matchup_still_listed');
  if(!Array.isArray(proof.completedFirstStages))return reject('proof_series_missing');
  const series=proof.completedFirstStages.filter(s=>s.homeId===game.home.id&&s.awayId===game.away.id);
  if(!series.length)return reject('proof_series_no_match');
  if(series.length!==1)return reject('proof_series_ambiguous');const s=series[0];
  if(!isDay(s.startDate))return reject('series_start_invalid');
  if(s.startDate.slice(0,4)!==game.date.slice(0,4))return reject('series_year_conflict');
  if(shift(s.startDate,2)!==game.date)return reject('series_third_day_mismatch');
  if(s.thirdGameDate!==game.date)return reject('series_date_conflict');
  if(s.sourceUrl!==csUrl(s.startDate))return reject('series_source_url');
  const winner=Array.isArray(s.wins)&&s.wins.length===2?s.wins[0]===2&&s.wins[1]===0?0:s.wins[0]===0&&s.wins[1]===2?1:-1:-1;
  if(winner<0)return reject('series_not_sweep');
  if(s.winnerId!==[s.homeId,s.awayId][winner])return reject('series_winner_mismatch');
  if(s.eliminatedId!==[s.homeId,s.awayId][1-winner])return reject('series_eliminated_mismatch');
  return {retired:true,reason:'npb_first_stage_completed'};
 }catch{return reject('invalid_input');}
}

/** Remove only an unplayed, now-unneeded first-stage Game 3, never stale play. */
export function isRetiredNpbFixture(game,proof,now=Date.now()){
 return npbFixtureRetirementDecision(game,proof,now).retired;
}
