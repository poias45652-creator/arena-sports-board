const ESPN = "https://site.api.espn.com/apis/site/v2/sports/basketball/nbl";
const STANDINGS = "https://site.api.espn.com/apis/v2/sports/basketball/nbl/standings";
const CALENDAR = "https://schedule.nbl.com.au/api/calendar/schedule";
const MS_DAY = 86400000;
const clubAliases = {HWK:"ILL", PNX:"SEM"};
const teamCode = t => clubAliases[t?.abbreviation] || t?.abbreviation;
const offsetTime = iso => new Date(new Date(iso).getTime()+8*3600000).toISOString();
const number = value => value != null && value !== "" && Number.isFinite(Number(value)) ? Number(value) : null;
const labelPeriod = n => n>4 ? "OT"+(n-4) : "Q"+n;
const homeAway = (items,side) => items.find(item=>item.homeAway===side);
const asOf = () => new Date().toISOString();

function validateDay(day){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(day) || new Date(day+"T00:00:00Z").toISOString().slice(0,10)!==day) throw Error("無效賽事日期");
}
function phaseOf(comp){
  const kind=comp.status?.type;
  if(kind?.completed && kind.state==="post") return "final";
  if(kind?.state==="in") return "in_progress";
  if(kind?.name==="STATUS_SCHEDULED" || kind?.name==="STATUS_TIME_TBD") return "scheduled";
  return kind?.name?.replace("STATUS_","").toLowerCase() || "unknown";
}
function periodScores(home,away){
  const mapSides=t=>new Map((t?.linescores||[]).map((r,i)=>[Number(r.period)||i+1,number(r.value??r.displayValue)]));
  const a=mapSides(home),b=mapSides(away);
  return [...new Set([...a.keys(),...b.keys()])].sort((x,y)=>x-y).map(i=>({label:labelPeriod(i),home:a.get(i)??null,away:b.get(i)??null}));
}
async function readJson(url, ttl=15){
  const r=await fetch(url,{headers:{Accept:"application/json"},signal:AbortSignal.timeout(9500),cf:{cacheTtl:ttl,cacheEverything:true}});
  if(!r.ok) throw Error("NBL 資料來源暫時無法讀取（"+r.status+"）");
  return r.json();
}
function fromEspn(event){
  const comp=event.competitions?.[0];
  if(!comp) throw Error("NBL 來源缺少場次資訊");
  const home=homeAway(comp.competitors,"home"),away=homeAway(comp.competitors,"away");
  if(!home?.team || !away?.team) throw Error("NBL 來源缺少主客隊");
  const starts=offsetTime(comp.date||event.date),status=phaseOf(comp),active=status==="final" || status==="in_progress";
  const periods=active?periodScores(home,away):[];
  const periodNumber=comp.status?.period||periods.length;
  return {id:String(event.id),date:starts.slice(0,10),time:starts.slice(11,16),home:teamCode(home.team),away:teamCode(away.team),homeName:home.team.displayName,awayName:away.team.displayName,
    timeConfirmed:comp.status?.type?.name!=="STATUS_TIME_TBD"&&comp.timeValid!==false,homeScore:active?number(home.score):null,awayScore:active?number(away.score):null,status,period:active&&periodNumber?labelPeriod(periodNumber):null,clock:status==="in_progress"?comp.status?.displayClock||null:null,
    periods,venue:comp.venue?.fullName||null,url:event.links?.find(x=>x.rel?.includes("summary"))?.href || "https://www.espn.com/nbl/game/_/gameId/"+event.id,
    phase:Number(event.season?.type?.id??event.season?.type)||null,season:event.season?.year||null};
}
async function scoreboard(dates,ttl=12){
  const url=ESPN+"/scoreboard?dates="+dates+(dates.length<8?"&limit=1000":"");
  const data=await readJson(url,ttl);
  if(!data.leagues?.some(l=>l.slug==="nbl") || !Array.isArray(data.events)) throw Error("NBL 比分資料格式異常");
  return data.events.map(fromEspn);
}
const seasonStart=day=>Number(day.slice(0,4))-(Number(day.slice(5,7))<7?1:0);
async function officialGames(from,to=from){
  const years=[];
  for(let y=seasonStart(from);y<=seasonStart(to);y++) years.push(y);
  const rows=await Promise.all(years.map(async year=>{
  const data=await readJson(CALENDAR+"?league=nbl&limit=500&offset=0&year="+year,20);
  if(data.league!=="NBL" || !Array.isArray(data.matches) || Number(data.total)>data.matches.length || Number(data.year)!==year) throw Error("NBL 官方賽程資料不完整");
  return data.matches.filter(g=>g.starts_at_ms).map(g=>{
    const day=offsetTime(g.starts_at_ms).slice(0,10);
    const raw=String(g.display_clock || g.match_status_string || "");
    const p=raw.match(/\b(Q[1-4]|OT\d*)\b/),t=raw.match(/\b\d{1,2}:\d{2}\b/);
    const status=({complete:"final",live:"in_progress",upcoming:"scheduled"})[g.phase]||g.phase;
    const active=status==="final" || status==="in_progress";
    return {id:g.id,date:day,time:offsetTime(g.starts_at_ms).slice(11,16),home:g.home.team_code,away:g.away.team_code,homeName:g.home.name,awayName:g.away.name,homeScore:active?number(g.home_score):null,awayScore:active?number(g.away_score):null,status,period:p?.[0]||null,clock:status==="in_progress"?t?.[0]||null:null,periods:[],venue:g.venue_name||null,phase:g.season_type==="regular"&&!/^\d+$/.test(String(g.round_label))?(/ignite|cup/i.test(g.round_label)?4:3):({preseason:1,regular:2,in_season:4,finals:3})[g.season_type]||null,season:year+1,url:"https://www.nbl.com.au/games/"+g.match_slug};
  }).filter(g=>g.date>=from&&g.date<=to);
  }));
  return rows.flat();
}
function mergeSchedule(espn,official,from,to){

  if(espn.status!=="fulfilled" && official.status!=="fulfilled") throw Error("NBL 比分與官方賽程均無法連線");
  const officialRows=official.status==="fulfilled"?official.value:[];
  const byMatch=g=>g.date+"|"+g.home+"|"+g.away;
  const games=new Map(espn.status==="fulfilled"?espn.value.flat().filter(g=>g.date>=from&&g.date<=to).map(g=>[byMatch(g),{...g,source:"ESPN"}]):[]);
  for(const o of officialRows){
    const g=games.get(byMatch(o));
    if(!g){games.set(byMatch(o),{...o,officialId:o.id,source:"NBL"});continue;}
    g.officialId=o.id;g.officialUrl=o.url;g.venue=o.venue||g.venue;
    if(o.phase!=null)g.phase=o.phase;
    // ESPN's quarter splits and scoreboard represent one snapshot. Keep them together.
    if(o.status==="final" && g.status!=="final" || o.status==="in_progress" && g.status==="scheduled"){
      Object.assign(g,{status:o.status,homeScore:o.homeScore,awayScore:o.awayScore,period:o.period,clock:o.clock,periods:[],source:"NBL"});
    }
  }
  return {league:"NBL",asOf:asOf(),source:espn.status==="fulfilled"?(official.status==="fulfilled"?"NBL / ESPN":"ESPN"):"NBL",games:[...games.values()].sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time))};
}
export async function getNblFeed(day){
  validateDay(day);
  const previous=new Date(Date.parse(day+"T00:00:00Z")-MS_DAY).toISOString().slice(0,10);
  const [espn,official]=await Promise.allSettled([Promise.all([previous,day].map(d=>scoreboard(d.replaceAll("-","")))),officialGames(day)]);
  return {date:day,...mergeSchedule(espn,official,day,day)};
}
function teamStats(box,points){
  const values=Object.fromEntries((box?.statistics||[]).map(x=>[x.name,x.displayValue]));
  function pair(key){const m=/^(\d+)\s*-\s*(\d+)$/.exec(values[key]);return m?[Number(m[1]),Number(m[2])]:[null,null];}
  const [fgm,fga]=pair("fieldGoalsMade-fieldGoalsAttempted"),[threeMade,threeAttempted]=pair("threePointFieldGoalsMade-threePointFieldGoalsAttempted"),[ftm,fta]=pair("freeThrowsMade-freeThrowsAttempted");
  return {points,fgm,fga,threeMade,threeAttempted,ftm,fta,oreb:number(values.offensiveRebounds),turnovers:number(values.turnovers),reb:number(values.totalRebounds),ast:number(values.assists),stl:number(values.steals),blk:number(values.blocks),dreb:number(values.defensiveRebounds),fouls:number(values.fouls)};
}
function playersFrom(block){
  const line=block?.statistics?.find(x=>Array.isArray(x.athletes));
  if(!line)return [];
  return line.athletes.map(r=>{
    const row=Object.fromEntries((line.keys||[]).map((k,i)=>[k,r.stats?.[i]]));
    return {id:r.athlete?.id,name:r.athlete?.displayName,starter:r.starter===true,didNotPlay:r.didNotPlay===true,minutes:number(row.minutes),pts:number(row.points),reb:number(row.rebounds),ast:number(row.assists),stl:number(row.steals),blk:number(row.blocks),turnovers:number(row.turnovers),fg:row["fieldGoalsMade-fieldGoalsAttempted"]||null,three:row["threePointFieldGoalsMade-threePointFieldGoalsAttempted"]||null,ft:row["freeThrowsMade-freeThrowsAttempted"]||null};
  });
}
export function parseNblDetail(s){
  if(s.header?.league?.slug!=="nbl" || !s.header?.competitions?.[0]) throw Error("NBL 比賽詳情資料異常");
  const comp=s.header.competitions[0],teams=s.boxscore?.teams||[],players=s.boxscore?.players||[];
  const g=fromEspn({...s.header,links:s.header.links,season:{year:s.header.season?.year,type:s.header.season?.type},competitions:[comp]});
  const sideFor=(key,side)=>key.find(t=>t.homeAway===side || teamCode(t.team)===g[side]);
  const teamIds=Object.fromEntries(comp.competitors.map(t=>[t.team.id,teamCode(t.team)]));
  const plays=(s.plays||[]).map(p=>({id:p.id,period:p.period?.number?labelPeriod(p.period.number):null,clock:p.clock?.displayValue||null,text:p.text||p.shortDescription||null,homeScore:number(p.homeScore),awayScore:number(p.awayScore),team:teamIds[p.team?.id]||null})).filter(p=>p.text);
  const finalPeriod=comp.status?.period||g.periods.length;
  return {...g,minutes:g.status==="final"&&finalPeriod>=4?40+5*(finalPeriod-4):null,plays,teamStats:{home:teamStats(sideFor(teams,"home"),g.homeScore),away:teamStats(sideFor(teams,"away"),g.awayScore)},players:{home:playersFrom(sideFor(players,"home")),away:playersFrom(sideFor(players,"away"))},asOf:asOf(),source:"ESPN"};
}
function officialPeriod(value,type){
  const n=number(value);
  if(n==null || n===0)return null;
  if(type==="overtime" || n>=11)return "OT"+(n>=11?n-10:n>4?n-4:n);
  return labelPeriod(n);
}
const playKinds={fixture:"比賽",period:"本節",substitution:"換人","2pt":"兩分球","3pt":"三分球",assist:"助攻",turnover:"失誤",steal:"抄截",rebound:"籃板",foul:"犯規",freeThrow:"罰球",block:"阻攻",timeOut:"暫停",jumpBall:"跳球"};
const playSubtypes={Start:"開始",End:"結束",In:"上場",Out:"退場",Defensive:"防守",Offensive:"進攻",Won:"取得球權",Lost:"未取得球權",Full:"長暫停",Officials:"裁判暫停",Personal:"個人犯規",Drawn:"造成對手犯規",Flagrant:"違反運動精神犯規","Offensive Goal Tending":"進攻干擾球","Shot Clock":"進攻時間到期",Travel:"走步","Bad Pass":"傳球失誤","Out Of Bounds":"出界","Back Court":"回場","Double Dribble":"二次運球","Ball Handling":"控球失誤",Carrying:"翻球", "3Sec":"三秒違例","5Sec":"五秒違例","8Sec":"八秒違例","Alley Oop":"空中接力","Alley Oop Dunk":"空中接力灌籃","Driving Layup":"切入上籃",Dunk:"灌籃","Euro Step":"歐洲步","Fade Away":"後仰跳投","Floating Jump Shot":"拋投","Hook Shot":"鉤射","Jump Shot":"跳投",Layup:"上籃","Pull Up Jump Shot":"急停跳投","Reverse Layup":"反手上籃","Step Back Jump Shot":"後撤步跳投","Tip In":"補籃","Turn Around Jump Shot":"轉身跳投","Bench Technical":"板凳技術犯規","Coach Technical":"教練技術犯規","Category One Technical":"第一類技術犯規","Category Two Technical":"第二類技術犯規"};
function playText(p){
  let action=playKinds[p.action_type]||p.readable_action_type||p.action_type;
  const sub=playSubtypes[p.sub_type];
  if(p.action_type==="freeThrow" && /^\dOf\d$/i.test(p.sub_type))action+=" "+p.sub_type[0]+"/"+p.sub_type[3];
  else if(sub && sub!==action)action+="・"+sub;
  const result=p.success===true?"命中":p.success===false?"未進":null;
  return [p.player?.full_name,action,result].filter(Boolean).join(" ");
}
const statNames={points:"points",fga:"field_goals_attempted",fgm:"field_goals_made",threeMade:"three_points_made",threeAttempted:"three_points_attempted",fta:"free_throws_attempted",ftm:"free_throws_made",oreb:"offensive_rebounds",turnovers:"turnovers",reb:"rebounds",ast:"assists",stl:"steals",blk:"blocks",dreb:"defensive_rebounds",fouls:"personal_fouls"};
export function parseOfficialNblDetail(payload){
  const m=payload?.match;
  if(!m?.home_team?.team_code || !m?.away_team?.team_code || !m.start_time_datetime)throw Error("NBL 官方賽事資料異常");
  const time=String(m.start_time_datetime),dt=offsetTime(/[Zz]|[+-]\d\d:\d\d$/.test(time)?time:time+"Z");
  const teams={home:m.home_team.team_code,away:m.away_team.team_code};
  const teamStats={},players={},periods=new Map();
  for(const [side,code] of Object.entries(teams)){
    // Live stream uses scalar UUIDs, final box scores expand the same relation to an object.
    const sideTeam=m[side+"_team"];
    const sameTeam=r=>r.team?.team_code===code || r.team===sideTeam.id || r.team===sideTeam.external_id;
    const rows=(m.team_match_statistics||[]).filter(sameTeam);
    const totals=rows.find(r=>String(r.period)==="0");
    teamStats[side]=Object.fromEntries(Object.entries(statNames).map(([k,f])=>[k,number(totals?.[f])]));
    rows.filter(r=>r.period!=null && Number(r.period)>0).forEach(r=>{
      const n=officialPeriod(r.period,r.period_type),line=periods.get(n)||{label:n,home:null,away:null};
      line[side]=number(r.points);periods.set(n,line);
    });
    players[side]=(m.player_match_statistics||[]).filter(r=>sameTeam(r) && String(r.period)==="0" && r.player).map(r=>({id:r.player.id,name:r.player.full_name,starter:r.starter===true,didNotPlay:r.participated===false,minutes:r.minutes||null,pts:number(r.points),reb:number(r.rebounds),ast:number(r.assists),stl:number(r.steals),blk:number(r.blocks),turnovers:number(r.turnovers),fgm:number(r.field_goals_made),fga:number(r.field_goals_attempted),threeMade:number(r.three_points_made),threeAttempted:number(r.three_points_attempted),ftm:number(r.free_throws_made),fta:number(r.free_throws_attempted)}));
  }
  const status=({complete:"final",live:"in_progress",upcoming:"scheduled"})[m.phase]||m.match_status;
  const active=status==="final" || status==="in_progress";
  const ordered=[...periods.values()].sort((a,b)=>a.label.startsWith("OT")-b.label.startsWith("OT") || a.label.localeCompare(b.label,"en",{numeric:true}));
  const plays=(m.play_by_play||[]).slice().sort((a,b)=>Number(b.action_id)-Number(a.action_id)).map(p=>{
    const text=playText(p);
    return {id:String(p.action_id),period:officialPeriod(p.period,p.period_type),clock:p.clock||null,text,homeScore:number(p.score_1),awayScore:number(p.score_2),team:p.team?.team_code||null};
  }).filter(p=>p.text);
  return {id:m.id,date:dt.slice(0,10),time:dt.slice(11,16),...teams,homeScore:active?number(m.home_score):null,awayScore:active?number(m.away_score):null,status,period:active?officialPeriod(m.current_period):null,clock:status==="in_progress"?String(m.clock||"").slice(-5)||null:null,periods:ordered,venue:m.venue?.name||null,url:"https://www.nbl.com.au/games/"+m.match_slug,players,plays,teamStats,minutes:status==="final" && ordered.length>=4?40+5*ordered.filter(p=>p.label.startsWith("OT")).length:null,asOf:asOf(),source:"NBL"};
}
export async function getNblDetail(id){
  if(/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(String(id))){
    return parseOfficialNblDetail(await readJson("https://schedule.nbl.com.au/api/calendar/match?league=nbl&match="+id,15));
  }
  if(!/^\d{7,12}$/.test(String(id))) throw Error("無效 NBL 場次編號");
  return parseNblDetail(await readJson(ESPN+"/summary?event="+id,15));
}
export async function getNblStandings(seasonEnd,phase=2){
  const yr=Number(seasonEnd),p=Number(phase);
  if(!Number.isInteger(yr)||yr<2017||yr>new Date().getUTCFullYear()+2||![1,2,3].includes(p)) throw Error("不支援的 NBL 球季或階段");
  const url=STANDINGS+"?season="+yr+"&seasontype="+p;
  const s=(await readJson(url,240)).standings;
  if(s?.season!==yr||s?.seasonType!==p) throw Error("來源未提供指定球季階段的排名");
  const standings=(s.entries||[]).map(e=>{
    const d=Object.fromEntries(e.stats.map(q=>[q.name,q.value??q.displayValue??q.summary]));
    return {team:teamCode(e.team),rank:number(d.playoffSeed),wins:number(d.wins),losses:number(d.losses),pointsFor:number(d.pointsFor),pointsAgainst:number(d.pointsAgainst),pct:number(d.winPercent),streak:e.stats.find(q=>q.name==="streak")?.displayValue||null};
  }).sort((a,b)=>(a.rank??100)-(b.rank??100));
  if(p!==2){
    // ESPN's playoffSeed is the regular-season seed, even in other stages.
    const ranked=standings.filter(r=>r.wins+r.losses>0).sort((a,b)=>b.pct-a.pct || b.wins-a.wins || a.team.localeCompare(b.team));
    ranked.forEach((r,i)=>{r.rank=i>0 && r.pct===ranked[i-1].pct && r.wins===ranked[i-1].wins ? ranked[i-1].rank : i+1;});
    standings.splice(0,standings.length,...ranked);
  }
  return {league:"NBL",seasonEnd:yr,phase:p,standings,rankBasis:p===2?"league":"階段勝率",source:"ESPN",url,asOf:asOf()};
}
export async function getNblHistory(from,to){
  validateDay(from);validateDay(to);
  const start=Date.parse(from+"T00:00:00Z"),end=Date.parse(to+"T00:00:00Z");
  if(end<start || end-start>367*MS_DAY)throw Error("請選擇一年內的 NBL 賽程");
  // ESPN labels games by US calendar month. Include the preceding day before filtering in Taipei.
  const monthStart=new Date(start-MS_DAY);monthStart.setUTCDate(1);
  const months=[];for(const cursor=monthStart;cursor.getTime()<=end;cursor.setUTCMonth(cursor.getUTCMonth()+1)) months.push(cursor.toISOString().slice(0,7).replace("-",""));
  const [espn,official]=await Promise.allSettled([Promise.all(months.map(m=>scoreboard(m,180))),officialGames(from,to)]);
  return {from,to,...mergeSchedule(espn,official,from,to)};
}

// Pass game.officialId from the feed/history to retain the league's accounting
// for team rebounds and turnovers when adding completed games to the season model.
export async function getNblBox(id){
  const detail=await getNblDetail(id);
  if(detail.status!=="final" || !detail.minutes)throw Error("NBL 此場尚無完整完賽紀錄");
  const fields=["points","fga","fgm","threeMade","threeAttempted","fta","ftm","oreb","turnovers"];
  for(const side of ["home","away"]){
    if(fields.some(key=>!Number.isFinite(detail.teamStats[side]?.[key]))) throw Error("NBL 此場官方技術統計尚未齊全");
  }
  return {id:detail.id,date:detail.date,time:detail.time,home:detail.home,away:detail.away,homeScore:detail.homeScore,awayScore:detail.awayScore,status:detail.status,minutes:detail.minutes,periods:detail.periods,homeStats:detail.teamStats.home,awayStats:detail.teamStats.away,venue:detail.venue,url:detail.url,source:detail.source};
}
