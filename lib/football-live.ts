import {footballDay,footballTeamName,parseFootballEvents,type FootballGame,type FootballLeague,type FootballTeam} from './football';
import {footballCommentaryNames,footballCommentaryText,type FootballCommentaryText} from './football-commentary';

export const FOOTBALL_VIEWS=[['overview','概覽'],['live','即時比分'],['analysis','賽前分析・串關'],['standings','戰績排名']] as const;
export type FootballView=typeof FOOTBALL_VIEWS[number][0];
export const isFootballView=(value:string|null):value is FootballView=>FOOTBALL_VIEWS.some(([key])=>key===value);
export const footballLogo=(id:string)=>/^\d+$/.test(id)?`https://a.espncdn.com/i/teamlogos/soccer/500/${id}.png`:'';
const clean=(value:unknown)=>typeof value==='string'?value.trim().slice(0,500):'';
const number=(value:unknown)=>value===null||value===undefined||value===''?null:Number.isFinite(Number(value))?Number(value):null;
const stat=(rows:any[],key:string)=>number(rows.find(s=>s.name===key)?.value??rows.find(s=>s.name===key)?.displayValue);
export type FootballLivePlayer={id:string;name:string;number:string;position:string;starter:boolean;photo:string;goals:number|null;assists:number|null;subbedIn:boolean;subbedOut:boolean};
export type FootballLiveEvent={id:string;type:string;label:string;clock:string;period:number;seconds:number;teamId:string|null;players:FootballLivePlayer[];text:string;sourceText?:string};
export type FootballDetail={game:FootballGame;fetchedAt:string;attendance:number|null;stats:{key:string;label:string;away:string;home:string}[];lineups:{team:FootballTeam;formation:string;players:FootballLivePlayer[]}[];events:FootballLiveEvent[];commentary:({id:string;clock:string}&FootballCommentaryText)[]};
const eventLabels:Record<string,string>={'kickoff':'比賽開始','goal':'進球','own-goal':'烏龍球','penalty---scored':'十二碼進球','penalty---missed':'十二碼未進','yellow-card':'黃牌','red-card':'紅牌','yellow-red-card':'兩黃一紅','substitution':'換人','halftime':'中場休息','half-time':'中場休息','start-2nd-half':'下半場開始','end-regular-time':'正規時間結束','end-match':'比賽結束','full-time':'比賽結束','start-delay':'比賽暫停','end-delay':'比賽恢復','var':'VAR 判決'};
const statLabels=[['possessionPct','控球率'],['totalShots','射門'],['shotsOnTarget','射正'],['wonCorners','角球'],['offsides','越位'],['foulsCommitted','犯規'],['yellowCards','黃牌'],['redCards','紅牌'],['saves','撲救'],['accuratePasses','成功傳球'],['totalPasses','傳球'],['blockedShots','封阻射門'],['interceptions','攔截']] as const;
export function parseFootballDetail(raw:any,expected:FootballGame,fetchedAt:string):FootballDetail{
 const h=raw?.header;if(h?.league?.slug!==expected.league||String(h.id)!==expected.id)throw Error('比賽明細聯賽或賽事不符');
 const game=parseFootballEvents({events:[h]},expected.league)[0];
 if(!game||game.home.id!==expected.home.id||game.away.id!==expected.away.id||game.start!==expected.start||footballDay(game.start)!==footballDay(expected.start))throw Error('比賽明細球隊或日期不符');
 game.venue=clean(raw.gameInfo?.venue?.fullName)||expected.venue;
 const player=(p:any,teamId:string):FootballLivePlayer=>{
  const a=p.athlete||p,id=String(a.id||'');
  return {id,name:clean(a.displayName||a.fullName)||'球員資料待更新',number:clean(p.jersey||a.jersey),position:({'G':'守門員','GK':'守門員','D':'後衛','M':'中場','F':'前鋒'} as Record<string,string>)[p.position?.abbreviation]||clean(p.position?.displayName),starter:p.starter===true,
   photo:/^\d{1,12}$/.test(id)?`/api/football-player-photo?player=${id}&league=${game.league}&team=${teamId}&season=${game.season}`:'',goals:stat(p.stats||[],'totalGoals'),assists:stat(p.stats||[],'goalAssists'),subbedIn:p.subbedIn===true,subbedOut:p.subbedOut===true};
 };
 const lineups:FootballDetail['lineups']=[game.away,game.home].map(team=>{
  const row=(raw.rosters||[]).find((r:any)=>String(r.team?.id)===team.id),seen=new Set<string>();
  return {team,formation:clean(row?.formation),players:(row?.roster||[]).map((p:any)=>player(p,team.id)).filter((p:FootballLivePlayer)=>{if(!/^\d{1,12}$/.test(p.id)||seen.has(p.id))return false;seen.add(p.id);return true;})};
 });
 const players=new Map(lineups.flatMap(t=>t.players.map(p=>[t.team.id+':'+p.id,p] as const))),teams=new Set([game.home.id,game.away.id]);
 const names:Record<string,string>={};
 for(const row of raw.rosters||[])for(const p of row.roster||[]){const a=p.athlete||p;for(const name of [a.displayName,a.fullName,a.shortName])if(clean(name))names[clean(name)]=clean(name);}
 for(const e of raw.keyEvents||[])for(const p of e.participants||[]){const a=p.athlete||p;for(const name of [a.displayName,a.fullName,a.shortName])if(clean(name))names[clean(name)]=clean(name);}
 for(const row of [...(h.competitions?.[0]?.competitors||[]),...(raw.boxscore?.teams||[]),...(raw.rosters||[])]){
  const t=row.team,team=[game.home,game.away].find(team=>team.id===String(t?.id));if(!team)continue;
  for(const alias of [team.englishName,t?.displayName,t?.shortDisplayName,t?.name,t?.abbreviation])if(clean(alias))names[clean(alias)]=team.name;
 }
 footballCommentaryNames([...(raw.commentary||[]),...(raw.keyEvents||[])].map(e=>typeof e.text==='string'?e.text:''),names,name=>names[name]||footballTeamName(name));
 const translate=(value:unknown)=>footballCommentaryText(typeof value==='string'?value.trim().slice(0,2000):'',names);
 const stats=statLabels.map(([key,label])=>{
  const display=(id:string)=>{const row=(raw.boxscore?.teams||[]).find((r:any)=>String(r.team?.id)===id),s=row?.statistics?.find((s:any)=>s.name===key),v=number(s?.displayValue??s?.value);return v===null?'—':String(v)+(key==='possessionPct'?'%':'');};
  return {key,label,away:display(game.away.id),home:display(game.home.id)};
 });
 const seen=new Set<string>(),events:FootballLiveEvent[]=(raw.keyEvents||[]).flatMap((e:any,i:number)=>{
  const id=String(e.id||i),teamId=teams.has(String(e.team?.id))?String(e.team.id):null,type=clean(e.type?.type),seconds=number(e.clock?.value)??0;
  if(seen.has(id))return [];seen.add(id);
  return [{id,type,label:eventLabels[type]||({'goal---header':'頭槌進球','goal---volley':'凌空射門進球','penalty---saved':'十二碼被撲出','start-extra-time':'延長賽開始','end-extra-time':'延長賽結束','penalty-shootout':'十二碼決勝'} as Record<string,string>)[type]||'賽事紀錄',clock:clean(e.clock?.displayValue)||'—',period:number(e.period?.number)??0,seconds,teamId,
   players:(e.participants||[]).map((p:any)=>players.get(teamId+':'+String(p.athlete?.id))||player(p,teamId||'')),...translate(e.text||e.shortText)}];
 }).sort((a:FootballLiveEvent,b:FootballLiveEvent)=>b.period-a.period||b.seconds-a.seconds||Number(b.id)-Number(a.id));
 const commentary=(raw.commentary||[]).map((e:any,i:number)=>({id:String(e.sequence??i),clock:clean(e.time?.displayValue)||'—',...translate(e.text)})).filter((e:any)=>e.text).reverse();
 return {game,fetchedAt,attendance:number(raw.gameInfo?.attendance),stats,lineups,events,commentary};
}

