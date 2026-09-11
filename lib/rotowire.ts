import {teamIds,type Match} from './baseball';
export type LineupPlayer={name:string;position:string;bats:string};
export type LineupSide={teamId:number;status:'confirmed'|'expected'|'unknown';pitcher:string;throws:string;players:LineupPlayer[]};
export type LineupGame={sourceId:string;dateET:string;timeET:string;away:LineupSide;home:LineupSide;temperatureF:number|null;windMph:number|null;windDirection:string;precipitation:number|null;dome:boolean;umpire:string};
export type LineupSnapshot={games:LineupGame[];fetchedAt:string;source:string};
const clean=(s='')=>s.replace(/<[^>]*>/g,' ').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&(?:#39|apos);/g,"'").replace(/&quot;/g,'"').replace(/&deg;/g,'°').replace(/&#(\d+);/g,(_,n)=>String.fromCharCode(Number(n))).replace(/\s+/g,' ').trim();
const capture=(s:string,re:RegExp)=>s.match(re)?.[1]||'';
export function parseLineups(html:string):LineupGame[]{
 if(html.length>3000000)throw new Error('先發資料超出上限');
 const games:LineupGame[]=[];
 for(const block of html.split(/<div class="lineup is-mlb\b/).slice(1)){
  const link=capture(block,/href="\/baseball\/box-score\/([^"?#]+)"/),dateET=capture(link,/(\d{4}-\d{2}-\d{2})-\d+$/);
  const abbr=[...block.matchAll(/class="lineup__abbr">([^<]+)</g)].slice(0,2).map(m=>teamIds[clean(m[1])]);
  const timeET=clean(capture(block,/class="lineup__time">([\s\S]*?)<\/div>/));
  if(!dateET||abbr.length!==2||abbr.some(id=>!id)||!/^\d{1,2}:\d{2} [AP]M ET$/.test(timeET))continue;
  const side=(tag:string,teamId:number):LineupSide=>{
   const ul=capture(block,new RegExp('<ul class="lineup__list '+tag+'">([\\s\\S]*?)</ul>'));
   const players=[...ul.matchAll(/<li class="lineup__player">([\s\S]*?)<\/li>/g)].map(m=>({name:clean(capture(m[1],/<a[^>]*title="([^"]+)"/)||capture(m[1],/<a[^>]*>([\s\S]*?)<\/a>/)),position:clean(capture(m[1],/class="lineup__pos">([^<]*)</)),bats:clean(capture(m[1],/class="lineup__bats">([^<]*)</))}));
   const complete=players.length===9&&players.every(p=>p.name&&p.position&&['L','R','S'].includes(p.bats))&&new Set(players.map(p=>p.name)).size===9;
   return {teamId,status:complete&&/lineup__status is-confirmed/.test(ul)?'confirmed':complete&&/Expected Lineup/.test(ul)?'expected':'unknown',pitcher:clean(capture(ul,/class="lineup__player-highlight-name">\s*<a[^>]*>([\s\S]*?)<\/a>/)),throws:clean(capture(ul,/class="lineup__throws">([^<]*)</)),players:complete?players:[]};
  };
  const weather=clean(capture(block,/class="lineup__weather-text">([\s\S]*?)<\/div>/));
  const num=(re:RegExp)=>{const m=weather.match(re);return m?Number(m[1]):null;};
  const rawUmpire=clean(capture(block,/class="lineup__umpire">([\s\S]*?)<\/div>/));
  games.push({sourceId:link,dateET,timeET,away:side('is-visit',abbr[0]),home:side('is-home',abbr[1]),temperatureF:num(/(-?\d+)°/),windMph:num(/Wind\s+(\d+)\s+mph/),windDirection:weather.match(/mph\s+(R-L|L-R|Out|In)\b/)?.[1]||'',precipitation:num(/(\d+)%/),dome:/Domed Stadium/.test(weather),umpire:/Not announced/i.test(rawUmpire)?'':clean(capture(block,/class="lineup__umpire">[\s\S]*?<a[^>]*>([^<]+)<\/a>/))});
 }
 if(!games.length)throw new Error('先發來源未提供可識別賽事，或頁面格式已變更');
 return games;
}
export function matchLineup(g:Match,s:LineupSnapshot|null):LineupGame|null{
 const d=new Date(g.date);const dateET=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(d);
 const timeET=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',hour:'numeric',minute:'2-digit',hour12:true}).format(d)+' ET';
 const candidates=s?.games.filter(l=>l.dateET===dateET&&l.timeET===timeET&&l.away.teamId===g.away.id&&l.home.teamId===g.home.id)||[];
 return candidates.length===1?candidates[0]:null;
}
export type BullpenRow={id:string;name:string;teamId:number;days:(number|null)[];last3:number|null;last5:number|null};
export type BullpenSnapshot={rows:BullpenRow[];fetchedAt:string;source:string};
export function parseBullpen(value:unknown):BullpenRow[]{
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('牛棚來源格式改變');
 const rows:BullpenRow[]=[];const count=(x:unknown)=>Number.isInteger(x)&&Number(x)>=0&&Number(x)<=1000?Number(x):null;
 for(const [team,list] of Object.entries(value)){
  if(!teamIds[team]||!Array.isArray(list))continue;
  for(const p of list){if(!p||p.team!==team||typeof p.player!=='string'||!p.playerID)continue;
   rows.push({id:String(p.playerID),name:p.player,teamId:teamIds[team],days:[1,2,3,4,5].map(n=>count(p['day'+n])),last3:count(p.last3),last5:count(p.last5)});
  }
 }
 if(!rows.length)throw new Error('牛棚來源尚無資料');
 return rows;
}
