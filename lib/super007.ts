import type {Match} from './baseball';
import type {OddsSnapshot,Quote} from './pinnacle';
import {parseSourceLine} from './settlement';
export type SuperSnapshot={games:any[];fetchedAt:string;source:string};
const clean=(s:string)=>s.replace(/\(主\)|（主）/g,'').replace(/落磯山|洛磯山/g,'洛磯').replace(/\s/g,'');
export function superOdds(raw:SuperSnapshot|null,games:Match[],label:(t:Match['home'])=>string):OddsSnapshot|null{
 if(!raw)return null;
 return {source:raw.source,fetchedAt:raw.fetchedAt,games:raw.games.flatMap(r=>{
  if(r.live||!/^\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}$/.test(r.start))return [];
  const start=r.start.replaceAll('/','-').replace(' ','T')+'+08:00';
  const candidates=games.filter(g=>clean(label(g.home))===clean(r.home)&&clean(label(g.away))===clean(r.away)&&Math.abs(Date.parse(g.date)-Date.parse(start))<=600000);
  if(candidates.length!==1)return [];const g=candidates[0];
  const issues:{spread?:string;total?:string}={};
  const quote=(type:number):Quote|null=>{
   const key=type===104?'total':'spread';
   const fail=(message:string)=>{issues[key]=message;return null;};
   const markets=r.markets.filter((m:any)=>m.type===type);if(!markets.length)return fail('來源未提供此玩法。');if(markets.length!==1)return fail('來源有多個同類主盤，暫停估算以免錯配。');
   const q=markets[0].quotes[0];if(!q||q.primary!==true)return fail('來源沒有開放的主盤；可能尚未開盤或已封盤。');
   const value=type===104?q.total:q.homeLine||q.awayLine;
   const parsed=parseSourceLine(value);if(!parsed)return fail('來源盤口格式尚未支援：'+String(value).slice(0,30));
   const direction=type===104?1:q.homeLine?-1:1;
   const line=parsed.line*direction;
   const boundary=parsed.boundary*(type===104||q.homeLine?1:-1);
   const first=Number(type===104?q.over:q.homePrice),second=Number(type===104?q.under:q.awayPrice);
   if(!Number.isFinite(first)||!Number.isFinite(second)||first<=0||second<=0)return fail('來源賠率缺漏或格式無效。');
   return {line,boundary,parts:parsed.parts?.map(n=>n*direction),display:type===104?parsed.raw:(q.homeLine?'主讓 ':'客讓 ')+parsed.raw,first,second,signature:JSON.stringify([raw.source,r.id,type,q])};
  };
  return [{id:r.id,home:g.home.name,away:g.away.name,start:g.date,spread:quote(103),total:quote(104),issues}];
 })};
}
