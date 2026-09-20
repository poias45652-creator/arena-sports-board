import {parseSourceLine} from './settlement';
import {formatSpreadLine,formatTotalLine} from './market-display';
import type {MarketKey} from './pinnacle';
import type {HrDisplayMarket} from './hr9988';

export const INTERNATIONAL_MARKET_SOURCE:Record<MarketKey,{period:'full'|'firstHalf';type:string}>={
 spread:{period:'full',type:'103'},total:{period:'full',type:'104'},
 moneyline:{period:'full',type:'111'},runline:{period:'full',type:'106'},
 firstHalfSpread:{period:'firstHalf',type:'103'},firstHalfTotal:{period:'firstHalf',type:'104'},
 firstHalfOddEven:{period:'firstHalf',type:'105'},
};
export type InternationalPick={key:string;event:number|string;label:string;lineLabel:string;price:number;signature:string;period:string;type:string;side:'home'|'away'};
type Game={id:number|string;home:string;away:string;displayMarkets?:HrDisplayMarket[]};

export function internationalMarketQuote(g:Game,period:string,type:string){
 const markets=(g.displayMarkets||[]).filter(m=>m.period===period&&m.type===Number(type));
 if(markets.length!==1)return null;
 const primaries=markets[0].quotes.filter(q=>q.primary);
 if(primaries.length!==1||!primaries[0].open)return null;
 const q=primaries[0],total=type==='104',binary=type==='111'||type==='105';
 const line=binary?{line:0,boundary:0,raw:''}:parseSourceLine(total?q.total:q.homeLine||q.awayLine);
 if(!line)return null;
 const quote={line:line.line*(total||binary||!q.homeLine?1:-1),boundary:line.boundary*(total||binary||q.homeLine?1:-1),parts:line.parts?.map(n=>n*(total||!q.homeLine?1:-1)),display:total?line.raw:(q.homeLine?'主讓 ':'客讓 ')+line.raw};
 return {...quote,q};
}

export function internationalMarketOptions(g:Game,league:string,period:string,type:string):InternationalPick[]{
 const quote=internationalMarketQuote(g,period,type);if(!quote)return [];
 const {q}=quote,total=type==='104',binary=type==='111'||type==='105';
 return (['home','away'] as const).flatMap((side,i)=>{
  const price=Number(total||type==='105'?(i?q.under:q.over):(i?q.awayPrice:q.homePrice));
  if(!Number.isFinite(price)||price<=0)return [];
  const lineLabel=total?formatTotalLine(quote,i?'under':'over'):binary?'':formatSpreadLine(quote,side);
  const label=total?(i?'小 ':'大 ')+lineLabel:type==='105'?(i?'雙':'單'):g[side]+(type==='111'?' 獨贏':' '+lineLabel);
  return [{key:`${league}:${g.id}:${period}:${type}:${side}`,event:g.id,label,lineLabel,price,signature:JSON.stringify(q),period,type,side}];
 });
}
