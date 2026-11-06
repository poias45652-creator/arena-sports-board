import {nbaPage,BasketballSourceUnavailable} from './wnba-fetch';
import {playerSource} from './sport-player-fetch';
import {verifiedBasketballIdentity} from './sport-player-profile';
import {NBA_TEAMS,nbaTeam} from './nba';
import {nbaPlayerSupplement,type NbaCollegeStats} from './nba-player-supplements';
// NBA.com uses different team identifiers from the scoreboard provider.
const OFFICIAL:Record<string,[number,string]> = {"SAC":[1610612758,"kings"],"HOU":[1610612745,"rockets"],"MIA":[1610612748,"heat"],"NYK":[1610612752,"knicks"],"CLE":[1610612739,"cavaliers"],"UTA":[1610612762,"jazz"],"CHA":[1610612766,"hornets"],"DAL":[1610612742,"mavericks"],"ATL":[1610612737,"hawks"],"MIL":[1610612749,"bucks"],"TOR":[1610612761,"raptors"],"POR":[1610612757,"blazers"],"CHI":[1610612741,"bulls"],"WAS":[1610612764,"wizards"],"DEN":[1610612743,"nuggets"],"MIN":[1610612750,"timberwolves"],"ORL":[1610612753,"magic"],"PHI":[1610612755,"sixers"],"SAS":[1610612759,"spurs"],"OKC":[1610612760,"thunder"],"GSW":[1610612744,"warriors"],"LAC":[1610612746,"clippers"],"NOP":[1610612740,"pelicans"],"BKN":[1610612751,"nets"],"PHX":[1610612756,"suns"],"MEM":[1610612763,"grizzlies"],"IND":[1610612754,"pacers"],"LAL":[1610612747,"lakers"],"BOS":[1610612738,"celtics"],"DET":[1610612765,"pistons"]};
const aliases:Record<string,string>={GS:'GSW',NO:'NOP',NY:'NYK',SA:'SAS',UTAH:'UTA',WSH:'WAS'};
export function officialTeam(id:string){const team=nbaTeam(id);return team?OFFICIAL[aliases[team.code]||team.code]:undefined;}
export function localTeam(id:number){return NBA_TEAMS.find(t=>officialTeam(t.id)?.[0]===id)||null;}
const num=(v:unknown):number|null=>typeof v==='number'&&Number.isFinite(v)?v:null;
const str=(v:unknown)=>typeof v==='string'?v:'';
const bioText=(v:unknown)=>str(v).trim()==='-'?'':str(v).trim();
function rosterBirthDate(value:unknown){
 const date=bioText(value);
 if(!/^[A-Z]{3} \d{1,2}, \d{4}$/i.test(date))return '';
 const ms=Date.parse(date+' 00:00:00 GMT');
 return Number.isFinite(ms)?new Date(ms).toISOString().slice(0,10):'';
}
const person=(r:any)=>({id:Number(r.PLAYER_ID),name:str(r.PLAYER),slug:str(r.PLAYER_SLUG),birthDate:rosterBirthDate(r.BIRTH_DATE),seasonStatsEmpty:false,number:str(r.NUM),position:str(r.POSITION),height:str(r.HEIGHT),weight:str(r.WEIGHT),experience:str(r.EXP),school:str(r.SCHOOL),season:str(r.SEASON),photo:undefined as string|undefined,photoFallback:undefined as string|undefined,href:undefined as string|undefined,country:undefined as string|undefined,draftYear:undefined as string|undefined,supplementalStats:undefined as NbaCollegeStats|undefined,averages:undefined as {season:number;points:number|null;rebounds:number|null;assists:number|null}|null|undefined});
export function parseOfficialTeam(data:any,id:string){
 const t=data?.props?.pageProps?.team,expected=officialTeam(id)?.[0];
 if(!expected||Number(t?.id)!==expected||Number(t?.info?.TEAM_ID)!==expected||!Array.isArray(t.roster))throw Error('NBA 球隊資料不符');
 const roster:ReturnType<typeof person>[]=t.roster.map((r:any)=>{if(Number(r.TeamID)!==expected||!Number.isSafeInteger(Number(r.PLAYER_ID))||Number(r.PLAYER_ID)<=0||!r.PLAYER)throw Error('NBA 球員名單不符');return person(r);});
 const b=t.background||{},r=t.ranks||{},info=t.info;
 return {team:nbaTeam(id)!,officialId:expected,season:str(info.SEASON_YEAR),rosterSeason:roster[0]?.season||'',roster,
  record:{wins:num(info.W),losses:num(info.L),conferenceRank:num(info.CONF_RANK),divisionRank:num(info.DIV_RANK)},
  ranks:{points:num(r.PTS_PG),pointsRank:num(r.PTS_RANK),rebounds:num(r.REB_PG),reboundsRank:num(r.REB_RANK),assists:num(r.AST_PG),assistsRank:num(r.AST_RANK),opponentPoints:num(r.OPP_PTS_PG),defenseRank:num(r.OPP_PTS_RANK)},
  background:{arena:str(b.ARENA),coach:str(b.HEADCOACH),manager:str(b.GENERALMANAGER),founded:num(b.YEARFOUNDED),conference:str(info.TEAM_CONFERENCE),division:str(info.TEAM_DIVISION)},
  championships:Array.isArray(t.awards?.champ)?t.awards.champ.map((a:any)=>str(a.YEARAWARDED)||String(a.YEARAWARDED||'')).filter(Boolean):[],
  sourceUrl:`https://www.nba.com/team/${expected}/${officialTeam(id)![1]}`};
}
export function parseOfficialPlayer(data:any,id:number){
 const p=data?.props?.pageProps?.player,i=p?.info,s=p?.stats;
 if(Number(i?.PERSON_ID)!==id||!i.DISPLAY_FIRST_LAST)throw Error('NBA 球員資料不符');
 const logs:any[]=Array.isArray(p.gameLogs)?p.gameLogs:[];
 if(logs.some((g:any)=>Number(g.Player_ID)!==id))throw Error('NBA 球員紀錄不符');
 const validStats=s&&Number(s.PLAYER_ID)===id;
 const supplement=nbaPlayerSupplement(id,str(i.DISPLAY_FIRST_LAST));
 return {id,name:str(i.DISPLAY_FIRST_LAST),team:localTeam(Number(i.TEAM_ID)),position:bioText(i.POSITION)||supplement?.bio.position||'',number:str(i.JERSEY),height:bioText(i.HEIGHT)||supplement?.bio.height||'',weight:bioText(i.WEIGHT)||supplement?.bio.weight||'',birthDate:str(i.BIRTHDATE).slice(0,10),country:bioText(i.COUNTRY)||supplement?.bio.country||'',school:bioText(i.SCHOOL)||supplement?.bio.school||'',experience:num(i.SEASON_EXP),draft:{year:str(i.DRAFT_YEAR),round:str(i.DRAFT_ROUND),pick:str(i.DRAFT_NUMBER)},
  photo:supplement?.photo.path||`https://cdn.nba.com/headshots/nba/latest/1040x760/${id}.png`,photoFallback:supplement?.photo.path?`https://cdn.nba.com/headshots/nba/latest/1040x760/${id}.png`:undefined,supplement,
  stats:{season:validStats?str(s.TimeFrame):'',points:validStats?num(s.PTS):null,rebounds:validStats?num(s.REB):null,assists:validStats?num(s.AST):null},
  games:logs.filter((g:any)=>g.GAME_STATUS===3).map((g:any)=>({id:str(g.Game_ID),season:str(g.SEASON_ID),date:str(g.GAME_DATE),matchup:str(g.MATCHUP),result:str(g.WL),minutes:num(g.MIN),points:num(g.PTS),rebounds:num(g.REB),assists:num(g.AST),steals:num(g.STL),blocks:num(g.BLK),turnovers:num(g.TOV),fieldGoals:num(g.FG_PCT),threes:num(g.FG3_PCT),freeThrows:num(g.FT_PCT),plusMinus:num(g.PLUS_MINUS)})),
  awards:Array.isArray(p.awards)?p.awards.map((a:any)=>({name:str(a.name),count:num(a.count)})):[],
  sourceUrl:`https://www.nba.com/player/${id}/${str(i.PLAYER_SLUG)}`};
}
export type OfficialTeam=ReturnType<typeof parseOfficialTeam>;
export type OfficialPlayer=ReturnType<typeof parseOfficialPlayer>;
const cache=new Map<string,{data:any;until:number}>(),pending=new Map<string,Promise<any>>();
let active=0;const queue:(()=>void)[]=[];

