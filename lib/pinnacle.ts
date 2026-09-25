import type { Match } from './baseball';
export type Quote={line:number;first:number;second:number;signature:string;boundary?:number;parts?:number[];display?:string};
export type MarketKey='spread'|'total'|'moneyline'|'runline'|'firstHalfSpread'|'firstHalfTotal'|'firstHalfOddEven';
export type OddsGame={id:number;gameId?:number;sourceStart?:string;away:string;home:string;start:string;spread:Quote|null;total:Quote|null;additional?:Partial<Record<Exclude<MarketKey,'spread'|'total'>,Quote|null>>;issues?:Partial<Record<MarketKey,string>>};
export type OddsSnapshot={games:OddsGame[];fetchedAt:string;source:string};
export function decimal(price:number){return Number.isFinite(price)&&Math.abs(price)>=100?(price>0?1+price/100:1+100/-price):null;}
export function parsePinnacle(fixtures:any,markets:any,now=Date.now()):OddsGame[]{
 if(!Array.isArray(fixtures)||!Array.isArray(markets))throw new Error('資料來源格式改變');
 return fixtures.filter(g=>g.league?.id===246&&!g.parentId&&!g.special&&!g.isLive&&g.status==='pending'&&Date.parse(g.startTime)>now).flatMap(g=>{
  const home=g.participants?.find((p:any)=>p.alignment==='home'),away=g.participants?.find((p:any)=>p.alignment==='away');
  if(!home?.name||!away?.name||!Number.isInteger(g.id))return [];
  const quote=(type:'spread'|'total'):Quote|null=>{
   const eligible=markets.filter(m=>m.matchupId===g.id&&m.period===0&&m.type===type&&m.isAlternate===false&&m.status==='open'&&Date.parse(m.cutoffAt)>now);
   // Fail closed if the source exposes multiple primary lines.
   if(eligible.length!==1)return null;const m=eligible[0];
   const a=m.prices?.find((p:any)=>p.designation===(type==='spread'?'home':'over')),b=m.prices?.find((p:any)=>p.designation===(type==='spread'?'away':'under'));
   if(!a||!b||typeof a.points!=='number'||typeof b.points!=='number'||!Number.isFinite(a.points)||!Number.isInteger(a.points*2)||(type==='spread'?a.points!==-b.points:a.points!==b.points))return null;
   const first=decimal(a.price),second=decimal(b.price);if(first===null||second===null)return null;
   return {line:a.points,first,second,signature:JSON.stringify([g.id,type,m.key,a.points,a.price,b.price])};
  };
  return [{id:g.id,away:away.name,home:home.name,start:g.startTime,spread:quote('spread'),total:quote('total')}];
 });
}
const normalize=(name:string)=>name.toLowerCase().replace(/^oakland athletics$|^athletics$/,'athletics').replace(/[^a-z0-9]/g,'');
export function matchOdds(g:Match,s:OddsSnapshot|null):OddsGame|null{
 if(!s)return null;const candidates=s.games.filter(o=>(o.gameId===undefined||o.gameId===g.id)&&normalize(o.home)===normalize(g.home.name)&&normalize(o.away)===normalize(g.away.name)&&Math.abs(Date.parse(o.start)-Date.parse(g.date))<=10*60000);
 return candidates.length===1?candidates[0]:null;
}

export function validateCollectorSnapshot(value:unknown,now=Date.now()):OddsSnapshot{
 const s=value as OddsSnapshot;
 const age=now-Date.parse(s?.fetchedAt);
 if(!s||!Array.isArray(s.games)||s.games.length>100||!Number.isFinite(age)||age< -60000||age>150000)throw new Error('抓盤服務資料尚未就緒或已過期');
 const validQuote=(q:Quote|null)=>q===null||!!q&&Number.isFinite(q.line)&&Number.isInteger(q.line*2)&&Number.isFinite(q.first)&&q.first>1&&Number.isFinite(q.second)&&q.second>1&&typeof q.signature==='string'&&q.signature.length<=500;
 if(s.games.some(g=>!g||!Number.isInteger(g.id)||typeof g.home!=='string'||typeof g.away!=='string'||!Number.isFinite(Date.parse(g.start))||!validQuote(g.spread)||!validQuote(g.total))||new Set(s.games.map(g=>g.id)).size!==s.games.length)throw new Error('抓盤服務資料格式異常');
 return {games:s.games,fetchedAt:s.fetchedAt,source:'https://www.pinnacle.com/zh-TW/'};
}