export type FootballStanding={team:FootballTeam;rank:number|null;games:number|null;wins:number|null;losses:number|null;draws:number|null;scored:number|null;conceded:number|null;difference:number|null;points:number|null;deductions:number|null;form:('W'|'D'|'L')[]|null};
export type FootballStandings={league:FootballLeague;season:number;seasonLabel:string;fetchedAt:string;groups:{id:string;name:string;phase:number|null;rows:FootballStanding[]}[]};
// ESPN standings identify competitions using their league UID instead of a slug.
const leagueIds:Record<FootballLeague,string>={'eng.1':'700','esp.1':'740','ita.1':'730','ger.1':'720','fra.1':'710','uefa.champions':'775','uefa.europa':'776','uefa.nations':'2395'};
export function parseFootballStandings(raw:any,league:FootballLeague,season:number,fetchedAt:string):FootballStandings{
 if(raw?.uid!==`s:600~l:${leagueIds[league]}`||Number(raw?.season?.year)!==season||!Array.isArray(raw.children))throw Error('排名來源聯賽或球季不符');
 const groups:FootballStandings['groups']=[];
 function walk(node:any){
  const entries=node.standings?.entries;
  if(Array.isArray(entries)){
   const seen=new Set<string>(),rows:FootballStanding[]=entries.map((e:any)=>{
    const id=String(e.team?.id||''),name=clean(e.team?.displayName);
    if(!/^\d+$/.test(id)||!name||seen.has(id))throw Error('排名球隊格式不符');seen.add(id);
    const s=(key:string)=>stat(e.stats||[],key);
    return {team:{id,name:footballTeamName(name),englishName:name},rank:s('rank'),games:s('gamesPlayed'),wins:s('wins'),losses:s('losses'),draws:s('ties'),scored:s('pointsFor'),conceded:s('pointsAgainst'),difference:s('pointDifferential'),points:s('points'),deductions:s('deductions'),form:null};
   });
   rows.sort((a,b)=>(b.points??-Infinity)-(a.points??-Infinity)||(a.rank??Infinity)-(b.rank??Infinity));
   groups.push({id:String(node.id||groups.length),name:clean(node.name)==='League Phase'?'聯賽階段':clean(node.name).replace(/^Group /,'分組 '),phase:number(node.standings.seasonType?.id),rows});
  }
  for(const child of node.children||[])walk(child);
 }
 walk(raw);return {league,season,seasonLabel:clean(raw.season.displayName),fetchedAt,groups};
}
export function attachFootballStandingForm(table:FootballStandings,sources:any[],now=Date.now()){
 const events=sources.flatMap(s=>s.events||[]),raw=new Map(events.map(e=>[String(e.id),e]));
 const games=parseFootballEvents({events:[...raw.values()]},table.league).filter(g=>g.season===table.season&&g.state==='final'&&g.homeScore!==null&&g.awayScore!==null&&Date.parse(g.start)<=now).sort((a,b)=>Date.parse(b.start)-Date.parse(a.start));
 return {...table,groups:table.groups.map(group=>({...group,rows:group.rows.map(row=>({...row,form:games.filter(g=>g.home.id===row.team.id||g.away.id===row.team.id).slice(0,5).reverse().map(g=>{const own=g.home.id===row.team.id?g.homeScore!:g.awayScore!,other=g.home.id===row.team.id?g.awayScore!:g.homeScore!;return own>other?'W' as const:own<other?'L' as const:'D' as const;})}))}))};
}