async function page(path:string,deadline=Infinity){
 const hit=cache.get(path);if(hit&&hit.until>Date.now())return hit.data;
 if(pending.has(path))return pending.get(path)!;
 if(queue.length>64)throw Error('NBA 資料忙碌中');
 const task=(async()=>{
  if(active>=4)await new Promise<void>(r=>queue.push(r));else active++;
  try{
   if(Date.now()>=deadline)throw new BasketballSourceUnavailable('NBA 球員資料更新逾時',false);
   const html=await nbaPage(`https://www.nba.com/${path}`,Math.min(Number.isFinite(deadline)?7000:15000,Math.max(1,deadline-Date.now())));
   const match=html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
   if(!match)throw new BasketballSourceUnavailable('NBA 官網資料缺漏',false);
   const data=JSON.parse(match[1]);if(cache.size>=160)cache.delete(cache.keys().next().value!);cache.set(path,{data,until:Date.now()+15*60000});return data;
  }finally{const next=queue.shift();if(next)next();else active--;}
 })().finally(()=>pending.delete(path));pending.set(path,task);return task;
}
async function nbaTeamRoster(id:string){
 const t=officialTeam(id);
 if(!t)throw Error('球隊不存在');
 return parseOfficialTeam(await page(`team/${t[0]}/${t[1]}`),id);
}

