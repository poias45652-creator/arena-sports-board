import {parseEfficiencyBox,type BasketballLeague} from './basketball-efficiency';
import {basketballPage,BasketballSourceUnavailable} from './wnba-fetch';
import type {NbaGame} from './nba';

const CORE='https://sports.core.api.espn.com';
function requireRef(ref:unknown,path:string){
 const url=typeof ref==='string'?new URL(ref):null;
 if(!url||!['http:','https:'].includes(url.protocol)||url.hostname!=='sports.core.api.espn.com'||url.port||url.username||url.password||url.pathname!==path)throw Error('比賽數據來源不符');
}

// Some historical ESPN summaries return 404 while their Core records remain
// available. Read the SAME event and keep every game in the recent sample.
async function coreBox(game:NbaGame,league:BasketballLeague){
 const root=`/v2/sports/basketball/leagues/${league.toLowerCase()}`,path=`${root}/events/${game.id}/competitions/${game.id}`,leagueId=league==='NBA'?'46':'59';
 const read=async(p:string)=>JSON.parse(await basketballPage(CORE+p,12000,league));
 const c=await read(path);
 requireRef(c.$ref,path);
 if(String(c.id)!==game.id||c.uid!==`s:40~l:${leagueId}~e:${game.id}~c:${game.id}`||Date.parse(c.date)!==Date.parse(game.start)||c.neutralSite!==game.neutral||!Array.isArray(c.competitors)||c.competitors.length!==2)throw Error('比賽數據來源不符');
 requireRef(c.status?.$ref,`${path}/status`);
 const sides=['home','away'] as const;
 const competitors=sides.map(side=>{
  const team=c.competitors.find((t:any)=>t.homeAway===side),id=game[side].id,part=`${path}/competitors/${id}`;
  if(String(team?.id)!==id||team.uid!==`s:40~l:${leagueId}~t:${id}`||team.type!=='team')throw Error('球隊數據來源不符');
  requireRef(team.$ref,part);requireRef(team.team?.$ref,`${root}/seasons/${game.season}/teams/${id}`);
  for(const kind of ['score','linescores','statistics'])requireRef(team[kind]?.$ref,`${part}/${kind}`);
  return {side,team,part};
 });
 const status=await read(`${path}/status`);requireRef(status.$ref,`${path}/status`);
 if(status.type?.completed!==true||!String(status.type.name).startsWith('STATUS_FINAL')||!Number.isInteger(status.period)||status.period<4||status.period>20||game.period&&game.period!==status.period)throw Error('比賽節數不完整');
 const rows=await Promise.all(competitors.map(async({side,team,part})=>{
  const [score,lines,stats]=await Promise.all(['score','linescores','statistics'].map(kind=>read(`${part}/${kind}`)));
  if(!/^\d+$/.test(String(score.source?.id)))throw Error('比分數據不完整');
  requireRef(score.$ref,`${part}/scores/${score.source.id}`);
  requireRef(stats.$ref,`${part}/statistics/0`);requireRef(stats.competition?.$ref,path);requireRef(stats.team?.$ref,`${root}/seasons/${game.season}/teams/${team.id}`);
  if(!Number.isInteger(score.value)||score.value!==game[`${side}Score`])throw Error('球隊數據來源不符');
  if(lines.pageIndex!==1||lines.pageCount!==1||lines.count!==status.period||!Array.isArray(lines.items)||lines.items.length!==status.period)throw Error('比賽節數不完整');
  const periods=new Set<number>();
  for(const line of lines.items){
   if(!Number.isInteger(line.period)||line.period<1||line.period>status.period||periods.has(line.period)||!Number.isInteger(line.value)||line.value<0||String(line.source?.id)!==String(score.source.id))throw Error('比賽節數不完整');
   requireRef(line.$ref,`${part}/linescores/${line.source.id}/${line.period}`);periods.add(line.period);
  }
  if(lines.items.reduce((sum:number,line:any)=>sum+line.value,0)!==score.value)throw Error('單節與完賽比分不符');
  if(stats.splits?.id!=='0'||stats.splits.type!=='total'||!Array.isArray(stats.splits.categories))throw Error('球隊數據不完整');
  const values=new Map<string,number>();
  for(const category of stats.splits.categories){
   if(!Array.isArray(category.stats))throw Error('球隊數據不完整');
   for(const stat of category.stats){if(values.has(stat.name))throw Error('球隊數據重複');values.set(stat.name,stat.value);}
  }
  const count=(name:string)=>{const value=values.get(name);if(typeof value!=='number'||!Number.isInteger(value)||value<0)throw Error('球隊數據不完整');return value;};
  if(count('points')!==score.value)throw Error('球隊數據來源不符');
  const statistics=[['fieldGoalsMade','fieldGoalsAttempted'],['threePointFieldGoalsMade','threePointFieldGoalsAttempted'],['freeThrowsMade','freeThrowsAttempted']].map(([made,attempted])=>({name:`${made}-${attempted}`,displayValue:`${count(made)}-${count(attempted)}`}));
  for(const name of ['offensiveRebounds','totalTurnovers'])statistics.push({name,displayValue:String(count(name))});
  return {head:{id:team.id,homeAway:side,score:String(score.value),linescores:lines.items},box:{team:{id:team.id,uid:team.uid},statistics}};
 }));
 // Reuse the summary parser's shooting, final-score and possession checks.
 return parseEfficiencyBox({header:{id:game.id,competitions:[{...c,status,competitors:rows.map(r=>r.head)}]},boxscore:{teams:rows.map(r=>r.box)}},game,league);
}

export async function fetchEfficiencyBox(game:NbaGame,league:BasketballLeague){
 let raw:any;
 try{raw=JSON.parse(await basketballPage(`https://site.api.espn.com/apis/site/v2/sports/basketball/${league.toLowerCase()}/summary?event=${game.id}`,12000,league));}
 catch(error){
  // Never route around forbidden requests or inconsistent summary data.
  if(!(error instanceof BasketballSourceUnavailable)||error.status!==404)throw error;
  const result=await coreBox(game,league);
  console.info('basketball-box-core-recovered',JSON.stringify({league,id:game.id}));
  return result;
 }
 return parseEfficiencyBox(raw,game,league);
}
