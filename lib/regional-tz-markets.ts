import {matchSportEvent,sourceTime,sportQuoteLabel,type SportQuote} from './sport-super-markets';
import {registeredNames,sportTeamKey} from './sport-team-names';
import type {RegionalLeague} from './regional-basketball-names';
import type {SuperSnapshot} from './super007';

export type RegionalTzQuote=Pick<SportQuote,'kind'|'line'|'boundary'|'parts'|'home'|'away'>&{labels:string[]};
export type RegionalTzMarket={source:'tz';league:RegionalLeague;home:string;away:string;startsAt:string;checkedAt:string;current:boolean;quotes:RegionalTzQuote[]};
function publicQuote(q:SportQuote):RegionalTzQuote{
 const sides=q.kind==='total'?['over','under'] as const:['home','away'] as const;
 return {kind:q.kind,line:q.line,boundary:q.boundary,parts:q.parts,home:q.home,away:q.away,
  labels:sides.map(side=>q.kind==='moneyline'?'':sportQuoteLabel(q,side))};
}

// Retain the last open quote per event inside this member's existing, binding-scoped snapshot.
// A quote absent from the current board can only be shown after tip-off as an archive.
export function regionalTzMarkets(snapshot:SuperSnapshot,previous:RegionalTzMarket[]=[]):RegionalTzMarket[]{
 const now=Date.parse(snapshot.fetchedAt);
 const markets=new Map<string,RegionalTzMarket>();
 const key=(m:RegionalTzMarket)=>[m.league,m.home,m.away,m.startsAt].join('|');
 for(const row of previous){
  const start=Date.parse(row.startsAt);
  if(row.source==='tz'&&Date.parse(row.checkedAt)<start&&start>=now-2*86400000)markets.set(key(row),{...row,current:false});
 }
 for(const row of snapshot.sportGames||[]){
  const league:RegionalLeague=row.league;if(league!=='NBL'&&league!=='KBL'||row.live!==false)continue;
  const start=sourceTime(row.start);if(!Number.isFinite(start)||start<=now)continue;
  const home=sportTeamKey(row.home,league),away=sportTeamKey(row.away,league);
  if(home===away||!registeredNames[league].has(home)||!registeredNames[league].has(away))continue;
  const startsAt=new Date(start).toISOString();
  const event=matchSportEvent(snapshot,{id:String(row.id),league,start:startsAt,timeConfirmed:true,state:'scheduled',home:{name:home},away:{name:away}},league,now);
  if(!event)continue;
  const quotes=[event.spread,event.total,event.moneyline].filter((q):q is SportQuote=>!!q).map(publicQuote);
  if(!quotes.length)continue;
  const market:RegionalTzMarket={source:'tz',league,home,away,startsAt,checkedAt:snapshot.fetchedAt,current:true,quotes};
  markets.set(key(market),market);
 }
 return [...markets.values()];
}