async function teamSeasonAverages(teamId:string,year:number){
 const root=`https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/${teamId}`;
 const [directory,stats]=await Promise.all([
  playerSource(root+'/roster'),
  playerSource(`${root}/athletes/statistics?season=${year}&seasontype=2`),
 ]);
 const leaders=stats.results?.find((r:any)=>r.name==='game')?.leaders;
 if(String(directory.team?.id)!==teamId||directory.season?.year!==year||!Array.isArray(directory.athletes)||
    String(stats.team?.id)!==teamId||stats.season?.year!==year||stats.season?.type!==2||!Array.isArray(leaders))throw Error('球隊場均資料不符');
 return {athletes:directory.athletes as any[],leaders:leaders as any[]};
}

type TeamSeasonStats=Awaited<ReturnType<typeof teamSeasonAverages>>;
function rosterAverages(player:ReturnType<typeof person>,stats:TeamSeasonStats|null,year:number){
 if(!stats||Number(player.season)+1!==year)return null;
 const people=stats.athletes.filter(a=>verifiedBasketballIdentity(a,player));
 if(people.length!==1)return null;
 const id=String(people[0].id),uid=`s:40~l:46~a:${id}`;
 if(people[0].uid!==uid)return null;
 const matches=stats.leaders.filter(r=>String(r.athlete?.id)===id&&r.athlete?.uid===uid);
 if(!matches.length)return {empty:true as const};
 if(matches.length!==1)return null;
 if(!Array.isArray(matches[0].statistics))return null;
 const values=matches[0].statistics.flatMap((g:any)=>Array.isArray(g?.stats)?g.stats:[]);
 const value=(key:string)=>num(values.find((s:any)=>s?.name===key)?.value);
 const games=value('gamesPlayed');
 if(games===0)return {empty:true as const};
 if(games===null||games<0)return null;
 const average=(key:string)=>{const n=value(key);return n===null?null:Math.round(n*10)/10;};
 const points=average('avgPoints'),rebounds=average('avgRebounds'),assists=average('avgAssists');
 if([points,rebounds,assists].every(v=>v===null))return null;
 return {averages:{season:year,points,rebounds,assists}};
}

export async function officialTeamProfile(id:string){
 const index=page('players',Date.now()+6000).catch(()=>null);
 const value=await nbaTeamRoster(id),year=Number(value.rosterSeason)+1;
 const stats=Number.isInteger(year)&&year>=1947?await teamSeasonAverages(id,year).catch(()=>null):null;
 const roster=enrichNbaRoster(value.roster,value.officialId,await index).map(p=>{
  const line=rosterAverages(p,stats,year);
  return {...p,averages:line?.averages??p.averages,seasonStatsEmpty:!!line?.empty};
 });
 return {...value,roster,fetchedAt:new Date().toISOString()};
}

export async function nbaRosterPlayer(teamId:string,id:number){
 const team=await officialTeamProfile(teamId);
 const matches=team.roster.filter(p=>p.id===id);
 if(matches.length!==1)throw Error('名單沒有相符的球員');
 return {...matches[0],team:team.team,sourceUrl:team.sourceUrl};
}

