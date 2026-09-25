import type {Match} from './baseball';
import type {OddsSnapshot,Quote,MarketKey} from './pinnacle';
import {parseSourceLine} from './settlement';
export type SuperSnapshot={games:any[];internationalGames?:any[];sourceLeagues?:{name:string;league:string|null;games:number}[];sourceScope?:{category:'baseball';phase:'pregame';available:boolean};fetchedAt:string;source:string};
// Exact SUPER aliases observed in the 2026-09-12 source display.
// Retain team orientation and uniqueness. Explicit doubleheader labels permit
// changed start times on the same Taipei date, never an unlabelled guess.
const teamAliases=new Map<string,string>([
 ['聖路易斯紅雀','聖路易紅雀'],
 ['奧克蘭運動家','運動家'],
]);
const clean=(s:string)=>{
 const name=s.replace(/\(主\)|（主）/g,'').replace(/落磯山|洛磯山/g,'洛磯').replace(/\s/g,'');
 return teamAliases.get(name)??name;
};
function sourceTeam(value:string){
 const name=clean(value);
 const suffix=/(?:[-－・]?\s*(?:[（(\[]\s*)?(?:G(?:AME)?\s*([12])|第([一二12])場|([12]))\s*[）)\]]?)$/i;
 const hit=name.match(suffix);
 if(!hit)return {name,number:null as number|null};
 const digit=hit[1]||hit[2]||hit[3];
 return {name:clean(name.slice(0,hit.index).replace(/[-－・]$/,'')),number:digit==='一'?1:digit==='二'?2:Number(digit)};
}
const sourceDay=(value:string)=>new Date(Date.parse(value)+8*3600000).toISOString().slice(0,10);
function sourceMatch(r:any,games:Match[],label:(t:Match['home'])=>string){
 if(r.live||typeof r.home!=='string'||typeof r.away!=='string'||!/^\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}$/.test(r.start))return null;
 const start=r.start.replaceAll('/','-').replace(' ','T')+'+08:00';
 if(!Number.isFinite(Date.parse(start)))return null;
 const home=sourceTeam(r.home),away=sourceTeam(r.away);
 if(home.number&&away.number&&home.number!==away.number)return null;
 const number=home.number??away.number;
 const candidates=games.filter(g=>{
  if(clean(label(g.home))!==home.name||clean(label(g.away))!==away.name||!Number.isFinite(Date.parse(g.date)))return false;
  const gap=Math.abs(Date.parse(g.date)-Date.parse(start));
  if(number!==null)return (g.doubleHeader==='Y'||g.doubleHeader==='S')&&g.gameNumber===number&&sourceDay(g.date)===sourceDay(start)&&gap<=12*3600000;
  return gap<=600000;
 });
 return candidates.length===1?{game:candidates[0],start}:null;
}
export function superOdds(raw:SuperSnapshot|null,games:Match[],label:(t:Match['home'])=>string):OddsSnapshot|null{
 if(!raw)return null;
 const matches=raw.games.map(r=>({r,match:sourceMatch(r,games,label)}));
 return {source:raw.source,fetchedAt:raw.fetchedAt,games:matches.flatMap(({r,match})=>{
  if(!match||matches.filter(other=>other.match?.game.id===match.game.id).length!==1)return [];
  const g=match.game;
  const issues:Partial<Record<MarketKey,string>>={};
  const quote=(key:MarketKey,type:number,period:'full'|'firstHalf'='full'):Quote|null=>{
   const fail=(message:string)=>{issues[key]=message;return null;};
   // A closed primary remains authoritative; never promote an alternate line.
   const markets=Array.isArray(r.displayMarkets)
    ?r.displayMarkets.filter((m:any)=>m.period===period&&m.type===type)
    :period==='full'?(r.markets||[]).filter((m:any)=>m.type===type):[];
   if(!markets.length)return fail('尚未開盤');
   if(markets.length!==1)return fail('來源有多個同類主盤，暫停估算以免錯配。');
   const primaries=(markets[0].quotes||[]).filter((q:any)=>q.primary===true);
   if(primaries.length!==1||primaries[0].open===false)return fail('來源沒有開放的主盤；可能尚未開盤或已封盤。');
   const q=primaries[0],isTotal=type===104,isBinary=type===111||type===105;
   const value=isTotal?q.total:q.homeLine||q.awayLine;
   const parsed=isBinary?{line:0,boundary:0,raw:''}:parseSourceLine(value);
   if(!parsed)return fail('來源資料格式尚未支援：'+String(value).slice(0,30));
   const direction=isTotal||isBinary?1:q.homeLine?-1:1;
   const line=parsed.line*direction;
   const boundary=parsed.boundary*(isTotal||isBinary||q.homeLine?1:-1);
   const first=Number(isTotal||type===105?q.over:q.homePrice),second=Number(isTotal||type===105?q.under:q.awayPrice);
   if(!Number.isFinite(first)||!Number.isFinite(second)||first<=0||second<=0)return fail('來源賠率缺漏或格式無效。');
   return {line,boundary,parts:parsed.parts?.map(n=>n*direction),display:isBinary?'':isTotal?parsed.raw:(q.homeLine?'主讓 ':'客讓 ')+parsed.raw,first,second,signature:JSON.stringify([raw.source,r.id,period,type,q])};
  };
  return [{id:r.id,gameId:g.id,sourceStart:match.start,home:g.home.name,away:g.away.name,start:g.date,spread:quote('spread',103),total:quote('total',104),additional:{
   moneyline:quote('moneyline',111),runline:quote('runline',106),
   firstHalfSpread:quote('firstHalfSpread',103,'firstHalf'),firstHalfTotal:quote('firstHalfTotal',104,'firstHalf'),firstHalfOddEven:quote('firstHalfOddEven',105,'firstHalf'),
  },issues}];
 })};
}
