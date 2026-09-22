import {internationalFixtureTime} from './international-fixture-time';
import type {SourceTable} from './international';
import {internationalTeam} from './international-teams';
import {kboTeamCodes} from './kbo-teams';

// Call after ranking the cards so the first entry retains its matched odds and pregame data.
// Start time and home/away order keep doubleheaders and different dates separate.
export function uniqueInternationalFixtures<T extends {start:string;home:string;away:string}>(games:T[],league:string):T[]{
 const seen=new Set<string>();
 const team=(name:string)=>internationalTeam(name.replace(/\s*[（(](?:主|客)[）)]\s*/g,'').trim(),league);
 return games.filter(game=>{
  const time=internationalFixtureTime(game.start);
  const away=team(game.away),home=team(game.home);
  if(!Number.isFinite(time)||!away||!home)return true;
  const key=JSON.stringify([league,time,away,home]);
  if(seen.has(key))return false;
  seen.add(key);return true;
 });
}

export function scheduledKboGames(tables:SourceTable[]=[]){
 return tables.flatMap(table=>table.rows.flatMap((row,index)=>{
  const value=(h:string)=>row[table.headers.indexOf(h)]||'';
  const start=value('台灣時間'),home=internationalTeam(value('主隊'),'KBO'),away=internationalTeam(value('客隊'),'KBO');
  const timestamp=Date.parse(start.replace(' ','T')+':00+08:00');
  if(!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(start)||!Number.isFinite(timestamp)||new Date(timestamp+8*3600000).toISOString().slice(0,16)!==start.replace(' ','T')||!kboTeamCodes[home]||!kboTeamCodes[away]||home===away)return [];
  return [{id:`kbo-schedule-${start}-${home}-${away}-${index}`,start:start+':00',home,away,live:false,displayMarkets:[],venue:value('球場'),score:value('比分'),note:value('備註'),type:value('賽別')}];
 })).sort((a,b)=>a.start.localeCompare(b.start));
}

export function upcomingKboGames(tables:SourceTable[]=[],now=Date.now()){
 return scheduledKboGames(tables).filter(g=>Date.parse(g.start.replace(' ','T')+'+08:00')>now&&(!g.score||g.score==='—')&&(!g.note||g.note==='-'));
}

export function announcedNpbGames(tables:SourceTable[]=[]){
 return tables.flatMap(table=>table.rows.flatMap(row=>{
  const value=(h:string)=>row[table.headers.indexOf(h)]||'';
  const start=value('台灣時間'),home=internationalTeam(value('主隊'),'NPB'),away=internationalTeam(value('客隊'),'NPB');
  if(!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(start)||!Number.isFinite(Date.parse(start.replace(' ','T')+':00+08:00'))||!home||!away||home===away)return [];
  return [{id:`official-${start}-${home}-${away}`,start:start+':00',home,away,live:false,displayMarkets:[],venue:value('球場'),starters:{home:value('主隊先發'),away:value('客隊先發')}}];
 }));
}
