import {fetchPublic,yahooObjects,parseCpbl,dayInTaipei} from './baseball-live-providers.mjs';

const teams={'cpbl.t.1':'中信','cpbl.t.2':'統一','cpbl.t.5':'富邦','cpbl.t.6':'樂天','cpbl.t.7':'味全','cpbl.t.8':'台鋼'};
const states=new Set(['PREGAME','IN_PROGRESS','FINAL','POSTPONED','CANCELLED','SUSPENDED']);
const validUrl=url=>{try{const u=new URL(url);return u.protocol==='https:'&&u.hostname==='tw.sports.yahoo.com'&&/^\/cpbl\/[^/]+-\d{9}\/$/.test(u.pathname);}catch{return false;}};

export function parseCpblCurrent(raw,page){
 const g=parseCpbl(raw,page);
 // Yahoo's isStarter flag is also true for relief pitchers. Accept only an
 // explicit first pitcher in the matching pregame lineup, never a prior game.
 if(g.status==='pregame'&&Date.parse(page.fetchedAt)<Date.parse(g.startTime)){
  for(const side of ['away','home']){
   const pitchers=(raw[side+'TeamLineup']||[]).filter(p=>p.positionId==='PITCHER'&&p.order===1&&/^cpbl\.p\.\d+$/.test(p.player?.playerId)&&p.player?.displayName);
   if(pitchers.length===1)g.starters[side]={id:pitchers[0].player.playerId,name:pitchers[0].player.displayName,confirmation:'source_listed_probable',source:g.source};
  }
 }
 return g;
}

// An empty HTML page is not proof of an off day. All six team schedules must
// contain this season's valid fixtures on both sides of the requested date.
export function inspectCpblSchedule(pages,date){
 const fixtures=new Map(),coverage=[];
 for(const {teamId,page} of pages){
  if(!teams[teamId]||coverage.some(c=>c.teamId===teamId))throw Error('中職球隊賽程身分重複或不符');
  const rows=yahooObjects(page.text).filter(x=>x.seasonPhase==='REGULAR_SEASON'&&
   (x.homeTeamId===teamId||x.awayTeamId===teamId)&&x.startTime?.startsWith(date.slice(0,4)+'-'));
  if(!rows.length)throw Error('中職球隊頁沒有可核對的本季賽程');
  const days=[];
  for(const raw of rows){
   if(!/^cpbl\.g\.\d{9}$/.test(raw.gameId)||!teams[raw.homeTeamId]||!teams[raw.awayTeamId]||raw.homeTeamId===raw.awayTeamId||!states.has(raw.status)||!validUrl(raw.alias?.url)||!Number.isFinite(Date.parse(raw.startTime)))throw Error('中職賽程欄位不完整');
   const day=dayInTaipei(new Date(raw.startTime));
   if(raw.gameId.slice(7,13)!==day.replaceAll('-','').slice(2))throw Error('中職賽程日期與場次不符');
   days.push(day);
   const old=fixtures.get(raw.gameId);
   if(old&&(old.raw.homeTeamId!==raw.homeTeamId||old.raw.awayTeamId!==raw.awayTeamId||old.raw.startTime!==raw.startTime))throw Error('中職球隊頁對戰資料衝突');
   if(!old||page.fetchedAt>old.page.fetchedAt)fixtures.set(raw.gameId,{raw,page,day});
  }
  coverage.push({teamId,url:page.url,fetchedAt:page.fetchedAt,from:days.sort()[0],through:days.at(-1)});
 }
 const matches=[...fixtures.values()].filter(x=>x.day===date);
 const complete=coverage.length===6&&coverage.every(c=>c.from<=date&&c.through>=date);
 const nextDate=[...fixtures.values()].filter(x=>x.day>date&&x.raw.status==='PREGAME').map(x=>x.day).sort()[0]||null;
 return {matches,nextDate,proof:complete?{date,teams:coverage,listedGames:matches.length}:null};
}

export async function collectCpblCurrent({date=dayInTaipei(),fetcher=fetch}={}){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw Error('Invalid CPBL date');
 const errors=[],pages=[];
 await Promise.all(Object.entries(teams).map(async([teamId,name])=>{
  try{pages.push({teamId,page:await fetchPublic('https://tw.sports.yahoo.com/cpbl/teams/'+encodeURIComponent(name)+'/',fetcher)});}
  catch(e){errors.push(`${name}：${e.message}`);}
 }));
 const schedule=inspectCpblSchedule(pages,date),games=[];
 if(!schedule.matches.length&&(!schedule.proof||errors.length))throw Error('中職日期賽程尚未完整核對');
 await Promise.all(schedule.matches.map(async({raw,page})=>{
  try{
   const detail=await fetchPublic(raw.alias.url,fetcher);
   const rows=yahooObjects(detail.text).filter(x=>x.gameId===raw.gameId&&x.homeTeamId===raw.homeTeamId&&x.awayTeamId===raw.awayTeamId&&x.startTime===raw.startTime&&(x.playerStats||x.status==='PREGAME'));
   if(rows.length){games.push(parseCpblCurrent(rows.at(-1),detail));return;}
   if(raw.status!=='PREGAME')throw Error('中職單場投打資料尚未取得');
   // A published schedule remains useful before a pregame box score exists.
   const g=parseCpblCurrent(raw,page);g.warnings.push('pregame_detail_not_published');games.push(g);
  }catch(e){
   errors.push(`${raw.gameId}：${e.message}`);
   if(raw.status==='PREGAME')games.push(parseCpblCurrent(raw,page));
  }
 }));
 return {schemaVersion:1,league:'CPBL',date,collectedAt:new Date().toISOString(),games,
  errors,status:errors.length?'partial':'ok',liveLatencyVerified:false,
  scheduleProof:schedule.proof,nextGameDate:schedule.nextDate};
}