export async function nbaPlayerById(id:number){
 if(!Number.isSafeInteger(id)||id<=0)throw Error('球員編號錯誤');
 const raw=await page(`player/${id}`,Date.now()+6000);
 return {...parseOfficialPlayer(raw,id),fetchedAt:new Date().toISOString()};
}

export async function officialPlayerProfile(id:number){
 if(!Number.isSafeInteger(id)||id<=0)return null;
 // Older upstreams can still require the canonical slug.
 try{return await nbaPlayerById(id);}catch{
  const index=await page('players',Date.now()+6000),players=index?.props?.pageProps?.players;
  if(!Array.isArray(players))throw Error('NBA 球員索引錯誤');
  const p=players.find((p:any)=>Number(p.PERSON_ID)===id);
  if(!p||!/^[-a-z0-9]+$/.test(p.PLAYER_SLUG))return null;
  return {...parseOfficialPlayer(await page(`player/${id}/${p.PLAYER_SLUG}`,Date.now()+6000),id),fetchedAt:new Date().toISOString()};
 }
}

// Preserve the publication time and NBA identity for availability evidence.
// Team fantasyNews is truncated, so the analysis also reads each rotation
// player's current page rather than interpreting an omitted name as healthy.
export async function officialAnalysisTeam(id:string){
 const t=officialTeam(id);if(!t)throw Error('球隊不存在');
 const raw=await page(`team/${t[0]}/${t[1]}`),profile=parseOfficialTeam(raw,id);
 return {...profile,englishNames:[String(raw.props.pageProps.team.info.TEAM_CITY||''),String(raw.props.pageProps.team.info.TEAM_NAME||'')],news:raw.props.pageProps.team.fantasyNews||[],fetchedAt:new Date().toISOString()};
}
export async function officialAnalysisPlayer(id:number,deadline=Infinity){
 const index=await page('players',deadline),players=index?.props?.pageProps?.players;
 if(!Array.isArray(players))throw Error('NBA 球員索引錯誤');
 const p=players.find((p:any)=>Number(p.PERSON_ID)===id);if(!p||!/^[-a-z0-9]+$/.test(p.PLAYER_SLUG))throw Error('NBA 球員索引缺少現役球員');
 const raw=await page(`player/${id}/${p.PLAYER_SLUG}`,deadline),profile=parseOfficialPlayer(raw,id);
 return {...profile,news:raw.props.pageProps.player.latestNews||[],fetchedAt:new Date().toISOString()};
}

export function enrichNbaRoster(roster:ReturnType<typeof person>[],teamId:number,data:any){
 const rows=data?.props?.pageProps?.players;
 return roster.map(p=>{
  const matches=Array.isArray(rows)?rows.filter((r:any)=>Number(r.PERSON_ID)===p.id&&Number(r.TEAM_ID)===teamId):[];
  const row=matches.length===1?matches[0]:null;
  const clean=(v:unknown)=>typeof v==='string'&&v.trim()!=='-'?v.trim():'';
  const supplement=nbaPlayerSupplement(p.id,p.name);
  const season=Number(String(p.season||'').slice(0,4));
  const seasonStats=row?.STATS_TIMEFRAME==='Season'&&Number(row.TO_YEAR)===season&&Number.isInteger(season)&&season>=1946;
  const averages=seasonStats&&[row.PTS,row.REB,row.AST].some(v=>typeof v==='number'&&Number.isFinite(v))?{season:season+1,points:num(row.PTS),rebounds:num(row.REB),assists:num(row.AST)}:undefined;
  return {...p,photo:supplement?.photo.path||`https://cdn.nba.com/headshots/nba/latest/1040x760/${p.id}.png`,photoFallback:supplement?.photo.path?`https://cdn.nba.com/headshots/nba/latest/1040x760/${p.id}.png`:undefined,supplementalStats:supplement?.collegeStats??undefined,
   averages,
   height:clean(p.height)||clean(row?.HEIGHT)||supplement?.bio.height||'',weight:clean(p.weight)||clean(row?.WEIGHT)||supplement?.bio.weight||'',school:clean(p.school)||clean(row?.COLLEGE)||supplement?.bio.school||'',
   country:clean(row?.COUNTRY)||supplement?.bio.country||'',draftYear:row?.DRAFT_YEAR?String(row.DRAFT_YEAR):'',
   position:clean(p.position)||clean(row?.POSITION)||supplement?.bio.position||'',number:p.number||clean(row?.JERSEY_NUMBER)};
 });
}
