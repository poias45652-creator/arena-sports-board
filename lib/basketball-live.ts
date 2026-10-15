import {nbaFixtureKey,parseNbaEvents,type NbaGame,type NbaTeam,nbaTeam} from './nba';
import {parseWnbaEvents,wnbaTeam} from './wnba';
export type BasketballLeague='NBA'|'WNBA';
export type BoxPlayer={id:string;name:string;photo:string;jersey:string;position:string;starter:boolean;didNotPlay:boolean;stats:Record<string,string>};
export type BoxTeam={team:NbaTeam;players:BoxPlayer[];stats:Record<string,string>};
export type BasketballPlay={id:string;sequence:number;period:number;clock:string;text:string;teamId:string|null;playerIds:string[];homeScore:number|null;awayScore:number|null;scoring:boolean};
export type BasketballDetail={league:BasketballLeague;game:NbaGame;teams:BoxTeam[];plays:BasketballPlay[];venue:string;fetchedAt:string};
const text=(v:unknown,max=200)=>typeof v==='string'?v.slice(0,max):'';
const score=(v:unknown)=>v!==null&&v!==undefined&&v!==''&&Number.isInteger(Number(v))&&Number(v)>=0&&Number(v)<=300?Number(v):null;
export const playClockSeconds=(clock:string)=>/^\d{1,2}:\d{2}(?:\.\d+)?$/.test(clock)?Number(clock.split(':')[0])*60+Number(clock.split(':')[1]):/^\d{1,2}(?:\.\d+)?$/.test(clock)?Number(clock):Infinity;
const leagueId=(league:BasketballLeague)=>league==='NBA'?'46':'59';
const teamFor=(league:BasketballLeague,id:string)=>league==='NBA'?nbaTeam(id):wnbaTeam(id);
function photo(value:unknown,league:BasketballLeague,id:string){
 try{const u=new URL(String(value));return u.protocol==='https:'&&u.hostname==='a.espncdn.com'&&u.pathname===`/i/headshots/${league.toLowerCase()}/players/full/${id}.png`?u.href:'';}catch{return '';}
}
export function parseBasketballDetail(raw:any,expected:NbaGame,league:BasketballLeague,fetchedAt=new Date().toISOString()):BasketballDetail{
 const header=raw?.header,c=header?.competitions?.[0],lid=leagueId(league);
 if(String(header?.id)!==expected.id||header.uid!==`s:40~l:${lid}~e:${expected.id}`||String(c?.id)!==expected.id)throw Error('比賽明細來源不符');
 const competitors=(c.competitors||[]).map((r:any)=>({...r,linescores:(r.linescores||[]).map((q:any,i:number)=>({...q,period:q.period??i+1,value:q.value??score(q.displayValue)}))}));
 const period=c.status?.period??Math.max(0,...competitors.map((r:any)=>r.linescores.length),...((raw.plays||[]) as any[]).map(p=>Number(p.period?.number)||0));
 const event={...header,date:c.date,competitions:[{...c,competitors,status:{...c.status,period,displayClock:c.status?.displayClock||expected.clock}}]};
 const game=(league==='NBA'?parseNbaEvents:parseWnbaEvents)({leagues:[{slug:league.toLowerCase(),id:lid}],events:[event]})[0];
 if(!game||nbaFixtureKey(game)!==nbaFixtureKey(expected))throw Error('比賽球隊或日期不符');
 const allowed=new Set([game.away.id,game.home.id]),seen=new Set<string>();
 const teams:BoxTeam[]=(raw.boxscore?.players||[]).map((row:any)=>{
  const id=String(row.team?.id);if(!allowed.has(id)||seen.has(id)||row.team?.uid&&row.team.uid!==`s:40~l:${lid}~t:${id}`)throw Error('球員數據球隊不符');seen.add(id);
  const players=new Map<string,BoxPlayer>();
  for(const group of row.statistics||[]){
   const keys=group.keys||group.names||group.labels||[];
   for(const r of group.athletes||[]){const a=r.athlete,id=String(a?.id);if(!/^\d{1,12}$/.test(id)||!a.displayName)continue;
    if(a.uid&&a.uid!==`s:40~l:${lid}~a:${id}`)throw Error('球員聯盟不符');
    const stats:Record<string,string>={};keys.forEach((k:string,i:number)=>{const v=r.stats?.[i];if(v!==undefined&&v!==null)stats[k]=text(String(v),30);});
    players.set(id,{id,name:text(a.displayName),photo:photo(a.headshot?.href,league,id),jersey:text(a.jersey,5),position:text(a.position?.abbreviation,10),starter:r.starter===true,didNotPlay:r.didNotPlay===true,stats});
   }
  }
  return {team:teamFor(league,id)!,players:[...players.values()],stats:{}};
 });
 for(const row of raw.boxscore?.teams||[]){const id=String(row.team?.id);if(!allowed.has(id))throw Error('球隊統計來源不符');let t=teams.find(t=>t.team.id===id);if(!t){t={team:teamFor(league,id)!,players:[],stats:{}};teams.push(t);}for(const s of row.statistics||[])if(s.name&&s.displayValue!==undefined)t.stats[s.name]=text(String(s.displayValue),30);}
 const plays=new Map<string,BasketballPlay>();
 for(const p of raw.plays||[]){const id=text(p.id,50),period=Number(p.period?.number),teamId=p.team?.id?String(p.team.id):null;
  if(!id||!Number.isInteger(period)||period<1||period>20||teamId&&!allowed.has(teamId))continue;
  const sequence=Number(p.sequenceNumber);if(!Number.isFinite(sequence))continue;
  plays.set(id,{id,sequence,period,clock:text(p.clock?.displayValue,15),text:text(p.text,1000)||text(p.type?.text),teamId,playerIds:(p.participants||[]).map((a:any)=>String(a.athlete?.id||'')).filter((id:string)=>/^\d+$/.test(id)),homeScore:score(p.homeScore),awayScore:score(p.awayScore),scoring:p.scoringPlay===true});
 }
 return {league,game,teams,plays:[...plays.values()].sort((a,b)=>b.period-a.period||playClockSeconds(a.clock)-playClockSeconds(b.clock)||b.sequence-a.sequence),venue:text(raw.gameInfo?.venue?.fullName),fetchedAt};
}
export type StandingRow={team:NbaTeam;rank:number|null;wins:number;losses:number;pct:number|null;behind:string;home:string;away:string;lastTen:string;streak:string;points:string;against:string;diff:string};
export type BasketballTable={league:BasketballLeague;season:number;seasonLabel:string;phase:number;groups:{id:string;name:string;rows:StandingRow[]}[];fetchedAt:string};
export function parseBasketballStandings(raw:any,league:BasketballLeague,season:number,phase:number,fetchedAt=new Date().toISOString()):BasketballTable{
 if(!String(raw?.uid||'').startsWith(`s:40~l:${leagueId(league)}~g:`)||Number(raw.season?.year)!==season||!Array.isArray(raw.children))throw Error('排名聯盟或球季不符');
 const seen=new Set<string>();
 const groups=raw.children.map((g:any)=>{
  const s=g.standings;if(!s||Number(s.seasonType)!==phase||!Array.isArray(s.entries))throw Error('排名賽季類別不符');
  const rows:StandingRow[]=s.entries.map((r:any)=>{
   const team=teamFor(league,String(r.team?.id));if(!team||seen.has(team.id)||r.team.uid!==`s:40~l:${leagueId(league)}~t:${team.id}`)throw Error('排名球隊不符');seen.add(team.id);
   const stat=(key:string)=>r.stats?.find((s:any)=>s.name===key||s.type===key);
   const count=(key:string)=>{const n=stat(key)?.value;if(typeof n!=='number'||!Number.isInteger(n)||n<0)throw Error('排名戰績不完整');return n;};
   const display=(key:string)=>text(stat(key)?.displayValue,30)||'—';
   const wins=count('wins'),losses=count('losses'),seed=stat('playoffSeed')?.value;
   return {team,rank:Number.isInteger(seed)&&seed>0?seed:null,wins,losses,pct:wins+losses?wins/(wins+losses):null,behind:display('gamesBehind'),home:display('home'),away:display('road'),lastTen:display('lasttengames'),streak:display('streak').replace(/^W(\d+)$/,'$1 連勝').replace(/^L(\d+)$/,'$1 連敗'),points:wins+losses?display('avgPointsFor'):'—',against:wins+losses?display('avgPointsAgainst'):'—',diff:wins+losses?display('differential'):'—'};
  }).sort((a:StandingRow,b:StandingRow)=>(b.pct??-1)-(a.pct??-1)||(a.rank??99)-(b.rank??99)||a.team.name.localeCompare(b.team.name));
  return {id:String(g.id),name:/Eastern/i.test(g.name)?'東區':/Western/i.test(g.name)?'西區':text(g.name),rows};
 });
 return {league,season,seasonLabel:text(raw.season.displayName),phase,groups,fetchedAt};
}
// Preserve source player names; translate action wording without inventing events.
export function basketballPlayText(value:string){
 const phrases:[RegExp,string][]=[[/enters the game for/gi,'替換上場，換下'],[/offensive rebound/gi,'進攻籃板'],[/defensive rebound/gi,'防守籃板'],[/three point/gi,'三分'],[/free throw/gi,'罰球'],[/driving/gi,'切入'],[/turnaround/gi,'轉身'],[/pullup/gi,'急停'],[/jump shot|jumper/gi,'跳投'],[/layup/gi,'上籃'],[/dunk/gi,'灌籃'],[/hook shot/gi,'勾射'],[/floating/gi,'拋投'],[/makes/gi,'投進'],[/misses/gi,'未命中'],[/assists/gi,'助攻'],[/steals/gi,'抄截'],[/blocks/gi,'阻攻'],[/shooting foul/gi,'投籃犯規'],[/personal foul/gi,'個人犯規'],[/loose ball foul/gi,'爭球犯規'],[/offensive foul/gi,'進攻犯規'],[/technical foul/gi,'技術犯規'],[/bad pass/gi,'傳球失誤'],[/lost ball/gi,'掉球'],[/turnover/gi,'失誤'],[/traveling/gi,'走步'],[/full timeout/gi,'暫停'],[/timeout/gi,'暫停'],[/End of the (\d+)(?:st|nd|rd|th) Quarter/gi,'第 $1 節結束'],[/End of Game/gi,'比賽結束'],[/End of Period/gi,'本節結束'],[/(\d+)-foot/gi,'$1 呎']];
 return phrases.reduce((result,[pattern,replacement])=>result.replace(pattern,replacement),value);
}
